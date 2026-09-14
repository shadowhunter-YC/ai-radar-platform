import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  isTweetSource,
  cleanTweetHtml,
  extractTwitterHandle,
  parseTweetDraftPayload
} from '../lib/tweet-parser.mjs';

test('isTweetSource 准确识别各类 X/Twitter 链接与信源', () => {
  assert.equal(isTweetSource('https://x.com/elonmusk/status/123456'), true);
  assert.equal(isTweetSource('https://twitter.com/sama/status/7890'), true);
  assert.equal(isTweetSource('https://rss.wilsongo.top/twitter/user/elonmusk'), true);
  assert.equal(isTweetSource('https://example.com', 'X (@elonmusk)'), true);
  assert.equal(isTweetSource('https://genai.owasp.org/feed'), false);
  assert.equal(isTweetSource('https://mp.weixin.qq.com/s/123'), false);
});

test('cleanTweetHtml 完整保留引用与回复的结构化换行', () => {
  const html = '<p>yes</p><br><br><blockquote><p><a href="https://x.com/GaryMarcus">@GaryMarcus</a>: Open AI safety benchmarks must be audited independently.</p></blockquote>';
  const cleaned = cleanTweetHtml(html);
  assert.ok(cleaned.includes('yes'));
  assert.ok(cleaned.includes('@GaryMarcus: Open AI safety benchmarks must be audited independently.'));
});

test('extractTwitterHandle 从 URL 与信源中准确提取博主用户名', () => {
  assert.equal(extractTwitterHandle('https://x.com/elonmusk/status/123456'), 'elonmusk');
  assert.equal(extractTwitterHandle('https://twitter.com/sama/status/789'), 'sama');
  assert.equal(extractTwitterHandle('https://rss.wilsongo.top/twitter/user/AnthropicAI'), 'AnthropicAI');
  assert.equal(extractTwitterHandle('', 'X (@ylecun)'), 'ylecun');
});

test('parseTweetDraftPayload 处理“yes”等极简回复推文：提炼上下文与规范标题', () => {
  const payload = parseTweetDraftPayload({
    rawTitle: 'yes',
    rawContent: '<p>yes</p><br><br>Re @GaryMarcus: AI safety benchmarks should be audited independently before deployment.',
    url: 'https://x.com/elonmusk/status/20987654321',
    source: 'X (@elonmusk)'
  });

  assert.notEqual(payload.title, 'yes');
  assert.ok(payload.title.includes('@elonmusk'));
  assert.ok(payload.title.includes('yes'));
  assert.ok(payload.title.includes('AI safety benchmarks'));
  assert.equal(payload.source, 'X (@elonmusk)');
  assert.ok(payload.text.includes('【推特信源】@elonmusk'));
  assert.ok(payload.text.includes('【被回复推文议题】'));
  assert.equal(payload.isTrivial, true);
});

test('parseTweetDraftPayload 对完整实质性推文保留原义并清理前缀', () => {
  const payload = parseTweetDraftPayload({
    rawTitle: 'RT @OpenAI: We are introducing new guardrails for autonomous data agents.',
    rawContent: 'We are introducing new guardrails for autonomous data agents.',
    url: 'https://x.com/OpenAI/status/2098123456',
    source: 'X (@OpenAI)'
  });

  assert.equal(payload.title, 'We are introducing new guardrails for autonomous data agents.');
  assert.equal(payload.source, 'X (@OpenAI)');
});

