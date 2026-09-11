let DatabaseSync;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch { /* Node < 22 or unsupported env */ }
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
let db;
function migrateSchema(s) {
  s.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY, url TEXT UNIQUE, body TEXT NOT NULL, analysis TEXT, article_id INTEGER);
    CREATE TABLE IF NOT EXISTS imported(id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT UNIQUE, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts(host TEXT PRIMARY KEY, started INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, created TEXT, body TEXT);
    CREATE TABLE IF NOT EXISTS reports(
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      sources TEXT NOT NULL,
      mode TEXT,
      model TEXT,
      preferences TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);
    CREATE TABLE IF NOT EXISTS rss_feeds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      filter_keywords TEXT,
      enabled INTEGER DEFAULT 1,
      cadence TEXT DEFAULT '每天',
      last_fetched_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rss_category ON rss_feeds(category);
    CREATE INDEX IF NOT EXISTS idx_rss_enabled ON rss_feeds(enabled);
  `);
  try {
    const cols = s.prepare("PRAGMA table_info(imported)").all().map(c => c.name);
    const newCols = [
      ['title', 'TEXT'],
      ['source', 'TEXT'],
      ['source_type', 'TEXT'],
      ['category', 'TEXT'],
      ['published_at', 'TEXT'],
      ['collected_at', 'TEXT'],
      ['risk_level', 'TEXT'],
      ['summary', 'TEXT'],
      ['tags', 'TEXT']
    ];
    for (const [col, type] of newCols) {
      if (!cols.includes(col)) {
        try { s.exec(`ALTER TABLE imported ADD COLUMN ${col} ${type};`); } catch {}
      }
    }
    s.exec(`
      CREATE INDEX IF NOT EXISTS idx_imported_category ON imported(category);
      CREATE INDEX IF NOT EXISTS idx_imported_published ON imported(published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_imported_source ON imported(source);
    `);
  } catch {}
}

export function store() {
  if (db !== undefined) return db;
  if (!DatabaseSync) { db = null; return null; }
  try {
    const dir = process.env.COLLECTION_DATA_DIR || path.join(process.cwd(), 'data');
    mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(path.join(dir, 'collection.sqlite'));
    migrateSchema(db);
    return db;
  } catch { db = null; return null; }
}
export function getDraft(id) { const s = store(); if (!s) return null; const row = s.prepare('SELECT * FROM drafts WHERE id=?').get(id); return row && { ...JSON.parse(row.body), id: row.id, analysis: row.analysis ? JSON.parse(row.analysis) : null, articleId: row.article_id }; }
export function cachedDraft(url) { const s = store(); if (!s) return null; const row = s.prepare('SELECT id FROM drafts WHERE url=?').get(url); return row ? getDraft(row.id) : null; }
export function addDraft(body) {
  const existing = cachedDraft(body.url); if (existing) return existing;
  const s = store(); if (!s) return null;
  const id = randomUUID(); s.prepare('INSERT INTO drafts(id,url,body) VALUES(?,?,?)').run(id, body.url, JSON.stringify(body)); return getDraft(id);
}
export function setAnalysis(id, value) { const s = store(); if (!s) return null; s.prepare('UPDATE drafts SET analysis=? WHERE id=?').run(JSON.stringify(value), id); return getDraft(id); }
export function claimHost(host, now = Date.now()) {
  const s = store(); if (!s) throw new Error('数据库不可用。请稍后再试。');
  const result = s.prepare('INSERT INTO attempts(host,started) VALUES(?,?) ON CONFLICT(host) DO UPDATE SET started=excluded.started WHERE attempts.started<=?').run(host, now, now - 600000);
  if (!result.changes) throw new Error('该来源正在10分钟冷却期内。请稍后再试，或使用已缓存的文章。');
}
export function logRun(body) { const s = store(); if (!s) return; s.prepare('INSERT INTO runs VALUES(?,?,?)').run(randomUUID(), new Date().toISOString(), JSON.stringify(body)); }
export function recentRuns() { const s = store(); if (!s) return []; return s.prepare('SELECT created,body FROM runs ORDER BY created DESC LIMIT 10').all().map(r => ({ createdAt: r.created, ...JSON.parse(r.body) })); }
export function importedArticles() { const s = store(); if (!s) return []; return s.prepare('SELECT id,body FROM imported ORDER BY id DESC LIMIT 100').all().map(r => ({ ...JSON.parse(r.body), id: r.id + 1000000000 })); }
export function confirmDraft(id) {
  const d = getDraft(id); if (!d?.analysis) throw new Error('请先完成AI分析再入库。');
  const a = d.analysis;
  const body = { title: d.title, source: d.source, sourceType: d.kind === 'paste' ? '用户提供' : '公开网页', url: d.kind === 'paste' ? '' : d.url,
    publishedAt: d.publishedAt || d.collectedAt, dateIsCollection: !d.publishedAt, collectedAt: d.collectedAt, originalExcerpt: d.text,
    summary: a.summary, intelligenceType: a.category, tags: a.tags, impact: a.impact, recommendedAction: a.action, insight: a.impact,
    region: 'Global', countryCode: 'GLOBAL', riskLevel: '待评估', credibilityScore: 85, aiGeneratedScore: 15, watermarkStatus: 'unsupported', lat: 0, lng: 0,
    credibilitySignals: [], provenance: d.kind, verification: '未核验', model: a.model };
  const s = store(); if (!s) throw new Error('数据库不可用。请稍后再试。');
  s.prepare(`INSERT OR IGNORE INTO imported(url, title, source, source_type, category, published_at, collected_at, risk_level, summary, tags, body)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    d.url, body.title, body.source, body.sourceType, body.intelligenceType, body.publishedAt, body.collectedAt, body.riskLevel, body.summary, JSON.stringify(body.tags), JSON.stringify(body)
  );
  const row = s.prepare('SELECT id FROM imported WHERE url=?').get(d.url);
  const articleId = row.id + 1000000000; s.prepare('UPDATE drafts SET article_id=? WHERE id=?').run(articleId, id); return articleId;
}

