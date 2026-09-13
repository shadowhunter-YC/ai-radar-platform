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
      // 1. 触发生成二维码任务
      const qrRes = await fetch(`${WECHAT_RSS_BASE}/api/v1/wx/auth/qr/code`, {
        headers,
        signal: AbortSignal.timeout(15000)
      });
      const qrData = await qrRes.json();

      // 2. 微信公众平台二维码由 Playwright 启动无头浏览器打开微信公众平台页面截取，通常需要 1.5 - 4 秒就绪。
      // 在服务端轮询等待图片就绪（每 500ms 检查一次，最多等待 12 秒），确保返回给前端的一定是真实完整二维码。
      let qrDataUrl = null;
      const startTime = Date.now();
      while (Date.now() - startTime < 12000) {
        try {
          const checkRes = await fetch(`${WECHAT_RSS_BASE}/api/v1/wx/auth/qr/image`, {
            headers,
            signal: AbortSignal.timeout(3000)
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.data === true) {
              // 图片已就绪，抓取二进制并转为 Base64 Data URI
              const imgRes = await fetch(`${WECHAT_RSS_BASE}/static/wx_qrcode.png?t=${Date.now()}`, {
                signal: AbortSignal.timeout(5000)
              });
              if (imgRes.ok) {
                const arrayBuf = await imgRes.arrayBuffer();
                if (arrayBuf.byteLength > 500) {
                  const base64 = Buffer.from(arrayBuf).toString('base64');
                  qrDataUrl = `data:image/png;base64,${base64}`;
                  break;
                }
              }
            }
          }
        } catch (e) {
          // 忽略轮询间隔中的单次网络异常
        }
        await new Promise(r => setTimeout(r, 500));
      }

      if (!qrDataUrl) {
        // 如果轮询超时，尝试最后一次直接读取现存图片作为兜底
        try {
          const imgRes = await fetch(`${WECHAT_RSS_BASE}/static/wx_qrcode.png?t=${Date.now()}`, {
            signal: AbortSignal.timeout(5000)
          });
          if (imgRes.ok) {
            const arrayBuf = await imgRes.arrayBuffer();
            if (arrayBuf.byteLength > 500) {
              const base64 = Buffer.from(arrayBuf).toString('base64');
              qrDataUrl = `data:image/png;base64,${base64}`;
            }
          }
        } catch {}
      }

      if (!qrDataUrl) {
        return Response.json({
          success: false,
          error: '微信公众平台二维码生成中，请点击【刷新二维码】重试'
        }, { status: 504 });
      }

      return Response.json({
        success: true,
        data: qrData.data || qrData,
        qrDataUrl
      });
    }

    if (action === 'qrimg') {
      try {
        const imgRes = await fetch(`${WECHAT_RSS_BASE}/static/wx_qrcode.png?t=${Date.now()}`, {
          signal: AbortSignal.timeout(5000)
        });
        if (imgRes.ok) {
          const arrayBuf = await imgRes.arrayBuffer();
          return new Response(arrayBuf, {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          });
        }
      } catch {}
      return new Response('二维码暂未就绪', { status: 404 });
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
      let realFeedId = null;

      // 1. 在 WeRSS 中注册/登记该公众号
      try {
        const werssRes = await fetch(`${WECHAT_RSS_BASE}/api/v1/wx/mps`, {
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
        if (werssRes.ok) {
          const werssData = await werssRes.json();
          realFeedId = werssData.data?.id || werssData.id;
        }
      } catch (e) {
        console.warn('WeRSS mps add warning:', e.message);
      }

      // 2. 若 WeRSS 未返回 id，根据 mpId 尝试 base64 解码出数字 ID（WeRSS 规范命名: MP_WXS_${decoded}）
      if (!realFeedId) {
        try {
          const decoded = Buffer.from(mpId, 'base64').toString('utf-8');
          if (decoded && /^\d+$/.test(decoded)) {
            realFeedId = `MP_WXS_${decoded}`;
          }
        } catch {}
      }
      if (!realFeedId) {
        realFeedId = mpId;
      }

      // 3. 生成与 WeRSS 兼容且符合公网 HTTPS 标准规范的 RSS 订阅链接
      const feedUrl = `${WECHAT_RSS_PUBLIC}/feed/${encodeURIComponent(realFeedId)}.xml`;
      const keywords = filterKeywords !== undefined ? filterKeywords : WECHAT_DEFAULT_KEYWORDS;

      // 4. 保存至 Radar 本地 SQLite 订阅源库
      const feedRecord = saveRssFeed({
        id: `wechat-${realFeedId.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
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
