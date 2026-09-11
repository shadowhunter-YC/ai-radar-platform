import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { normalizeUrl, isPublicAddress, extractArticle, extractFeed } from '../lib/collection-fetch.mjs';
process.env.COLLECTION_DATA_DIR = path.join(process.cwd(), 'data', `test-${randomUUID()}`);
const db = await import('../lib/collection-store.mjs');
test('禁止内网、保留IP、凭据和非HTTPS地址', () => {
  for (const address of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1','224.0.0.1']) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  for (const url of ['http://example.com','https://user:pass@example.com','file:///tmp/test','https://example.com:8443']) assert.throws(()=>normalizeUrl(url));
});
test('HTML提取去除脚本并保留真实日期，RSS去重限三篇', () => {
  const html = `<html><head><title>真实文章</title><meta property="article:published_time" content="2026-09-10T00:00:00Z"></head><body><nav>不要采集</nav><article><h1>文章</h1><p>${'用于验证正文提取。'.repeat(50)}</p><script>danger()</script></article></body></html>`;
  const article = extractArticle(Buffer.from(html), 'https://example.com/article');
  assert.equal(article.publishedAt,'2026-09-10T00:00:00.000Z'); assert.ok(!article.text.includes('danger')); assert.ok(!article.text.includes('不要采集'));
  assert.throws(()=>extractArticle(Buffer.from('<title>Just a moment</title>'),'https://example.com'));
  const rss = '<rss><channel>'+[1,1,2,3,4].map(id=>`<item><title>文章${id}</title><link>https://example.com/${id}</link></item>`).join('')+'</channel></rss>';
  assert.deepEqual(extractFeed(Buffer.from(rss),'https://example.com/feed').map(e=>e.url),[1,2,3].map(n=>`https://example.com/${n}`));
  const atom='<feed><entry><title>Atom</title><link rel="alternate" href="https://example.com/atom"/></entry></feed>';
  assert.equal(extractFeed(Buffer.from(atom),'https://example.com/feed')[0].url,'https://example.com/atom');
});
test('冷却持久化、草稿不自动入库、重复保存幂等', () => {
  db.claimHost('example.com',1000000); assert.throws(()=>db.claimHost('example.com',1000001)); db.claimHost('example.com',1600000);
  const body={title:'文章',url:'https://example.com/1',text:'正文'.repeat(200),source:'example.com',kind:'web',publishedAt:null,collectedAt:new Date().toISOString()};
  const d=db.addDraft(body); assert.equal(db.addDraft(body).id,d.id); assert.equal(db.importedArticles().length,0); assert.throws(()=>db.confirmDraft(d.id));
  db.setAnalysis(d.id,{summary:'摘要',category:'产品动态',tags:['AI'],impact:'AI分析',action:'建议',model:'test'});
  const id=db.confirmDraft(d.id); assert.equal(db.confirmDraft(d.id),id); assert.equal(db.importedArticles().length,1); assert.ok(id>=1000000001); assert.equal(db.importedArticles()[0].dateIsCollection,true);
});
test('日报服务端持久化增删查', () => {
  const report = db.saveReport({
    title: 'AI安全测试日报',
    content: '# 测试内容',
    sources: [{ number: 1, title: '文章' }],
    mode: 'auto',
    model: 'deepseek',
    preferences: { focus: 'compliance' }
  });
  assert.ok(report?.id);
  assert.equal(report.title, 'AI安全测试日报');
  assert.equal(report.content, '# 测试内容');
  assert.equal(report.sources.length, 1);
  assert.equal(report.preferences.focus, 'compliance');
  const fetched = db.getReport(report.id);
  assert.equal(fetched.id, report.id);
  const list = db.listReports(10);
  assert.ok(list.some(r => r.id === report.id));
  const deleted = db.deleteReport(report.id);
  assert.equal(deleted, true);
  assert.equal(db.getReport(report.id), null);
});
test('RSS 订阅源增删改查与官方预置', () => {
  const feeds = db.listRssFeeds();
  assert.ok(feeds.length >= 6, '默认自动初始化官方精选源');
  assert.ok(feeds.some(f => f.name.includes('CISA') && f.filterKeywords.includes('AI')));

  const custom = db.saveRssFeed({
    name: '测试合规源',
    url: 'https://example.com/rss.xml',
    category: '监管政策',
    filterKeywords: '合规,安全',
    enabled: 1
  });
  assert.ok(custom.id);
  assert.equal(custom.name, '测试合规源');

  const toggled = db.toggleRssFeed(custom.id, 0);
  assert.equal(toggled.enabled, 0);

  const deleted = db.deleteRssFeed(custom.id);
  assert.equal(deleted, true);
  assert.equal(db.getRssFeed(custom.id), null);
});