export function saveReport({ id, createdAt, title, content, sources, mode, model, preferences }) {
  const s = store(); if (!s) return null;
  const reportId = String(id || randomUUID());
  const created = createdAt || new Date().toISOString();
  const sourcesStr = typeof sources === 'string' ? sources : JSON.stringify(sources || []);
  const prefsStr = typeof preferences === 'string' ? preferences : JSON.stringify(preferences || {});
  s.prepare(`INSERT OR REPLACE INTO reports(id, created_at, title, content, sources, mode, model, preferences)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?)`).run(reportId, created, title || '', content, sourcesStr, mode || 'auto', model || '', prefsStr);
  return getReport(reportId);
}

export function getReport(id) {
  const s = store(); if (!s) return null;
  const row = s.prepare('SELECT * FROM reports WHERE id=?').get(String(id));
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    title: row.title,
    content: row.content,
    sources: JSON.parse(row.sources || '[]'),
    mode: row.mode,
    model: row.model,
    preferences: JSON.parse(row.preferences || '{}')
  };
}

export function listReports(limit = 50) {
  const s = store(); if (!s) return [];
  return s.prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT ?').all(limit).map(row => ({
    id: row.id,
    createdAt: row.created_at,
    title: row.title,
    content: row.content,
    sources: JSON.parse(row.sources || '[]'),
    mode: row.mode,
    model: row.model,
    preferences: JSON.parse(row.preferences || '{}')
  }));
}

export function deleteReport(id) {
  const s = store(); if (!s) return false;
  const res = s.prepare('DELETE FROM reports WHERE id=?').run(String(id));
  return res.changes > 0;
}

export const OFFICIAL_PRESET_FEEDS = [
  {
    id: 'preset-cisa-alerts',
    name: 'CISA Cybersecurity Alerts',
    url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
    category: '监管政策',
    description: '美国CISA官方安全通报（已配置AI关键词门禁，过滤非AI常规漏洞）',
    filterKeywords: 'AI, Artificial Intelligence, Machine Learning, LLM, Generative AI, Deepfake, 算法, 人工智能, 大模型',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-nist-ai',
    name: 'NIST AI News & Updates',
    url: 'https://www.nist.gov/news-events/news/rss.xml',
    category: '监管政策',
    description: '美国国家标准技术研究所AI治理与风险管理框架动态',
    filterKeywords: 'AI, Artificial Intelligence, Machine Learning, RMF, LLM, Model, Safety, 治理, 风控',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-owasp-genai',
    name: 'OWASP GenAI Security Project',
    url: 'https://genai.owasp.org/feed/',
    category: 'AI安全',
    description: 'OWASP大语言模型安全Top 10与应用攻防指引官方动态',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-trail-of-bits',
    name: 'Trail of Bits Security Research',
    url: 'https://blog.trailofbits.com/feed/',
    category: 'AI安全',
    description: '顶尖安全研究团队大模型攻防与代码安全分析',
    filterKeywords: 'AI, Machine Learning, LLM, Neural, Model, Prompt, Agent, Security',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-openai',
    name: 'OpenAI Newsroom',
    url: 'https://openai.com/news/rss.xml',
    category: '头部厂商',
    description: 'OpenAI官方新闻、产品发布与模型安全政策',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-anthropic',
    name: 'Anthropic News',
    url: 'https://www.anthropic.com/feed',
    category: '头部厂商',
    description: 'Anthropic Claude模型更新、安全研究与对齐政策',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-google-security',
    name: 'Google Online Security Blog',
    url: 'https://feeds.feedburner.com/GoogleOnlineSecurityBlog',
    category: '头部厂商',
    description: '谷歌安全团队官方技术博客（已配置AI安全过滤）',
    filterKeywords: 'AI, LLM, Gemini, Machine Learning, Artificial Intelligence, Model, Deepfake',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-microsoft-security',
    name: 'Microsoft Security Blog',
    url: 'https://www.microsoft.com/en-us/security/blog/feed/',
    category: '头部厂商',
    description: '微软安全与合规团队官方博客（已配置AI合规过滤）',
    filterKeywords: 'AI, Copilot, Machine Learning, LLM, Generative AI, Artificial Intelligence',
    enabled: 1,
    cadence: '每天'
  }
];

