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

test('Parser: parseLlmJson 兼容 Markdown 代码块反引号与前后杂质文本', async () => {
  const { parseLlmJson } = await import('../lib/collection-store.mjs');
  
  // 1. 标准 JSON
  assert.deepEqual(parseLlmJson('{"key": "value"}'), { key: 'value' });

  // 2. 带 ```json ... ``` 反引号的典型模型输出
  const fenced = '```json\n{\n  "title": "测试研判",\n  "severity": "重大"\n}\n```';
  assert.deepEqual(parseLlmJson(fenced), { title: '测试研判', severity: '重大' });

  // 3. 前后带自然语言问候的输出
  const wrapped = '您好，以下是为您生成的研判结果：\n```json\n{"isRelevant": true}\n```\n希望对您有帮助！';
  assert.deepEqual(parseLlmJson(wrapped), { isRelevant: true });

  // 4. 非法输入安全返回 null
  assert.equal(parseLlmJson(''), null);
  assert.equal(parseLlmJson(null), null);
  assert.equal(parseLlmJson('not json at all'), null);
});

test('DailyReport: getRecommendedReportArticles 智能降级与保底推荐', async () => {
  const { getRecommendedReportArticles } = await import('../lib/daily-report.mjs');
  const now = Date.now();
  const testArticles = [
    { id: 1, title: '开源代码工具', publishedAt: new Date(now - 3600000).toISOString(), intelligenceType: 'GitHub开源' },
    { id: 2, title: '历史重大法规', publishedAt: new Date(now - 86400000 * 2).toISOString(), intelligenceType: '法规政策' }
  ];

  // 1. 当用户设置的分类不包含库内仅有的 24h 资讯时，智能放宽分类，确保获取到今天的文章
  const strictPrefs = {
    period: '24h',
    types: ['法规政策'], // 24h 内无此分类
    limit: 10
  };

  const recommended = getRecommendedReportArticles(testArticles, strictPrefs, now);
  assert.equal(recommended.length, 1);
  assert.equal(recommended[0].id, 1);
});
