import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

process.env.COLLECTION_DATA_DIR = path.join(process.cwd(), 'data', `test-sources-${randomUUID()}`);
const { GET, POST, DELETE } = await import('../app/api/sources/route.js');

test('/api/sources REST API 增删改查及预置恢复', async () => {
  // 1. GET
  const getRes = await GET();
  assert.equal(getRes.status, 200);
  const { sources } = await getRes.json();
  assert.ok(Array.isArray(sources));
  assert.ok(sources.length >= 6);

  // 2. POST save (new feed)
  const addReq = new Request('http://localhost/api/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'save',
      feed: {
        name: '自定义测试合规源',
        url: 'https://test-compliance.org/feed',
        category: '监管政策',
        filterKeywords: 'AI, 合规'
      }
    })
  });
  const addRes = await POST(addReq);
  assert.equal(addRes.status, 200);
  const { feed } = await addRes.json();
  assert.equal(feed.name, '自定义测试合规源');
  assert.equal(feed.category, '监管政策');

  // 3. POST toggle
  const toggleReq = new Request('http://localhost/api/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'toggle',
      id: feed.id,
      enabled: 0
    })
  });
  const toggleRes = await POST(toggleReq);
  assert.equal(toggleRes.status, 200);
  const toggled = await toggleRes.json();
  assert.equal(toggled.feed.enabled, 0);

  // 4. DELETE
  const delReq = new Request(`http://localhost/api/sources?id=${feed.id}`, { method: 'DELETE' });
  const delRes = await DELETE(delReq);
  assert.equal(delRes.status, 200);
  const delData = await delRes.json();
  assert.equal(delData.success, true);

  // 5. POST reset
  const resetReq = new Request('http://localhost/api/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset' })
  });
  const resetRes = await POST(resetReq);
  assert.equal(resetRes.status, 200);
  const resetData = await resetRes.json();
  assert.ok(resetData.sources.length >= 6);
});