export function seedRssFeedsIfEmpty(s) {
  try {
    const row = s.prepare('SELECT COUNT(*) as count FROM rss_feeds').get();
    if (row && row.count === 0) {
      const stmt = s.prepare(`INSERT OR IGNORE INTO rss_feeds(id, name, url, category, description, filter_keywords, enabled, cadence, last_fetched_at, created_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const now = new Date().toISOString();
      for (const f of OFFICIAL_PRESET_FEEDS) {
        stmt.run(f.id, f.name, f.url, f.category, f.description, f.filterKeywords || '', f.enabled, f.cadence || '每天', null, now);
      }
    }
  } catch {}
}

export function listRssFeeds() {
  const s = store(); if (!s) return [];
  seedRssFeedsIfEmpty(s);
  return s.prepare('SELECT * FROM rss_feeds ORDER BY category ASC, created_at ASC').all().map(row => ({
    id: row.id,
    name: row.name,
    url: row.url,
    category: row.category,
    description: row.description,
    filterKeywords: row.filter_keywords || '',
    enabled: Number(row.enabled),
    cadence: row.cadence || '每天',
    lastFetchedAt: row.last_fetched_at,
    createdAt: row.created_at
  }));
}

export function getRssFeed(id) {
  const s = store(); if (!s) return null;
  const row = s.prepare('SELECT * FROM rss_feeds WHERE id=?').get(String(id));
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    category: row.category,
    description: row.description,
    filterKeywords: row.filter_keywords || '',
    enabled: Number(row.enabled),
    cadence: row.cadence || '每天',
    lastFetchedAt: row.last_fetched_at,
    createdAt: row.created_at
  };
}

export function saveRssFeed({ id, name, url, category, description, filterKeywords, enabled, cadence }) {
  const s = store(); if (!s) return null;
  const feedId = String(id || `feed-${randomUUID()}`);
  const now = new Date().toISOString();
  const isEnabled = enabled === undefined ? 1 : Number(Boolean(enabled));
  s.prepare(`INSERT INTO rss_feeds(id, name, url, category, description, filter_keywords, enabled, cadence, last_fetched_at, created_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      url=excluded.url,
      category=excluded.category,
      description=excluded.description,
      filter_keywords=excluded.filter_keywords,
      enabled=excluded.enabled,
      cadence=excluded.cadence`).run(
    feedId,
    name || '未命名订阅',
    url,
    category || '监管政策',
    description || '',
    filterKeywords || '',
    isEnabled,
    cadence || '每天',
    null,
    now
  );
  return getRssFeed(feedId);
}

export function toggleRssFeed(id, enabled) {
  const s = store(); if (!s) return null;
  const isEnabled = Number(Boolean(enabled));
  s.prepare('UPDATE rss_feeds SET enabled=? WHERE id=?').run(isEnabled, String(id));
  return getRssFeed(id);
}

export function touchRssFeed(id) {
  const s = store(); if (!s) return null;
  const now = new Date().toISOString();
  s.prepare('UPDATE rss_feeds SET last_fetched_at=? WHERE id=?').run(now, String(id));
  return getRssFeed(id);
}

export function deleteRssFeed(id) {
  const s = store(); if (!s) return false;
  const res = s.prepare('DELETE FROM rss_feeds WHERE id=?').run(String(id));
  return res.changes > 0;
}

export function resetRssFeeds() {
  const s = store(); if (!s) return [];
  s.prepare('DELETE FROM rss_feeds').run();
  seedRssFeedsIfEmpty(s);
  return listRssFeeds();
}
