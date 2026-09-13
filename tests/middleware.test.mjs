import test from 'node:test';
import assert from 'node:assert/strict';
import { middleware } from '../middleware.js';
import { signSession } from '../lib/auth-token.mjs';

test('Middleware: 静态资源与认证接口直接放行', async () => {
  const staticReq = new Request('http://localhost/_next/static/chunks/main.js');
  const staticRes = await middleware(staticReq);
  assert.equal(staticRes.status, 200);

  const authReq = new Request('http://localhost/api/auth');
  const authRes = await middleware(authReq);
  assert.equal(authRes.status, 200);
});

test('Middleware: 未登录访问受保护页面重定向到 /login', async () => {
  const req = new Request('http://localhost/');
  const res = await middleware(req);
  assert.equal(res.status, 307);
  assert.equal(res.headers.get('location'), 'http://localhost/login');

  const subReq = new Request('http://localhost/sources');
  const subRes = await middleware(subReq);
  assert.equal(subRes.status, 307);
  assert.equal(subRes.headers.get('location'), 'http://localhost/login?from=%2Fsources');
});

test('Middleware: 未登录访问受保护 API 返回 401', async () => {
  const req = new Request('http://localhost/api/sources');
  const res = await middleware(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, '未授权，请先登录系统');
});

test('Middleware: 已登录访问登录页重定向至首页，访问其他页面正常放行', async () => {
  const validToken = await signSession({
    uid: 1,
    username: 'admin',
    role: 'admin',
    tokenId: 'test-token',
    exp: Date.now() + 3600 * 1000
  });

  const loginReq = new Request('http://localhost/login', {
    headers: { Cookie: `radar_session=${validToken}` }
  });
  const loginRes = await middleware(loginReq);
  assert.equal(loginRes.status, 307);
  assert.equal(loginRes.headers.get('location'), 'http://localhost/');

  const authedHomeReq = new Request('http://localhost/', {
    headers: { Cookie: `radar_session=${validToken}` }
  });
  const authedHomeRes = await middleware(authedHomeReq);
  assert.equal(authedHomeRes.status, 200);
});
