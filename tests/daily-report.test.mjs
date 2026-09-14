import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_PREFERENCES, filterReportArticles, readSSE, safeSourceUrl } from '../lib/daily-report.mjs';

const articles = [
  { id: 1, title: '新闻甲', publishedAt: '2026-09-10T00:00:00Z', intelligenceType: '安全事件', tags: ['Agent'], summary: '摘要甲', url: 'https://example.com/1' },
  { id: 2, title: '新闻乙', publishedAt: '2026-09-09T23:00:00Z', intelligenceType: '产品动态', tags: ['Agent', '模型'], summary: '摘要乙' },
  { id: 3, title: '新闻丙', publishedAt: '2026-09-01T00:00:00Z', intelligenceType: '安全事件', tags: ['模型'], summary: '摘要丙' }
];
test('分类与标签交集、同组并集、24小时及北京时间日期', () => {
  const p = { ...DEFAULT_PREFERENCES, period: 'all', types: ['安全事件'], tags: ['Agent', '其他'] };
  assert.deepEqual(filterReportArticles(articles, p).map(a => a.id), [1]);
  assert.deepEqual(filterReportArticles(articles, DEFAULT_PREFERENCES, Date.parse('2026-09-10T06:00:00Z')).map(a => a.id), [1, 2]);
  assert.deepEqual(filterReportArticles(articles, { ...DEFAULT_PREFERENCES, period: 'date', date: '2026-09-10' }).map(a => a.id), [1, 2]);
  assert.equal(filterReportArticles(articles, { ...DEFAULT_PREFERENCES, period: 'date', date: '' }).length, 0);
  assert.equal(filterReportArticles(articles, DEFAULT_PREFERENCES, Date.parse('2026-10-01')).length, 0);
});
test('SSE解析兼容分字节中文、CRLF及无末尾换行', async () => {
  const bytes = new TextEncoder().encode('data: {"text":"日报"}\r\n\r\ndata: [DONE]');
  const body = new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } });
  const events = []; for await (const line of readSSE(body)) events.push(line);
  assert.deepEqual(events, ['{"text":"日报"}', '[DONE]']);
  assert.equal(safeSourceUrl('javascript:alert(1)'), null);
});
test('每日AI早报偏好：博主匹配、重点法案匹配与智能加权排序', async () => {
  const { DEFAULT_MORNING_PREFERENCES, matchBlogger, matchLegislation, filterReportArticles } = await import('../lib/daily-report.mjs');
  assert.ok(Array.isArray(DEFAULT_MORNING_PREFERENCES.trackedBloggers));
  assert.ok(DEFAULT_MORNING_PREFERENCES.trackedBloggers.includes('Sam Altman'));
  assert.ok(DEFAULT_MORNING_PREFERENCES.trackedLegislation.includes('EU AI Act'));

  const sampleArticles = [
    { id: 101, title: '常规AI模型发布', publishedAt: '2026-09-10T12:00:00Z', intelligenceType: '行业动态', tags: ['模型'], summary: '普通资讯' },
    { id: 102, title: 'Sam Altman 谈最新超级对齐防线', publishedAt: '2026-09-10T08:00:00Z', intelligenceType: '行业动态', tags: ['安全'], summary: '关于大模型越狱防御的论述' },
    { id: 103, title: '欧盟最新落实 EU AI Act 高风险分类细则', publishedAt: '2026-09-10T06:00:00Z', intelligenceType: '法规政策', tags: ['合规'], summary: '针对高风险系统的强制核查' }
  ];

  // 匹配测试
  assert.equal(matchBlogger(sampleArticles[1], ['Sam Altman', 'Yann LeCun']), 'Sam Altman');
  assert.equal(matchBlogger(sampleArticles[0], ['Sam Altman']), null);
  assert.equal(matchLegislation(sampleArticles[2], ['EU AI Act', 'NIST']), 'EU AI Act');
  assert.equal(matchLegislation(sampleArticles[0], ['EU AI Act']), null);

  // 偏好筛选与加权排序测试：命中博主/法案的资讯优先排在前面，即便时间较早
  const filtered = filterReportArticles(sampleArticles, {
    period: 'all',
    trackedBloggers: ['Sam Altman'],
    trackedLegislation: ['EU AI Act']
  });

  // 102 (命中博主) 和 103 (命中法案) 得分加权高于未命中的 101
  assert.equal(filtered[0].id, 102);
  assert.equal(filtered[1].id, 103);
  assert.equal(filtered[2].id, 101);
  assert.equal(filtered[0]._matchedBlogger, 'Sam Altman');
  assert.equal(filtered[1]._matchedLegislation, 'EU AI Act');
});
test('真实路由处理：校验、密钥保护、选定素材、完成及中断', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SILICONFLOW_API_KEY;
  const originalModel = process.env.SILICONFLOW_MODEL;
  globalThis.__dailyTestArticles = articles;
  const helperUrl = new URL('../lib/daily-report.mjs', import.meta.url).href;
  const source = (await readFile(new URL('../app/api/reports/route.js', import.meta.url), 'utf8'))
    .replace("import { getArticles } from '@/lib/repository';", 'const getArticles = async () => ({ data: globalThis.__dailyTestArticles, mode: "mock" });')
    .replace(/import\s*\{[^}]*\}\s*from\s*['"]@\/lib\/collection-store\.mjs['"];?/, 'const saveReport = r => ({ id: 1, ...r }); const listReports = () => []; const deleteReport = () => true; const getLlmConfig = () => ({ provider: "siliconflow", baseUrl: (process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1").replace(/\\/+$/, ""), apiKey: process.env.SILICONFLOW_API_KEY?.trim() || "", model: process.env.SILICONFLOW_MODEL || "deepseek-ai/DeepSeek-V4-Pro", configured: Boolean(process.env.SILICONFLOW_API_KEY?.trim()) });')
    .replace("'@/lib/daily-report.mjs'", JSON.stringify(helperUrl));
  const { POST, GET } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const request = (input, headers = {}) => new Request('http://localhost/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(input) });
  const input = { articleIds: [1], style: 'brief', mode: 'mock' };
  const events = async response => { const result = []; for await (const line of readSSE(response.body)) result.push(JSON.parse(line)); return result; };
  try {
    delete process.env.SILICONFLOW_API_KEY;
    assert.equal((await GET()).status, 200);
    assert.equal((await (await GET()).json()).configured, false);
    assert.equal((await POST(request(input))).status, 503);
    assert.equal((await POST(request(input, { host: '127.0.0.1:3100', origin: 'http://127.0.0.1:3100' }))).status, 503);
    assert.equal((await POST(request(input, { host: '127.0.0.1:3100', origin: 'https://untrusted.example' }))).status, 403);
    assert.equal((await POST(request({ ...input, articleIds: [] }))).status, 400);
    assert.equal((await POST(request({ ...input, articleIds: Array(31).fill(1) }))).status, 400);
    assert.equal((await POST(request(input, { origin: 'https://untrusted.example' }))).status, 403);
    process.env.SILICONFLOW_API_KEY = 'test-secret-never-return';
    process.env.SILICONFLOW_MODEL = 'deepseek-ai/DeepSeek-V4-Pro';
    assert.equal((await POST(request({ ...input, mode: 'postgres' }))).status, 409);
    assert.equal((await POST(request({ ...input, articleIds: [999] }))).status, 409);
    let sent;
    globalThis.fetch = async (url, options) => { sent = JSON.parse(options.body); return new Response('data: {"choices":[{"delta":{"content":"今日概览：新闻甲[1]"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'); };
    assert.equal((await POST(request({ ...input, mode: 'auto' }))).status, 200);
    const success = await events(await POST(request(input)));
    assert.equal(success.at(-1).type, 'complete');
    assert.equal(success[0].sources.length, 1);
    assert.equal(sent.model, 'deepseek-ai/DeepSeek-V4-Pro');
    assert.equal(JSON.parse(sent.messages[1].content).materials.length, 1);
    assert.equal(JSON.stringify(success).includes('test-secret'), false);
    globalThis.fetch = async () => new Response('data: {"choices":[{"delta":{"content":"部分正文"}}]}\n\n');
    assert.equal((await events(await POST(request(input)))).at(-1).type, 'error');
    globalThis.fetch = async () => new Response('data: {"choices":[{"delta":{"content":"截断正文"},"finish_reason":"length"}]}\n\n');
    assert.equal((await events(await POST(request(input)))).at(-1).type, 'error');
    globalThis.fetch = async () => new Response('upstream private error', { status: 401 });
    const failure = await POST(request(input));
    assert.equal(failure.status, 502);
    assert.match((await failure.json()).error, /Key/);
  } finally {
    globalThis.fetch = originalFetch; delete globalThis.__dailyTestArticles;
    if (originalKey === undefined) delete process.env.SILICONFLOW_API_KEY; else process.env.SILICONFLOW_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.SILICONFLOW_MODEL; else process.env.SILICONFLOW_MODEL = originalModel;
  }
});
