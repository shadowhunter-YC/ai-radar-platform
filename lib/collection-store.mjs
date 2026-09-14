let DatabaseSync;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch { /* Node < 22 or unsupported env */ }
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
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

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      rule_keywords TEXT NOT NULL,
      rule_tags TEXT,
      summary TEXT,
      is_preset INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 100,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category);
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
      ['tags', 'TEXT'],
      ['content_nature', 'TEXT DEFAULT "fact"'],
      ['source_origin', 'TEXT DEFAULT "direct"'],
      ['primary_authority', 'TEXT'],
      ['primary_doc_title', 'TEXT'],
      ['primary_date', 'TEXT'],
      ['primary_url', 'TEXT'],
      ['primary_quote', 'TEXT'],
      ['verification_status', 'TEXT DEFAULT "verified"']
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
      CREATE INDEX IF NOT EXISTS idx_imported_nature ON imported(content_nature);
      CREATE INDEX IF NOT EXISTS idx_imported_verification ON imported(verification_status);
    `);
  } catch {}
  initDefaultAdmin(s);
  syncRichHistoricalMilestones(s);
  seedPresetTopics(s);
}

export function inferJurisdiction(url = '', source = '') {
  const u = (url || '').toLowerCase();
  const sc = (source || '').toLowerCase();
  if (u.includes('artificialintelligenceact.eu') || u.includes('.eu') || u.includes('.nl') || u.includes('europa.eu')) {
    return { region: 'Europe', countryCode: 'EU' };
  }
  if (u.includes('cisa.gov') || u.includes('nist.gov') || u.includes('microsoft.com') || u.includes('openai.com') || u.includes('anthropic') || sc.includes('anthropic') || sc.includes('sama') || sc.includes('openai')) {
    return { region: 'North America', countryCode: 'US' };
  }
  if (u.includes('cac.gov.cn') || u.includes('tc260.org.cn') || sc.includes('互联网信息办公室') || sc.includes('网安标委') || sc.includes('数据合规') || sc.includes('新智元') || sc.includes('量子位') || sc.includes('网信')) {
    return { region: 'Asia Pacific', countryCode: 'CN' };
  }
  if (u.includes('gov.uk') || sc.includes('uk')) {
    return { region: 'Europe', countryCode: 'GB' };
  }
  if (u.includes('.sg') || sc.includes('singapore')) {
    return { region: 'Asia Pacific', countryCode: 'SG' };
  }
  return { region: 'Global', countryCode: 'GLOBAL' };
}

export function syncRichHistoricalMilestones(s) {
  try {
    if (process.env.NODE_ENV === 'test' || process.env.COLLECTION_DATA_DIR?.includes('test-')) return;
    const seedPath = path.join(process.cwd(), 'lib', 'real-seed-articles.json');
    if (!existsSync(seedPath)) return;
    const items = JSON.parse(readFileSync(seedPath, 'utf8'));
    const stmt = s.prepare(`
      INSERT INTO imported(
        url, title, source, source_type, category, published_at, collected_at, risk_level, summary, tags,
        content_nature, source_origin, primary_authority, primary_doc_title, primary_date, primary_url, primary_quote, verification_status, body
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        source = excluded.source,
        source_type = excluded.source_type,
        category = excluded.category,
        published_at = excluded.published_at,
        risk_level = excluded.risk_level,
        summary = excluded.summary,
        tags = excluded.tags,
        content_nature = excluded.content_nature,
        source_origin = excluded.source_origin,
        primary_authority = excluded.primary_authority,
        primary_doc_title = excluded.primary_doc_title,
        primary_date = excluded.primary_date,
        primary_url = excluded.primary_url,
        primary_quote = excluded.primary_quote,
        verification_status = excluded.verification_status,
        body = excluded.body
    `);

    for (const b of items) {
      const jur = inferJurisdiction(b.url, b.source);
      const nature = b.contentNature || 'fact';
      const origin = b.sourceOrigin || 'direct';
      const auth = b.primaryAuthority || b.source || '';
      const docTitle = b.primaryDocTitle || '';
      const pDate = b.eventDate || b.primaryDate || (b.publishedAt ? b.publishedAt.slice(0, 10) : '');
      const pUrl = b.primaryUrl || b.url || '';
      const pQuote = b.primaryQuote || '';
      const vStatus = b.verificationStatus || 'verified';

      const body = {
        ...b,
        region: b.region || jur.region,
        countryCode: b.countryCode || jur.countryCode,
        isSample: false,
        dataOrigin: 'local',
        contentNature: nature,
        sourceOrigin: origin,
        primaryAuthority: auth,
        primaryDocTitle: docTitle,
        primaryDate: pDate,
        eventDate: pDate,
        primaryUrl: pUrl,
        primaryQuote: pQuote,
        verificationStatus: vStatus
      };

      stmt.run(
        body.url || `seed-${body.id}`,
        body.title,
        body.source,
        body.sourceType,
        body.intelligenceType || body.category,
        body.publishedAt,
        body.collectedAt,
        body.riskLevel || '中风险',
        body.summary,
        JSON.stringify(body.tags || []),
        nature,
        origin,
        auth,
        docTitle,
        pDate,
        pUrl,
        pQuote,
        vStatus,
        JSON.stringify(body)
      );
    }
  } catch (err) {
    console.error('syncRichHistoricalMilestones failed:', err);
  }
}

export function seedPresetTopics(s) {
  try {
    const presetTopics = [
      {
        id: 'topic-cn-genai-reg',
        title: '中国生成式人工智能监管全景时间线',
        category: 'AI 法规动态',
        rule_keywords: JSON.stringify(['中国|网信办|工信部|TC260|网安标委', '生成式|大模型|算法备案|深度合成|人工智能法']),
        rule_tags: JSON.stringify(['法规政策', '备案清单', '合规动态']),
        summary: '全景追踪中央网信办、工信部及全国网安标委（TC260）在生成式人工智能领域的监管规制。覆盖《暂行办法》落地、大模型算法备案公示、TC260-003 安全基本要求及生成内容标识规范。',
        is_preset: 1,
        sort_order: 10
      },
      {
        id: 'topic-eu-ai-act',
        title: '欧洲 AI 法案落地与合规指南进展',
        category: 'AI 法规动态',
        rule_keywords: JSON.stringify(['欧盟|EU|欧洲议会|欧洲委员会|AI Office', 'AI Act|人工智能法案|GPAI|通用目的|高风险']),
        rule_tags: JSON.stringify(['法规政策', '欧盟监管', '合规动态']),
        summary: '实时追踪欧盟《人工智能法案》（EU AI Act）各阶段合规生效进程。涵盖禁止类不可接受风险、通用目的大模型（GPAI）治理守则及高风险系统强制评测。',
        is_preset: 1,
        sort_order: 20
      },
      {
        id: 'topic-frontier-cyber-models',
        title: '国内外前沿 Cyber 模型安全演进',
        category: 'AI 安全产品动态',
        rule_keywords: JSON.stringify(['DeepSeek|OpenAI|Anthropic|Claude|微软|Google', '护栏|Guardrails|Prompt Shield|攻防|越狱防御|推理安全|安全|对齐|对抗']),
        rule_tags: JSON.stringify(['安全产品突破', '安全护栏', '红蓝评测']),
        summary: '持续监测国内外前沿基础模型在自主攻防能力、推理链安全审查、对抗样本防御及企业级 Guardrails 安全护栏层面的工程演进与防御突破。',
        is_preset: 1,
        sort_order: 30
      },
      {
        id: 'topic-model-security-incidents',
        title: '全球大模型安全漏洞与监管处罚脉络',
        category: '事件动态',
        rule_keywords: JSON.stringify(['漏洞|CVE|越狱|投毒|窃密|数据泄露|罚单|通报|调查|下架|行政处罚|禁令|注入|后门|逃逸|未授权|渗透|Hugging|Spaces|Token|智能体失控']),
        rule_tags: JSON.stringify(['违规处罚与事件', '监管罚单', '数据泄露', '漏洞预警']),
        summary: '客观汇编全球发生的 AI 供应链后门、提示词注入与越狱利用，以及多国监管机构针对违规模型训练、个人隐私泄露开出的行政处罚判例与调查通报。',
        is_preset: 1,
        sort_order: 40
      },
      {
        id: 'topic-ai-safety-standards',
        title: '全球 AI 安全标准与可信认证演进',
        category: 'AI 法规动态',
        rule_keywords: JSON.stringify(['OWASP|ISO 42001|ISO/IEC 42001|AIUC|NIST|TC260|MITRE', '标准|规范|指南|管理体系|Top 10|框架|白皮书']),
        rule_tags: JSON.stringify(['AI安全标准', '安全标准与规范', '合规治理']),
        summary: '全流程汇编国际组织（ISO/IEC、OWASP、NIST、MITRE、全国信安标委 TC260）在 AI 安全管理、大模型 Top 10 漏洞、统一控制框架（AIUC-1）及生成式服务安全规范层面的标准演化脉络。',
        is_preset: 1,
        sort_order: 50
      },
      {
        id: 'topic-github-security-ecosystem',
        title: 'GitHub 热门 AI 安全攻防与合规工具生态',
        category: 'AI 安全产品动态',
        rule_keywords: JSON.stringify(['garak|promptfoo|PyRIT|NeMo|Guardrails|PurpleLlama|开源', '扫描|红队|评测|护栏|注入|渗透|工具|代码库']),
        rule_tags: JSON.stringify(['GitHub开源', 'GitHub与开源安全', '红蓝评测']),
        summary: '实时追踪 GitHub 顶尖开源社区打造的大模型漏洞扫描器（garak）、红队自动化评测工具（promptfoo、PyRIT）及企业级安全护栏运行时（NeMo Guardrails、Purple Llama）的核心发布与迭代。',
        is_preset: 1,
        sort_order: 60
      }
    ];

    // 清除历史测试中引入的非标杆专题
    s.prepare("DELETE FROM topics WHERE id = 'topic-huggingface-security'").run();

    const now = new Date().toISOString();
    const stmt = s.prepare(`
      INSERT INTO topics(id, title, category, rule_keywords, rule_tags, summary, is_preset, sort_order, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);

    for (const t of presetTopics) {
      stmt.run(t.id, t.title, t.category, t.rule_keywords, t.rule_tags, t.summary, t.is_preset, t.sort_order, now, now);
    }
  } catch (err) {
    console.error('seedPresetTopics failed:', err);
  }
}