test('confirmDraft 深度集成：优先采纳 AI 总结的专业标题，杜绝极简词落库', async () => {
  const { store, addDraft, setAnalysis, confirmDraft, importedArticles } = await import('../lib/collection-store.mjs');
  store();

  // 场景 1: 草稿原标题为 "yes"，AI 研判输出了深度总结标题
  const draft1 = addDraft({
    title: 'yes',
    url: `https://x.com/elonmusk/status/${randomUUID()}`,
    text: '推文全文：yes Re @GaryMarcus: AI安全评测标准',
    source: 'X (@elonmusk)',
    kind: 'rss-feed',
    publishedAt: null,
    collectedAt: new Date().toISOString()
  });

  setAnalysis(draft1.id, {
    title: '马斯克回应 Gary Marcus：赞同前沿模型必须实施独立安全审计',
    isRelevant: true,
    intelligenceType: '法规政策',
    summary: '马斯克简短回复赞同 Gary Marcus 提出的独立安全审计倡议。',
    tags: ['马斯克', '安全审计', '前沿模型'],
    impact: '合规监管与第三方安全审计讨论升温',
    action: '企业应提前准备大模型安全评测底稿',
    model: 'test-model'
  });

  const articleId1 = confirmDraft(draft1.id);
  const articles = importedArticles();
  const saved1 = articles.find(a => a.id === articleId1);

  assert.ok(saved1);
  assert.equal(saved1.title, '马斯克回应 Gary Marcus：赞同前沿模型必须实施独立安全审计');
  assert.notEqual(saved1.title, 'yes');

  // 场景 2: 原标题为 "yes"，但 AI 分析未提供 title，根据 summary 自动安全提炼
  const draft2 = addDraft({
    title: 'yes',
    url: `https://x.com/sama/status/${randomUUID()}`,
    text: 'yes',
    source: 'X (@sama)',
    kind: 'rss-feed',
    publishedAt: null,
    collectedAt: new Date().toISOString()
  });

  setAnalysis(draft2.id, {
    isRelevant: true,
    intelligenceType: '安全产品突破',
    summary: '山姆·奥特曼就下一代模型对齐安全防护发表肯定回应。',
    tags: ['OpenAI', '模型对齐'],
    impact: '产品安全演进',
    action: '关注官方更新',
    model: 'test-model'
  });

  const articleId2 = confirmDraft(draft2.id);
  const saved2 = importedArticles().find(a => a.id === articleId2);

  assert.ok(saved2);
  assert.notEqual(saved2.title, 'yes');
  assert.ok(saved2.title.includes('山姆·奥特曼'));
});

test('isTweetSource 识别 X 关键词搜索流与热点议题信源', () => {
  assert.equal(isTweetSource('https://rss.wilsongo.top/twitter/keyword/(%22AI%20safety%22)%20min_faves%3A50'), true);
  assert.equal(isTweetSource('https://rss.wilsongo.top/twitter/search/AI%20regulation'), true);
  assert.equal(isTweetSource('https://example.com/stream', 'X热点: AI安全'), true);
  assert.equal(isTweetSource('https://example.com/stream', 'X/Twitter 热点搜索流'), true);
});

test('OFFICIAL_PRESET_FEEDS 包含 X 平台热点议题预置源', async () => {
  const { OFFICIAL_PRESET_FEEDS } = await import('../lib/collection-store.mjs');
  const safetyPreset = OFFICIAL_PRESET_FEEDS.find(f => f.id === 'preset-x-hot-safety');
  const slowdownPreset = OFFICIAL_PRESET_FEEDS.find(f => f.id === 'preset-x-hot-slowdown');

  assert.ok(safetyPreset, '必须包含 preset-x-hot-safety 预置源');
  assert.ok(safetyPreset.url.includes('/twitter/keyword/'));
  assert.ok(safetyPreset.url.includes('min_faves'));

  assert.ok(slowdownPreset, '必须包含 preset-x-hot-slowdown 预置源');
  assert.ok(slowdownPreset.url.includes('/twitter/keyword/'));
  assert.ok(slowdownPreset.description.includes('Dario'));
});

test('CURATED_TWITTER_RECOMMENDATIONS 精选热点议题与领袖推荐完整', async () => {
  const { CURATED_TWITTER_RECOMMENDATIONS } = await import('../lib/tweet-parser.mjs');
  assert.ok(Array.isArray(CURATED_TWITTER_RECOMMENDATIONS.topics));
  assert.ok(CURATED_TWITTER_RECOMMENDATIONS.topics.length >= 5);
  assert.ok(CURATED_TWITTER_RECOMMENDATIONS.topics.some(t => t.name.includes('AI安全') || t.query.includes('AI safety')));
  assert.ok(CURATED_TWITTER_RECOMMENDATIONS.topics.some(t => t.name.includes('减速') || t.query.includes('Dario')));

  assert.ok(Array.isArray(CURATED_TWITTER_RECOMMENDATIONS.leaders));
  assert.ok(CURATED_TWITTER_RECOMMENDATIONS.leaders.length >= 7);
  assert.ok(CURATED_TWITTER_RECOMMENDATIONS.leaders.some(l => l.handle === 'DarioAmodei'));
  assert.ok(CURATED_TWITTER_RECOMMENDATIONS.leaders.some(l => l.handle === 'sama'));
  assert.ok(CURATED_TWITTER_RECOMMENDATIONS.leaders.some(l => l.handle === 'elonmusk'));
});

