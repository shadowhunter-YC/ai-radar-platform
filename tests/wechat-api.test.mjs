import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

process.env.COLLECTION_DATA_DIR = path.join(process.cwd(), 'data', `test-wechat-${randomUUID()}`);
process.env.WECHAT_RSS_BASE_URL = 'http://127.0.0.1:59999'; // Unreachable port for testing error fallback

const { GET, POST } = await import('../app/api/wechat/route.js');

test('/api/wechat GET handles unreachable backend gracefully', async () => {
  const req = new Request('http://localhost/api/wechat?action=qr');
  const res = await GET(req);
  assert.equal(res.status, 502);
  const data = await res.json();
  assert.ok(data.error);
});

test('/api/wechat POST subscribe fails gracefully when WeRSS unreachable', async () => {
  const req = new Request('http://localhost/api/wechat?action=subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'test_mp_id',
      name: '测试公众号',
      intro: '用于单元测试的微信公众号',
      filterKeywords: 'AI, 大模型, 安全'
    })
  });

  const res = await POST(req);
  assert.equal(res.status, 502);
  const data = await res.json();
  assert.ok(data.error);
});