export function getTopics() {
  const s = store();
  if (!s) return [];
  return s.prepare('SELECT * FROM topics ORDER BY sort_order ASC, created_at DESC').all().map(r => ({
    id: r.id,
    title: r.title,
    category: r.category,
    ruleKeywords: JSON.parse(r.rule_keywords || '[]'),
    ruleTags: JSON.parse(r.rule_tags || '[]'),
    summary: r.summary || '',
    isPreset: Boolean(r.is_preset),
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export function getTopicById(id) {
  const s = store();
  if (!s) return null;
  const r = s.prepare('SELECT * FROM topics WHERE id=?').get(String(id));
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    ruleKeywords: JSON.parse(r.rule_keywords || '[]'),
    ruleTags: JSON.parse(r.rule_tags || '[]'),
    summary: r.summary || '',
    isPreset: Boolean(r.is_preset),
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export function createTopic({ title, category, ruleKeywords = [], ruleTags = [], summary = '' }) {
  const s = store();
  if (!s) throw new Error('数据库不可用。');
  const validCategories = ['AI 法规动态', 'AI 安全产品动态', '事件动态'];
  if (!validCategories.includes(category)) {
    throw new Error('分类必须为：AI 法规动态、AI 安全产品动态、事件动态 之一。');
  }
  if (!title || typeof title !== 'string') {
    throw new Error('专题标题不能为空。');
  }
  const id = `topic-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const kwStr = JSON.stringify(Array.isArray(ruleKeywords) ? ruleKeywords : [String(ruleKeywords)]);
  const tagsStr = JSON.stringify(Array.isArray(ruleTags) ? ruleTags : []);

  s.prepare(`INSERT INTO topics(id, title, category, rule_keywords, rule_tags, summary, is_preset, sort_order, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, 0, 50, ?, ?)`).run(id, title.trim(), category, kwStr, tagsStr, (summary || '').trim(), now, now);

  return getTopicById(id);
}

export function updateTopic(id, updates = {}) {
  const s = store();
  if (!s) return null;
  const existing = getTopicById(id);
  if (!existing) return null;

  const title = updates.title !== undefined ? updates.title.trim() : existing.title;
  const category = updates.category !== undefined ? updates.category : existing.category;
  const summary = updates.summary !== undefined ? updates.summary.trim() : existing.summary;
  const kwStr = updates.ruleKeywords !== undefined ? JSON.stringify(updates.ruleKeywords) : JSON.stringify(existing.ruleKeywords);
  const tagsStr = updates.ruleTags !== undefined ? JSON.stringify(updates.ruleTags) : JSON.stringify(existing.ruleTags);
  const now = new Date().toISOString();

  s.prepare(`UPDATE topics SET title=?, category=?, summary=?, rule_keywords=?, rule_tags=?, updated_at=? WHERE id=?`)
    .run(title, category, summary, kwStr, tagsStr, now, id);

  return getTopicById(id);
}

export function deleteTopic(id) {
  const s = store();
  if (!s) return false;
  const existing = getTopicById(id);
  if (!existing) return false;
  if (existing.isPreset) {
    throw new Error('系统预置标杆专题不可删除。');
  }
  s.prepare('DELETE FROM topics WHERE id=?').run(id);
  return true;
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
const EXEMPT_HOST_PATTERNS = ['wewe.wilsongo.top', 'rss.wilsongo.top', 'mp.weixin.qq.com', 'x.com', 'twitter.com', 'localhost', '127.0.0.1'];
export function isExemptHost(host) {
  if (!host) return true;
  const h = host.toLowerCase();
  return EXEMPT_HOST_PATTERNS.some(p => h === p || h.endsWith('.wilsongo.top') || h.includes('localhost') || h.includes('we-mp-rss') || h.includes('rsshub'));
}
export function claimHost(host, now = Date.now()) {
  if (isExemptHost(host)) return;
  const s = store(); if (!s) throw new Error('数据库不可用。请稍后再试。');
  const result = s.prepare('INSERT INTO attempts(host,started) VALUES(?,?) ON CONFLICT(host) DO UPDATE SET started=excluded.started WHERE attempts.started<=?').run(host, now, now - 600000);
  if (!result.changes) throw new Error('该来源正在10分钟冷却期内。请稍后再试，或使用已缓存的文章。');
}
export function clearHostAttempt(host) {
  const s = store(); if (!s) return;
  if (host) s.prepare('DELETE FROM attempts WHERE host=?').run(host);
  else s.prepare('DELETE FROM attempts').run();
}
export function logRun(body) { const s = store(); if (!s) return; s.prepare('INSERT INTO runs VALUES(?,?,?)').run(randomUUID(), new Date().toISOString(), JSON.stringify(body)); }
export function recentRuns() { const s = store(); if (!s) return []; return s.prepare('SELECT created,body FROM runs ORDER BY created DESC LIMIT 10').all().map(r => ({ createdAt: r.created, ...JSON.parse(r.body) })); }
export function importedArticles() {
  const s = store();
  if (!s) return [];
  return s.prepare('SELECT id,body,content_nature,source_origin,primary_authority,primary_doc_title,primary_date,primary_url,primary_quote,verification_status FROM imported ORDER BY id DESC LIMIT 500').all().map(r => {
    const b = JSON.parse(r.body);
    const nature = b.contentNature || r.content_nature || 'fact';
    const origin = b.sourceOrigin || r.source_origin || (b.source?.includes('微信') || b.url?.includes('weixin') ? 'wechat' : 'direct');
    const auth = b.primaryAuthority || r.primary_authority || (origin === 'direct' ? b.source : '');
    const pDate = b.eventDate || b.primaryDate || r.primary_date || '';
    const date = pDate || (b.dateIsCollection ? '' : (b.publishedAt && b.publishedAt !== b.collectedAt ? b.publishedAt : ''));
    const vStatus = b.verificationStatus || r.verification_status || (nature === 'opinion' ? 'opinion' : (origin === 'direct' ? 'verified' : (auth ? 'verified' : 'unverified')));

    return {
      ...b,
      id: r.id + 1000000000,
      contentNature: nature,
      sourceOrigin: origin,
      primaryAuthority: auth,
      primaryDocTitle: b.primaryDocTitle || r.primary_doc_title || '',
      primaryDate: date,
      eventDate: b.eventDate || pDate || date,
      primaryUrl: b.primaryUrl || r.primary_url || (origin === 'direct' ? b.url : ''),
      primaryQuote: b.primaryQuote || r.primary_quote || '',
      verificationStatus: vStatus
    };
  });
}
export function isUrlImported(url) {
  if (!url) return false;
  const s = store(); if (!s) return false;
  const row = s.prepare('SELECT id FROM imported WHERE url=?').get(String(url));
  return Boolean(row);
}
export function confirmDraft(id) {
  const d = getDraft(id); if (!d?.analysis) throw new Error('请先完成AI分析再入库。');
  const a = d.analysis;
  const category = a.intelligenceType || a.category || '安全产品突破';
  const riskLevel = a.severity ? (a.severity === '重大' ? '高风险' : a.severity === '中度' ? '中风险' : '低风险') : '待评估';
  const jur = inferJurisdiction(d.url, d.source);

  // 标题提炼：优先使用 AI 分析提炼出的精炼专业标题；若原标题过短（如 "yes"）或无意义字符，结合摘要进行总结
  let finalTitle = (a.title && typeof a.title === 'string' && a.title.trim().length >= 4)
    ? a.title.trim()
    : d.title;

  const isTrivial = /^(yes|no|agreed|true|100%|looking into this|looking into it|indeed|right|exactly|cool|wow|thanks)[\.!\s]*$/i.test(finalTitle.trim()) || finalTitle.trim().length < 5;
  if (isTrivial && a.summary && a.summary.trim().length >= 6) {
    finalTitle = a.summary.trim().slice(0, 45).replace(/[，。；！]+$/, '');
  }

  const contentNature = a.contentNature || 'fact';
  const sourceOrigin = (d.source?.toLowerCase().includes('wechat') || d.url?.includes('weixin') || d.url?.includes('mp.weixin') || d.source?.includes('微信'))
    ? 'wechat'
    : (d.url?.includes('x.com') || d.url?.includes('twitter') ? 'x_post' : 'direct');
  
  const primaryAuthority = a.sourceAttribution?.primaryAuthority || (sourceOrigin === 'direct' ? d.source : '');
  const primaryDocTitle = a.sourceAttribution?.primaryDocTitle || '';
  const primaryDate = a.sourceAttribution?.primaryDate || d.publishedAt || d.collectedAt || '';
  const primaryUrl = a.sourceAttribution?.primaryUrl || (sourceOrigin === 'direct' ? d.url : '');
  const primaryQuote = a.sourceAttribution?.citationQuote || '';
  const verificationStatus = a.verificationStatus || (contentNature === 'opinion' ? 'opinion' : (sourceOrigin === 'direct' ? 'verified' : (primaryAuthority ? 'verified' : 'unverified')));

  let detailTag = a.detailTag || '';
  let tags = Array.isArray(a.tags) ? [...a.tags] : [];
  if (contentNature === 'opinion') {
    if (!detailTag || detailTag === '未分类') {
      detailTag = '深度解读';
    }
    if (!tags.includes('行业观点')) {
      tags = ['行业观点', ...tags].slice(0, 5);
    }
  }

  const body = {
    title: finalTitle, source: d.source, sourceType: d.kind === 'paste' ? '用户提供' : '公开网页', url: d.kind === 'paste' ? '' : d.url,
    publishedAt: d.publishedAt || d.collectedAt, dateIsCollection: !d.publishedAt, collectedAt: d.collectedAt, originalExcerpt: d.text,
    summary: a.summary, intelligenceType: category, detailTag, affectedEntity: a.affectedEntity || '', severity: a.severity || '',
    tags, impact: a.impact || '', recommendedAction: a.action || '', insight: a.impact || '',
    region: jur.region, countryCode: jur.countryCode, riskLevel, credibilityScore: 85, aiGeneratedScore: 15, watermarkStatus: 'unsupported', lat: 0, lng: 0,
    credibilitySignals: [], provenance: d.kind, verification: '未核验', model: a.model,
    contentNature,
    sourceOrigin,
    primaryAuthority,
    primaryDocTitle,
    primaryDate,
    primaryUrl,
    primaryQuote,
    verificationStatus
  };

  const s = store(); if (!s) throw new Error('数据库不可用。请稍后再试。');
  s.prepare(`INSERT OR IGNORE INTO imported(url, title, source, source_type, category, published_at, collected_at, risk_level, summary, tags, content_nature, source_origin, primary_authority, primary_doc_title, primary_date, primary_url, primary_quote, verification_status, body)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    d.url, body.title, body.source, body.sourceType, body.intelligenceType, body.publishedAt, body.collectedAt, body.riskLevel, body.summary, JSON.stringify(body.tags || []),
    body.contentNature, body.sourceOrigin, body.primaryAuthority, body.primaryDocTitle, body.primaryDate, body.primaryUrl, body.primaryQuote, body.verificationStatus,
    JSON.stringify(body)
  );
  const row = s.prepare('SELECT id FROM imported WHERE url=?').get(d.url);
  const articleId = row.id + 1000000000; s.prepare('UPDATE drafts SET article_id=? WHERE id=?').run(articleId, id); return articleId;
}

export function updateImportedArticle(id, updates = {}) {
  const s = store(); if (!s) return null;
  const numId = Number(id);
  const rawId = numId > 1000000000 ? numId - 1000000000 : numId;
  const row = s.prepare('SELECT id, body FROM imported WHERE id=?').get(rawId);
  if (!row) return null;
  const body = JSON.parse(row.body);
  if (updates.intelligenceType) {
    body.intelligenceType = updates.intelligenceType;
    body.category = updates.intelligenceType;
  }
  if (updates.detailTag !== undefined) body.detailTag = updates.detailTag;
  if (updates.affectedEntity !== undefined) body.affectedEntity = updates.affectedEntity;
  if (updates.severity !== undefined) body.severity = updates.severity;
  if (updates.riskLevel !== undefined) body.riskLevel = updates.riskLevel;

  s.prepare('UPDATE imported SET category=?, risk_level=?, body=? WHERE id=?').run(
    body.intelligenceType,
    body.riskLevel || '待评估',
    JSON.stringify(body),
    rawId
  );
  return { ...body, id: row.id + 1000000000 };
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
  // 1. 法规政策与监管标准 (Regulations & Standards)
  {
    id: 'preset-tc260',
    name: '全国网安标委 (TC260) 官网动态',
    url: 'https://radar.wilsongo.top/api/rss/tc260',
    category: 'AI安全标准',
    description: '全国网络安全标准化技术委员会(TC260)官方标准发布、治理框架与实践指南',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-eu-ai-act',
    name: 'EU AI Act News (欧盟AI法案动态)',
    url: 'https://artificialintelligenceact.eu/feed/',
    category: '法规政策',
    description: '欧盟《人工智能法案》(EU AI Act) 官方与行业实施细则、合规义务与处罚指南',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-nist-ai',
    name: 'NIST AI News & Updates',
    url: 'https://www.nist.gov/news-events/news/rss.xml',
    category: '法规政策',
    description: '美国国家标准技术研究所AI风险管理框架(RMF)与安全评测标准动态',
    filterKeywords: 'AI, Artificial Intelligence, Machine Learning, RMF, LLM, Model, Safety, 治理, 风控',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-cisa-alerts',
    name: 'CISA Cybersecurity Alerts',
    url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
    category: '法规政策',
    description: '美国CISA官方安全通报（已配置关键词筛选，过滤常规系统漏洞）',
    filterKeywords: 'AI, Artificial Intelligence, Machine Learning, LLM, Generative AI, Deepfake, 算法, 人工智能, 大模型',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-wechat-sjhg',
    name: '数据合规',
    url: 'https://wewe.wilsongo.top/feed/MP_WXS_2395801166.xml',
    category: '法规政策',
    description: '数据安全、个人信息保护与大模型备案合规前沿解读',
    filterKeywords: '数据安全, 合规, 治理, 个人信息, 隐私, 备案, 出境, 漏洞, 安全标准',
    enabled: 1,
    cadence: '每天'
  },

  // 2. 安全合规产品与工具突破 (Breakthrough Products & Defenses)
  {
    id: 'preset-owasp-genai',
    name: 'OWASP GenAI Security Project',
    url: 'https://genai.owasp.org/feed/',
    category: '安全产品突破',
    description: 'OWASP大语言模型安全Top 10防御架构、安全护栏Guardrails与评测工具动态',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-protect-ai',
    name: 'Protect AI Threat Research',
    url: 'https://protectai.com/blog/rss.xml',
    category: '安全产品突破',
    description: 'AI 原生安全防护工具、模型安全审计与Huntr漏洞奖励计划前沿',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-anthropic',
    name: 'Anthropic News',
    url: 'https://www.anthropic.com/feed',
    category: '安全产品突破',
    description: 'Claude 模型可解释性对齐、红蓝对抗评测与防御安全研究',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-x-anthropic',
    name: 'Anthropic (@AnthropicAI)',
    url: 'https://rss.wilsongo.top/twitter/user/AnthropicAI',
    category: '安全产品突破',
    description: 'Anthropic 官方研究动态与 Claude 模型安全合规更新',
    filterKeywords: 'Claude, safety, model, interpretability, alignment, AI, security',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-google-security',
    name: 'Google Online Security Blog',
    url: 'https://feeds.feedburner.com/GoogleOnlineSecurityBlog',
    category: '安全产品突破',
    description: '谷歌安全团队AI红队测试与深度伪造检测水印技术动态',
    filterKeywords: 'AI, LLM, Gemini, Machine Learning, Artificial Intelligence, Model, Deepfake',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-microsoft-security',
    name: 'Microsoft Security Blog',
    url: 'https://www.microsoft.com/en-us/security/blog/feed/',
    category: '安全产品突破',
    description: '微软安全与合规团队AI Copilot防御工具与安全架构博客',
    filterKeywords: 'AI, Copilot, Machine Learning, LLM, Generative AI, Artificial Intelligence',
    enabled: 1,
    cadence: '每天'
  },

  // 3. 违规处罚与真实安全事件 (Incidents & Enforcement)
  {
    id: 'preset-ai-incident',
    name: 'AI Incident Database (全球AI事故与处罚库)',
    url: 'https://incidentdatabase.ai/rss.xml',
    category: '违规处罚与事件',
    description: '全球最权威的AI安全事故、算法歧视、深度伪造诈骗与违规诉讼处罚实录数据库',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-trail-of-bits',
    name: 'Trail of Bits Security Research',
    url: 'https://blog.trailofbits.com/feed/',
    category: '违规处罚与事件',
    description: '顶尖安全实验室揭示的实际模型越狱、供应链投毒与攻击利用漏洞',
    filterKeywords: 'AI, Machine Learning, LLM, Neural, Model, Prompt, Agent, Security',
    enabled: 1,
    cadence: '每天'
  },

  // 4. 行业动态与前沿 (Industry Context)
  {
    id: 'preset-openai',
    name: 'OpenAI Newsroom',
    url: 'https://openai.com/news/rss.xml',
    category: '行业动态',
    description: 'OpenAI官方新闻、产品发布与模型安全政策',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-wechat-qbit',
    name: '量子位',
    url: 'https://wewe.wilsongo.top/feed/MP_WXS_3236757533.xml',
    category: '行业动态',
    description: '前沿AI产业动态与大模型前沿解读（已配置AI安全合规关键词筛选）',
    filterKeywords: 'AI, 大模型, 模型, 安全, 治理, 合规, 漏洞, 算法, 深度伪造, 备案, 风险, 数据安全',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-wechat-xzy',
    name: '新智元',
    url: 'https://wewe.wilsongo.top/feed/MP_WXS_3271041950.xml',
    category: '行业动态',
    description: '人工智能行业与学术前沿解读（已配置AI安全合规关键词筛选）',
    filterKeywords: 'AI, 大模型, 模型, 安全, 治理, 合规, 漏洞, 算法, 深度伪造, 备案, 风险, 数据安全',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-x-openai',
    name: 'OpenAI (@OpenAI)',
    url: 'https://rss.wilsongo.top/twitter/user/OpenAI',
    category: '行业动态',
    description: 'OpenAI 官方 X 动态（模型发布、安全与前沿成果）',
    filterKeywords: 'AI, model, GPT, safety, release, alignment, research, ChatGPT, cyber',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-x-sama',
    name: 'Sam Altman (@sama)',
    url: 'https://rss.wilsongo.top/twitter/user/sama',
    category: '行业动态',
    description: 'Sam Altman 个人 X 推文（大模型趋势、AGI、算力与行业洞察）',
    filterKeywords: 'AI, model, compute, AGI, intelligence, agent, safety',
    enabled: 1,
    cadence: '每天'
  },

  // 5. GitHub 标杆开源生态 (GitHub Open-Source Releases)
  {
    id: 'preset-github-promptfoo',
    name: 'promptfoo Releases (GitHub)',
    url: 'https://github.com/promptfoo/promptfoo/releases.atom',
    category: '安全产品突破',
    description: '大模型自动化红队对抗评测与Prompt注入防御工具官方新版本发布',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-github-garak',
    name: 'garak Releases (GitHub)',
    url: 'https://github.com/leondz/garak/releases.atom',
    category: '安全产品突破',
    description: '大语言模型全自动安全扫描器与越狱探测器官方新版本发布',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-github-pyrit',
    name: 'PyRIT Releases (Microsoft Azure)',
    url: 'https://github.com/Azure/PyRIT/releases.atom',
    category: '安全产品突破',
    description: '微软生成式AI自动化红队工具包官方新版本发布',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-github-nemo',
    name: 'NeMo Guardrails Releases (NVIDIA)',
    url: 'https://github.com/NVIDIA/NeMo-Guardrails/releases.atom',
    category: '安全产品突破',
    description: '英伟达可信大语言模型对话安全护栏系统官方新版本发布',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },

  // 6. X/Twitter 全网前沿热点搜索流 (Curated Hot Topic Streams)
  {
    id: 'preset-x-hot-safety',
    name: 'X 全网热点: AI安全与治理争议',
    url: 'https://rss.wilsongo.top/twitter/keyword/(%22AI%20safety%22%20OR%20%22AI%20regulation%22%20OR%20%22SB%201047%22)%20min_faves%3A50',
    category: '行业动态',
    description: 'X 全网关于 AI 安全、监管立法与加州 SB 1047 等高赞交锋推文（点赞≥50）',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  },
  {
    id: 'preset-x-hot-slowdown',
    name: 'X 全网热点: AI减速与超级对齐大论战',
    url: 'https://rss.wilsongo.top/twitter/keyword/(Dario%20OR%20%22slow%20down%20AI%22%20OR%20%22pause%20AI%22%20OR%20%22existential%20risk%22)%20min_faves%3A30',
    category: '行业动态',
    description: 'X 全网围绕 Dario Amodei 减速呼吁、超级对齐与存亡风险的深度观点流（点赞≥30）',
    filterKeywords: '',
    enabled: 1,
    cadence: '每天'
  }
];

export const WECHAT_DEFAULT_KEYWORDS = 'AI, 大模型, 模型, 安全, 治理, 合规, 漏洞, 算法, 深度伪造, 备案, 风险, 幻觉, 注入, 数据安全';

export function seedRssFeedsIfEmpty(s) {
  try {
    const stmt = s.prepare(`INSERT OR IGNORE INTO rss_feeds(id, name, url, category, description, filter_keywords, enabled, cadence, last_fetched_at, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const updateCategoryStmt = s.prepare(`UPDATE rss_feeds SET category=? WHERE id=? AND category != ?`);
    const now = new Date().toISOString();
    for (const f of OFFICIAL_PRESET_FEEDS) {
      stmt.run(f.id, f.name, f.url, f.category, f.description, f.filterKeywords || '', f.enabled, f.cadence || '每天', null, now);
      try { updateCategoryStmt.run(f.category, f.id, f.category); } catch {}
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
  let feedId = String(id || `feed-${randomUUID()}`);
  if (s) {
    try {
      const existing = s.prepare('SELECT id FROM rss_feeds WHERE id=? OR url=?').get(feedId, url);
      if (existing) {
        feedId = existing.id;
      }
    } catch {}
  }
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

// ----------------------------------------------------
// 用户认证与会话管理 (Authentication & Sessions)
// ----------------------------------------------------

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  try {
    const testHash = scryptSync(password, salt, 64).toString('hex');
    return timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

export function initDefaultAdmin(s) {
  try {
    const row = s.prepare('SELECT COUNT(*) as c FROM users').get();
    if (!row || row.c === 0) {
      const { hash, salt } = hashPassword('admin123456');
      s.prepare('INSERT INTO users(id, username, password_hash, salt, role, created_at) VALUES(?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), 'admin', hash, salt, 'admin', new Date().toISOString());
    }
  } catch {}
}

export function verifyUserCredentials(username, password) {
  const s = store(); if (!s) return null;
  const user = s.prepare('SELECT * FROM users WHERE username=?').get(String(username).trim());
  if (!user) return null;
  if (!verifyPassword(String(password), user.password_hash, user.salt)) return null;
  return { id: user.id, username: user.username, role: user.role };
}

export function getUserById(id) {
  const s = store(); if (!s) return null;
  const user = s.prepare('SELECT id, username, role, created_at FROM users WHERE id=?').get(String(id));
  return user || null;
}

export function changeUserPassword(userId, oldPassword, newPassword) {
  const s = store(); if (!s) throw new Error('数据库不可用');
  const user = s.prepare('SELECT * FROM users WHERE id=?').get(String(userId));
  if (!user) throw new Error('用户不存在');
  if (!verifyPassword(String(oldPassword), user.password_hash, user.salt)) throw new Error('原密码错误');
  if (!newPassword || String(newPassword).length < 6) throw new Error('新密码长度不能少于 6 位');
  const { hash, salt } = hashPassword(String(newPassword));
  s.prepare('UPDATE users SET password_hash=?, salt=? WHERE id=?').run(hash, salt, String(userId));
  return true;
}

export function createSession(userId, days = 7) {
  const s = store(); if (!s) return null;
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  s.prepare('INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)')
    .run(token, String(userId), expiresAt, new Date().toISOString());
  return { token, expiresAt };
}

export function verifySessionToken(token) {
  if (!token) return null;
  const s = store(); if (!s) return null;
  const now = Date.now();
  const session = s.prepare(`
    SELECT sessions.token, sessions.user_id, sessions.expires_at, users.username, users.role
    FROM sessions
    JOIN users ON sessions.user_id = users.id
    WHERE sessions.token = ? AND sessions.expires_at > ?
  `).get(String(token), now);
  if (!session) return null;
  return { id: session.user_id, username: session.username, role: session.role };
}

export function destroySession(token) {
  if (!token) return;
  const s = store(); if (!s) return;
  s.prepare('DELETE FROM sessions WHERE token=?').run(String(token));
}

// ----------------------------------------------------
// 系统与大模型设置 (Settings & LLM Configuration)
// ----------------------------------------------------

export function getSetting(key) {
  const s = store(); if (!s) return null;
  const row = s.prepare('SELECT value FROM settings WHERE key=?').get(String(key));
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export function setSetting(key, value) {
  const s = store(); if (!s) return false;
  const valStr = typeof value === 'string' ? value : JSON.stringify(value);
  s.prepare(`INSERT INTO settings(key, value, updated_at) VALUES(?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .run(String(key), valStr, new Date().toISOString());
  return true;
}

export function getLlmConfig() {
  const custom = getSetting('llm_config');
  const envKey = process.env.SILICONFLOW_API_KEY?.trim() || '';
  const envBase = process.env.SILICONFLOW_BASE_URL?.trim() || 'https://api.siliconflow.cn/v1';
  const envModel = process.env.SILICONFLOW_MODEL?.trim() || 'deepseek-ai/DeepSeek-V3';

  if (custom && typeof custom === 'object') {
    const apiKey = custom.apiKey?.trim() || envKey;
    const baseUrl = custom.baseUrl?.trim() || envBase;
    const model = custom.model?.trim() || envModel;
    const provider = custom.provider || 'siliconflow';
    return {
      provider,
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey,
      model,
      temperature: typeof custom.temperature === 'number' ? custom.temperature : 0.3,
      configured: Boolean(apiKey)
    };
  }

  return {
    provider: 'siliconflow',
    baseUrl: envBase.replace(/\/+$/, ''),
    apiKey: envKey,
    model: envModel,
    temperature: 0.3,
    configured: Boolean(envKey)
  };
}
