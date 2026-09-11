import { saveRssFeed, WECHAT_DEFAULT_KEYWORDS } from '../../../lib/collection-store.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WECHAT_RSS_BASE = (process.env.WECHAT_RSS_BASE_URL || 'http://192.168.1.107:8001').replace(/\/$/, '');
const WECHAT_RSS_PUBLIC = (process.env.WECHAT_RSS_PUBLIC_URL || 'https://wewe.wilsongo.top').replace(/\/$/, '');
const ADMIN_USER = process.env.WECHAT_RSS_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.WECHAT_RSS_ADMIN_PASS || 'admin@123';

let tokenCache = { token: null, expiresAt: 0 };

async function getAuthToken() {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now + 60000) {
    return tokenCache.token;
  }
  try {
    const params = new URLSearchParams();
    params.append('username', ADMIN_USER);
    params.append('password', ADMIN_PASS);
    const res = await fetch(`${WECHAT_RSS_BASE}/api/v1/wx/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) {
      throw new Error(`登录 WeRSS 失败: HTTP ${res.status}`);
    }
    const data = await res.json();
    const token = data.data?.access_token || data.access_token;
    if (!token) throw new Error('未获取到有效 access_token');
    tokenCache = {
      token,
      expiresAt: now + (data.data?.expires_in || 3600) * 1000
    };
    return token;
  } catch (err) {
    console.error('WeRSS auth error:', err.message);
    throw err;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  try {
    const token = await getAuthToken();
    const headers = { Authorization: `Bearer ${token}` };

    if (action === 'qr') {
      // 触发生成二维码
      const qrRes = await fetch(`${WECHAT_RSS_BASE}/api/v1/wx/auth/qr/code`, {
        headers,
        signal: AbortSignal.timeout(15000)
      });
      const qrData = await qrRes.json();
      const codePath = qrData.data?.code || '/static/wx_qrcode.png';
      const cleanPath = codePath.startsWith('/') ? codePath : `/${codePath}`;

      // 获取二维码图片二进制并转为 Base64 Data URI，方便前端直接渲染且规避混合内容与鉴权限制
      let qrDataUrl = null;
      try {
        const imgRes = await fetch(`${WECHAT_RSS_BASE}${cleanPath}`, {
          signal: AbortSignal.timeout(10000)
        });
        if (imgRes.ok) {
          const arrayBuf = await imgRes.arrayBuffer();
          const base64 = Buffer.from(arrayBuf).toString('base64');
          qrDataUrl = `data:image/png;base64,${base64}`;
        }
      } catch (e) {
        console.warn('获取二维码图片转 Base64 失败:', e.message);
      }

      return Response.json({
        success: true,
        data: qrData.data || qrData,
        qrDataUrl: qrDataUrl || `${WECHAT_RSS_PUBLIC}${cleanPath}`
      });
    }

    if (action === 'status') {
      const statusRes = await fetch(`${WECHAT_RSS_BASE}/api/v1/wx/auth/qr/status`, {
        headers,
        signal: AbortSignal.timeout(10000)
      });
      const statusData = await statusRes.json();
      const s = statusData.data || {};
      const isLogin = Boolean(s.login_status || s.is_login);
      return Response.json({
        success: true,
        data: {
          ...s,
          is_login: isLogin,
          status: isLogin ? 'success' : (s.qr_code ? 'waiting' : 'idle')
        }
      });
    }

    if (action === 'mps') {
      const mpsRes = await fetch(`${WECHAT_RSS_BASE}/api/v1/wx/mps`, {
        headers,
        signal: AbortSignal.timeout(10000)
      });
      const mpsData = await mpsRes.json();
      return Response.json({
        success: true,
        data: mpsData.data?.list || mpsData.data || []
      });
    }

    return Response.json({ error: '未知 action' }, { status: 400 });
  } catch (err) {
    return Response.json({
      error: err.message || '连接 WeRSS 服务失败，请确认服务已启动'
    }, { status: 502 });
  }
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求数据格式无效' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || body.action;

  try {
    const token = await getAuthToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    if (action === 'search') {
      const kw = String(body.kw || '').trim();
      if (!kw) return Response.json({ error: '请输入搜索关键词' }, { status: 400 });

      const searchRes = await fetch(`${WECHAT_RSS_BASE}/api/v1/wx/mps/search/${encodeURIComponent(kw)}`, {
        headers,
        signal: AbortSignal.timeout(15000)
      });
      const searchData = await searchRes.json();
      const list = searchData.data?.list || searchData.data || [];
      return Response.json({
        success: true,
        data: list
      });
    }

    if (action === 'subscribe') {
      const { id, name, cover, intro, filterKeywords } = body;
      if (!name) return Response.json({ error: '公众号名称不能为空' }, { status: 400 });

      const mpId = String(id || name).trim();
      // 在 WeRSS 中注册该公众号
      try {
        await fetch(`${WECHAT_RSS_BASE}/api/v1/wx/mps`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            mp_name: name,
            mp_id: mpId,
            mp_cover: cover || '',
            avatar: cover || '',
            mp_intro: intro || ''
          }),
          signal: AbortSignal.timeout(15000)
        });
      } catch (e) {
        console.warn('WeRSS mps add warning:', e.message);
      }

      // 生成与 WeRSS 兼容的 RSS 订阅链接
      const feedUrl = `${WECHAT_RSS_BASE}/feed/${encodeURIComponent(mpId)}.xml`;
      const keywords = filterKeywords !== undefined ? filterKeywords : WECHAT_DEFAULT_KEYWORDS;

      // 保存至 Radar 本地 SQLite 订阅源库
      const feedRecord = saveRssFeed({
        id: `wechat-${mpId.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
        name,
        url: feedUrl,
        category: '微信公众号',
        description: intro || `${name} 微信公众号`,
        filterKeywords: keywords,
        enabled: 1,
        cadence: '每天'
      });

      return Response.json({
        success: true,
        feed: feedRecord
      });
    }

    return Response.json({ error: '未知 action' }, { status: 400 });
  } catch (err) {
    return Response.json({
      error: err.message || '操作失败'
    }, { status: 502 });
  }
}
