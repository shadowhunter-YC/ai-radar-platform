import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  verifyUserCredentials,
  createSession,
  verifySessionToken,
  destroySession,
  changeUserPassword,
  getSetting,
  setSetting,
  getLlmConfig,
  store
} from '../lib/collection-store.mjs';

test('密码哈希与校验正常工作', () => {
  const { hash, salt } = hashPassword('myPassword123');
  assert.ok(hash && salt);
  assert.equal(verifyPassword('myPassword123', hash, salt), true);
  assert.equal(verifyPassword('wrongPassword', hash, salt), false);
});

test('默认管理员初始化与凭证校验', () => {
  const db = store();
  assert.ok(db, '数据库应就绪');
  const user = verifyUserCredentials('admin', 'admin123456');
  assert.ok(user, '默认管理员应能校验成功');
  assert.equal(user.username, 'admin');
  assert.equal(user.role, 'admin');

  const wrong = verifyUserCredentials('admin', 'badpass');
  assert.equal(wrong, null);
});

test('用户会话创建、校验与销毁', () => {
  const user = verifyUserCredentials('admin', 'admin123456');
  assert.ok(user);
  const session = createSession(user.id);
  assert.ok(session?.token);

  const verified = verifySessionToken(session.token);
  assert.ok(verified);
  assert.equal(verified.username, 'admin');

  destroySession(session.token);
  assert.equal(verifySessionToken(session.token), null);
});

test('系统设置与大模型自定义配置读写', () => {
  setSetting('test_key', { a: 1, b: 'hello' });
  const val = getSetting('test_key');
  assert.deepEqual(val, { a: 1, b: 'hello' });

  // 测试自定义 LLM 配置
  setSetting('llm_config', {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'sk-test-deepseek-key',
    model: 'deepseek-chat',
    temperature: 0.5
  });

  const config = getLlmConfig();
  assert.equal(config.provider, 'deepseek');
  assert.equal(config.baseUrl, 'https://api.deepseek.com/v1');
  assert.equal(config.apiKey, 'sk-test-deepseek-key');
  assert.equal(config.model, 'deepseek-chat');
  assert.equal(config.temperature, 0.5);
  assert.equal(config.configured, true);
});

test('/api/auth 与 /api/settings/llm 端到端鉴权流程', async () => {
  const { GET: authGet, POST: authPost } = await import('../app/api/auth/route.js');
  const { GET: llmGet, POST: llmPost } = await import('../app/api/settings/llm/route.js');

  // 1. 未登录时请求 /api/auth
  const unauthRes = await authGet(new Request('http://localhost/api/auth'));
  const unauthData = await unauthRes.json();
  assert.equal(unauthData.loggedIn, false);

  // 2. 未登录时请求 /api/settings/llm 拒绝 401
  const llmDeniedRes = await llmGet(new Request('http://localhost/api/settings/llm'));
  assert.equal(llmDeniedRes.status, 401);

  // 3. 错误密码登录
  const badLogin = await authPost(new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', username: 'admin', password: 'wrongpassword' })
  }));
  assert.equal(badLogin.status, 401);

  // 4. 正确密码登录
  const goodLogin = await authPost(new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', username: 'admin', password: 'admin123456' })
  }));
  assert.equal(goodLogin.status, 200);
  const setCookie = goodLogin.headers.get('set-cookie');
  assert.ok(setCookie?.includes('radar_session='));
  const match = setCookie.match(/radar_session=([^;]+)/);
  const sessionToken = match[1];

  // 5. 带 Cookie 验证 /api/auth
  const authedRes = await authGet(new Request('http://localhost/api/auth', {
    headers: { Cookie: `radar_session=${sessionToken}` }
  }));
  const authedData = await authedRes.json();
  assert.equal(authedData.loggedIn, true);
  assert.equal(authedData.user.username, 'admin');

  // 6. 带 Cookie 读取 /api/settings/llm
  const llmAuthedRes = await llmGet(new Request('http://localhost/api/settings/llm', {
    headers: { Cookie: `radar_session=${sessionToken}` }
  }));
  assert.equal(llmAuthedRes.status, 200);
  const llmData = await llmAuthedRes.json();
  assert.ok(llmData.hasApiKey);
  assert.ok(llmData.maskedApiKey.includes('****'));

  // 7. 保存新大模型配置
  const saveLlmRes = await llmPost(new Request('http://localhost/api/settings/llm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `radar_session=${sessionToken}`
    },
    body: JSON.stringify({
      action: 'save',
      provider: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-new-deepseek-api-key-999',
      model: 'deepseek-reasoner',
      temperature: 0.2
    })
  }));
  assert.equal(saveLlmRes.status, 200);
  const savedData = await saveLlmRes.json();
  assert.equal(savedData.success, true);
  assert.equal(savedData.config.model, 'deepseek-reasoner');

  // 7.5. 测试修改密码流程 (change_password)
  // 7.5.1 未登录时修改密码应返回 401
  const unauthChangeRes = await authPost(new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'change_password',
      oldPassword: 'admin123456',
      newPassword: 'newAdminPassword666'
    })
  }));
  assert.equal(unauthChangeRes.status, 401);

  // 7.5.2 登录状态下旧密码错误
  const wrongOldPassRes = await authPost(new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `radar_session=${sessionToken}`
    },
    body: JSON.stringify({
      action: 'change_password',
      oldPassword: 'wrongOldPassword',
      newPassword: 'newAdminPassword666'
    })
  }));
  assert.equal(wrongOldPassRes.status, 400);

  // 7.5.3 登录状态下成功修改为新密码
  const successChangeRes = await authPost(new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `radar_session=${sessionToken}`
    },
    body: JSON.stringify({
      action: 'change_password',
      oldPassword: 'admin123456',
      newPassword: 'newAdminPassword666'
    })
  }));
  assert.equal(successChangeRes.status, 200);
  const successChangeData = await successChangeRes.json();
  assert.equal(successChangeData.success, true);

  // 7.5.4 用旧密码登录应失败
  const oldLoginFail = await authPost(new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', username: 'admin', password: 'admin123456' })
  }));
  assert.equal(oldLoginFail.status, 401);

  // 7.5.5 用新密码登录应成功
  const newLoginSuccess = await authPost(new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', username: 'admin', password: 'newAdminPassword666' })
  }));
  assert.equal(newLoginSuccess.status, 200);

  // 7.5.6 恢复默认密码为 admin123456，避免污染后续测试与环境
  const resetPassRes = await authPost(new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `radar_session=${sessionToken}`
    },
    body: JSON.stringify({
      action: 'change_password',
      oldPassword: 'newAdminPassword666',
      newPassword: 'admin123456'
    })
  }));
  assert.equal(resetPassRes.status, 200);

  // 8. 退出登录
  const logoutRes = await authPost(new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `radar_session=${sessionToken}`
    },
    body: JSON.stringify({ action: 'logout' })
  }));
  assert.equal(logoutRes.status, 200);

  // 9. 登出后会话失效
  const postLogoutRes = await authGet(new Request('http://localhost/api/auth', {
    headers: { Cookie: `radar_session=${sessionToken}` }
  }));
  assert.equal((await postLogoutRes.json()).loggedIn, false);
});
