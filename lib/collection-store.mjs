import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
let db;
export function store() {
  if (db) return db;
  const dir = process.env.COLLECTION_DATA_DIR || path.join(process.cwd(), 'data');
  mkdirSync(dir, { recursive: true }); db = new DatabaseSync(path.join(dir, 'collection.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY, url TEXT UNIQUE, body TEXT NOT NULL, analysis TEXT, article_id INTEGER);
    CREATE TABLE IF NOT EXISTS imported(id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT UNIQUE, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts(host TEXT PRIMARY KEY, started INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, created TEXT, body TEXT);`);
  return db;
}
export function getDraft(id) { const row = store().prepare('SELECT * FROM drafts WHERE id=?').get(id); return row && { ...JSON.parse(row.body), id: row.id, analysis: row.analysis ? JSON.parse(row.analysis) : null, articleId: row.article_id }; }
export function cachedDraft(url) { const row = store().prepare('SELECT id FROM drafts WHERE url=?').get(url); return row ? getDraft(row.id) : null; }
export function addDraft(body) {
  const existing = cachedDraft(body.url); if (existing) return existing;
  const id = randomUUID(); store().prepare('INSERT INTO drafts(id,url,body) VALUES(?,?,?)').run(id, body.url, JSON.stringify(body)); return getDraft(id);
}
export function setAnalysis(id, value) { store().prepare('UPDATE drafts SET analysis=? WHERE id=?').run(JSON.stringify(value), id); return getDraft(id); }
export function claimHost(host, now = Date.now()) {
  const result = store().prepare('INSERT INTO attempts(host,started) VALUES(?,?) ON CONFLICT(host) DO UPDATE SET started=excluded.started WHERE attempts.started<=?').run(host, now, now - 600000);
  if (!result.changes) throw new Error('该来源正在10分钟冷却期内。请稍后再试，或使用已缓存的文章。');
}
export function logRun(body) { store().prepare('INSERT INTO runs VALUES(?,?,?)').run(randomUUID(), new Date().toISOString(), JSON.stringify(body)); }
export function recentRuns() { return store().prepare('SELECT created,body FROM runs ORDER BY created DESC LIMIT 10').all().map(r => ({ createdAt: r.created, ...JSON.parse(r.body) })); }
export function importedArticles() { return store().prepare('SELECT id,body FROM imported ORDER BY id DESC LIMIT 100').all().map(r => ({ ...JSON.parse(r.body), id: r.id + 1000000000 })); }
export function confirmDraft(id) {
  const d = getDraft(id); if (!d?.analysis) throw new Error('请先完成AI分析再入库。');
  const a = d.analysis;
  const body = { title: d.title, source: d.source, sourceType: d.kind === 'paste' ? '用户提供' : '公开网页', url: d.kind === 'paste' ? '' : d.url,
    publishedAt: d.publishedAt || d.collectedAt, dateIsCollection: !d.publishedAt, collectedAt: d.collectedAt, originalExcerpt: d.text,
    summary: a.summary, intelligenceType: a.category, tags: a.tags, impact: a.impact, recommendedAction: a.action, insight: a.impact,
    region: 'Global', countryCode: 'GLOBAL', riskLevel: '待评估', credibilityScore: 85, aiGeneratedScore: 15, watermarkStatus: 'unsupported', lat: 0, lng: 0,
    credibilitySignals: [], provenance: d.kind, verification: '未核验', model: a.model };
  store().prepare('INSERT OR IGNORE INTO imported(url,body) VALUES(?,?)').run(d.url, JSON.stringify(body));
  const row = store().prepare('SELECT id FROM imported WHERE url=?').get(d.url);
  const articleId = row.id + 1000000000; store().prepare('UPDATE drafts SET article_id=? WHERE id=?').run(articleId, id); return articleId;
}
