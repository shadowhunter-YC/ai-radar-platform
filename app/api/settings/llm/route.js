import {
  verifySessionToken,
  getLlmConfig,
  setSetting
} from '../../../../lib/collection-store.mjs';
import { verifySession } from '../../../../lib/auth-token.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getSessionUser(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)radar_session=([^;]+)/);
  if (!match) return null;
  const rawToken = match[1];

  // 1. 优先校验 HMAC 签名 Session
  const session = await verifySession(rawToken);
  if (session && session.exp > Date.now()) {
    if (session.tokenId) {
      const dbSession = verifySessionToken(session.tokenId);
      if (!dbSession) return null;
    }
    return { id: session.uid, username: session.username, role: session.role };
  }

  // 2. 兼容 SQLite 旧 Token 校验
  return verifySessionToken(rawToken);
}

function maskApiKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: '未授权，请先登录' }, { status: 401 });
  }

  const config = getLlmConfig();
  return Response.json({
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: config.temperature,
    hasApiKey: Boolean(config.apiKey),
    maskedApiKey: maskApiKey(config.apiKey)
  });
}

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: '未授权，请先登录' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体格式无效' }, { status: 400 });
  }

  const { action = 'save' } = body;
  const current = getLlmConfig();

  // 1. 连通性测试
  if (action === 'test') {
    const rawKey = body.apiKey?.trim();
    const effectiveKey = (!rawKey || rawKey.includes('****')) ? current.apiKey : rawKey;
    const effectiveBaseUrl = (body.baseUrl?.trim() || current.baseUrl).replace(/\/+$/, '');
    const effectiveModel = body.model?.trim() || current.model;

    if (!effectiveKey) {
      return Response.json({ success: false, error: '缺少 API Key，无法进行测试' }, { status: 400 });
    }

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const endpoint = `${effectiveBaseUrl}/chat/completions`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveKey}`
        },
        body: JSON.stringify({
          model: effectiveModel,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          errMsg = errData.error?.message || errData.message || errMsg;
        } catch {
          const text = await res.text();
          if (text) errMsg = text.slice(0, 120);
        }
        return Response.json({
          success: false,
          latencyMs,
          error: `测试失败 (${res.status}): ${errMsg}`
        });
      }

      return Response.json({
        success: true,
        latencyMs,
        model: effectiveModel
      });
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const msg = err.name === 'AbortError' ? '请求超时 (15s)' : (err.message || '网络连接失败');
      return Response.json({
        success: false,
        latencyMs,
        error: `连接异常: ${msg}`
      });
    }
  }

  // 2. 保存配置
  if (action === 'save') {
    const provider = body.provider || current.provider || 'siliconflow';
    const baseUrl = (body.baseUrl?.trim() || current.baseUrl || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
    const model = body.model?.trim() || current.model || 'deepseek-ai/DeepSeek-V3';
    const temperature = typeof body.temperature === 'number' ? body.temperature : 0.3;

    let apiKey = body.apiKey?.trim();
    if (!apiKey || apiKey.includes('****')) {
      apiKey = current.apiKey;
    }

    if (!apiKey) {
      return Response.json({ error: '请提供有效的 API Key' }, { status: 400 });
    }

    const newConfig = {
      provider,
      baseUrl,
      apiKey,
      model,
      temperature
    };

    setSetting('llm_config', newConfig);

    return Response.json({
      success: true,
      config: {
        provider,
        baseUrl,
        model,
        temperature,
        hasApiKey: true,
        maskedApiKey: maskApiKey(apiKey)
      }
    });
  }

  return Response.json({ error: '未知操作' }, { status: 400 });
}
