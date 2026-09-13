import {
  verifyUserCredentials,
  createSession,
  verifySessionToken,
  destroySession,
  changeUserPassword
} from '../../../lib/collection-store.mjs';
import { signSession, verifySession } from '../../../lib/auth-token.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSessionToken(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)radar_session=([^;]+)/);
  return match ? match[1] : null;
}

async function getSessionUser(request) {
  const token = getSessionToken(request);
  if (!token) return null;

  // 1. 优先校验 HMAC 签名 Session
  const session = await verifySession(token);
  if (session && session.exp > Date.now()) {
    if (session.tokenId) {
      const dbSession = verifySessionToken(session.tokenId);
      if (!dbSession) return null;
    }
    return {
      id: session.uid,
      username: session.username,
      role: session.role
    };
  }

  // 2. 兼容 SQLite 旧 Token 校验
  const user = verifySessionToken(token);
  if (user) {
    return {
      id: user.id,
      username: user.username,
      role: user.role
    };
  }

  return null;
}

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    const token = getSessionToken(request);
    return Response.json(
      { loggedIn: false },
      token
        ? {
            headers: {
              'Set-Cookie': 'radar_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
            }
          }
        : undefined
    );
  }

  return Response.json({
    loggedIn: true,
    user
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体格式无效' }, { status: 400 });
  }

  const { action = 'login', username, password, oldPassword, newPassword } = body;

  if (action === 'login') {
    if (!username?.trim() || !password?.trim()) {
      return Response.json({ error: '请输入用户名和密码' }, { status: 400 });
    }

    const user = verifyUserCredentials(username, password);
    if (!user) {
      return Response.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const session = createSession(user.id, 7);
    if (!session) {
      return Response.json({ error: '登录会话创建失败' }, { status: 500 });
    }

    const signedToken = await signSession({
      uid: user.id,
      username: user.username,
      role: user.role,
      tokenId: session.token,
      exp: session.expiresAt
    });

    const isProd = process.env.NODE_ENV === 'production';
    const cookieHeader = `radar_session=${signedToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${isProd ? '; Secure' : ''}`;

    return Response.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      },
      {
        headers: { 'Set-Cookie': cookieHeader }
      }
    );
  }

  if (action === 'logout') {
    const rawToken = getSessionToken(request);
    if (rawToken) {
      const verified = await verifySession(rawToken);
      if (verified?.tokenId) {
        destroySession(verified.tokenId);
      } else {
        destroySession(rawToken);
      }
    }
    return Response.json(
      { success: true },
      {
        headers: {
          'Set-Cookie': 'radar_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
        }
      }
    );
  }

  if (action === 'change_password') {
    const user = await getSessionUser(request);
    if (!user) {
      return Response.json({ error: '请先登录' }, { status: 401 });
    }

    if (!oldPassword || !newPassword) {
      return Response.json({ error: '原密码和新密码不能为空' }, { status: 400 });
    }

    try {
      changeUserPassword(user.id, oldPassword, newPassword);
      return Response.json({ success: true, message: '密码修改成功' });
    } catch (err) {
      return Response.json({ error: err.message || '修改密码失败' }, { status: 400 });
    }
  }

  return Response.json({ error: '未知操作' }, { status: 400 });
}
