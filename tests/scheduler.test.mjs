import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import path from 'node:path';

const tempDir = path.join(process.cwd(), 'data-test-scheduler');
process.env.COLLECTION_DATA_DIR = tempDir;

const {
  store,
  saveRssFeed,
  isUrlImported
} = await import('../lib/collection-store.mjs');

const {
  getSchedulerConfig,
  saveSchedulerConfig,
  getSchedulerStatus,
  analyzeDraftWithLlm,
  runAutoCollection
} = await import('../lib/scheduler.mjs');

const schedulerRoute = await import('../app/api/scheduler/route.js');

test.beforeEach(() => {
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  store();
});

test.after(() => {
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('Scheduler: 默认配置读取与持久化更新', () => {
  const initial = getSchedulerConfig();
  assert.equal(initial.enabled, true);
  assert.equal(initial.intervalHours, 4);
  assert.equal(initial.autoAiAnalyze, true);
  assert.equal(initial.autoImportRelevant, true);

  const updated = saveSchedulerConfig({
    enabled: false,
    intervalHours: 6,
    autoImportRelevant: false
  });

  assert.equal(updated.enabled, false);
  assert.equal(updated.intervalHours, 6);
  assert.equal(updated.autoImportRelevant, false);

  const reloaded = getSchedulerConfig();
  assert.equal(reloaded.enabled, false);
  assert.equal(reloaded.intervalHours, 6);
  assert.equal(reloaded.autoImportRelevant, false);
});

test('Scheduler: analyzeDraftWithLlm 在未配置时安全返回 null', async () => {
  const res = await analyzeDraftWithLlm({ title: 'test', text: 'content' }, { configured: false });
  assert.equal(res, null);
});

test('Scheduler: isUrlImported 准确识别已入库 URL 防止重复消耗 Token', () => {
  const s = store();
  const testUrl = 'https://example.com/ai-security-article-1';
  assert.equal(isUrlImported(testUrl), false);

  s.prepare(`INSERT INTO imported(url, body) VALUES(?, ?)`).run(testUrl, JSON.stringify({ title: '测试文章' }));
  assert.equal(isUrlImported(testUrl), true);
});

test('Scheduler: GET /api/scheduler 返回状态信息', async () => {
  const res = await schedulerRoute.GET();
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.data);
  assert.equal(typeof data.data.config.intervalHours, 'number');
  assert.equal(typeof data.data.isCollecting, 'boolean');
});

test('Scheduler: POST /api/scheduler update_config 操作更新配置', async () => {
  const req = new Request('http://127.0.0.1:3000/api/scheduler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update_config',
      config: { intervalHours: 12, autoAiAnalyze: false }
    })
  });

  const res = await schedulerRoute.POST(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.config.intervalHours, 12);
  assert.equal(body.config.autoAiAnalyze, false);
});

test('Scheduler: POST /api/scheduler run 触发全源自动采集', async () => {
  const req = new Request('http://127.0.0.1:3000/api/scheduler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'run'
    })
  });

  const res = await schedulerRoute.POST(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.message.includes('已在后台启动'));
});
