import {
  crawlPlan,
  dailyBrief,
  reportPreview,
  sources as mockSources
} from "./mock-data.js";

import { importedArticles, getTopics, listReports, getSetting } from './collection-store.mjs';
import { DEFAULT_MORNING_PREFERENCES } from './daily-report.mjs';
import { assembleTopicDossier } from './topic-matcher.mjs';
import { combineArticles } from './article-library.mjs';
let pool;

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

async function getPool() {
  if (!hasDatabase()) {
    return null;
  }

  if (!pool) {
    const { Pool } = await import("pg");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined
    });
  }

  return pool;
}

function toCamelArticle(row) {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    sourceType: row.source_type,
    url: row.url,
    region: row.region,
    countryCode: row.country_code,
    publishedAt: row.published_at,
    originalExcerpt: row.original_excerpt,
    summary: row.summary,
    intelligenceType: row.intelligence_type,
    riskLevel: row.risk_level,
    credibilityScore: row.credibility_score,
    aiGeneratedScore: row.ai_generated_score,
    watermarkStatus: row.watermark_status,
    impact: row.impact,
    recommendedAction: row.recommended_action,
    insight: row.insight || row.recommended_action || row.summary,
    detailTag: row.detail_tag || '',
    affectedEntity: row.affected_entity || '',
    severity: row.severity || '',
    tags: row.tags || [],
    lat: Number(row.lat),
    lng: Number(row.lng),
    credibilitySignals: [
      { label: "来源可信", value: Math.min(95, row.credibility_score + 4) },
      { label: "交叉验证", value: Math.max(45, row.credibility_score - 12) },
      { label: "AI生成概率", value: row.ai_generated_score },
      { label: "水印检测", value: row.watermark_status === "detected" ? 82 : 58 }
    ]
  };
}

function toCamelSource(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    url: row.url,
    region: row.region,
    reliability: row.reliability,
    collectionMethod: row.collection_method,
    status: row.status,
    cadence: "每日 1 次",
    owner: "AI情报运营",
    notes: "来自PostgreSQL的情报来源配置。"
  };
}

function applyFilters(items, filters = {}) {
  return items.filter((item) => {
    if (filters.type && filters.type !== "全部" && item.intelligenceType !== filters.type) return false;
    if (filters.risk && filters.risk !== "全部" && item.riskLevel !== filters.risk) return false;
    if (filters.region && filters.region !== "全部" && item.region !== filters.region) return false;
    if (filters.tag && filters.tag !== "全部" && !item.tags.includes(filters.tag)) return false;
    return true;
  });
}

export async function getArticles(filters = {}) {
  const imported = importedArticles();
  
  // 严格优先使用真实抓取入库的资讯；当库内有真实情报时，绝不掺杂 Mock 假数据
  if (imported.length > 0) {
    const realArticles = imported.map(a => ({
      ...a,
      isSample: false,
      dataOrigin: 'local'
    }));
    return {
      data: applyFilters(realArticles, filters),
      mode: 'real'
    };
  }

  try {
    const db = await getPool();
    if (db) {
      const result = await db.query("SELECT * FROM articles ORDER BY published_at DESC LIMIT 100");
      const pgArticles = result.rows.map(toCamelArticle);
      return {
        data: applyFilters(pgArticles, filters),
        mode: 'postgres'
      };
    }
  } catch (error) {
    console.warn("Falling back to local articles:", error.message);
  }

  // 兜底：若数据库与 SQLite 均为空，返回空列表，绝不向用户呈现假数据
  return {
    data: [],
    mode: 'empty'
  };
}

export function buildCountryStats(articles = []) {
  const definitions = [
    { code: "US", name: "美国", region: "North America", lat: 39.8283, lng: -98.5795, themes: ["NIST框架", "大模型安全", "监管审查"] },
    { code: "EU", name: "欧盟", region: "Europe", lat: 50.8503, lng: 4.3517, themes: ["EU AI Act", "高风险AI", "合规义务"] },
    { code: "CN", name: "中国", region: "Asia Pacific", lat: 35.8617, lng: 104.1954, themes: ["大模型备案", "生成式AI治理", "数据合规"] },
    { code: "GLOBAL", name: "全球综合", region: "Global", lat: 20, lng: 0, themes: ["全球治理", "模型安全", "国际标准"] }
  ];

  const totalAll = Math.max(articles.length, 1);

  return definitions.map(def => {
    const matching = articles.filter(a => {
      if (def.code === 'GLOBAL') {
        return a.countryCode === 'GLOBAL' || a.region === 'Global';
      }
      return a.countryCode === def.code;
    });

    const total = matching.length;
    const highRisk = matching.filter(a => a.riskLevel === '高' || a.riskLevel === '高风险' || a.severity === '重大').length;
    const share = `${((total / totalAll) * 100).toFixed(1)}%`;
    const heat = Math.min(100, Math.max(12, Math.round((total / totalAll) * 100) + (highRisk > 0 ? 30 : 15)));

    return {
      ...def,
      total,
      highRisk,
      share,
      heat
    };
  }).sort((a, b) => b.total - a.total);
}

export function buildDynamicCountryFeeds(articles = []) {
  const result = {};
  const countryCodes = ['GLOBAL', 'US', 'EU', 'CN'];
  
  for (const code of countryCodes) {
    const countryArticles = articles.filter(a => {
      if (code === 'GLOBAL') return true;
      return a.countryCode === code;
    });

    const regList = countryArticles.filter(a => ['法规政策', '合规动态', '监管政策'].includes(a.intelligenceType));
    const prodList = countryArticles.filter(a => ['安全产品突破', '产品动态', 'AI安全'].includes(a.intelligenceType));
    const incList = countryArticles.filter(a => ['违规处罚与事件', '安全事件'].includes(a.intelligenceType));

    result[code] = {
      categories: [
        {
          name: '合规动态',
          count: regList.length,
          items: regList.map(a => a.title)
        },
        {
          name: '产品动态',
          count: prodList.length,
          items: prodList.map(a => a.title)
        },
        {
          name: '安全事件',
          count: incList.length,
          items: incList.map(a => a.title)
        }
      ]
    };
  }
  return result;
}

export async function getSources() {
  try {
    const db = await getPool();
    if (!db) {
      return { data: mockSources, mode: "mock" };
    }

    const result = await db.query("SELECT * FROM sources ORDER BY reliability DESC");
    return { data: result.rows.map(toCamelSource), mode: "postgres" };
  } catch (error) {
    console.warn("Falling back to mock sources:", error.message);
    return { data: mockSources, mode: "mock" };
  }
}

export async function getInitialState() {
  const [{ data: articleData, mode }, { data: sourceData }] = await Promise.all([
    getArticles(),
    getSources()
  ]);

  const dynamicCountryStats = buildCountryStats(articleData);
  const dynamicCountryFeeds = buildDynamicCountryFeeds(articleData);

  let topics = [];
  try {
    const rawTopics = getTopics();
    topics = rawTopics.map(t => {
      const { milestones, associatedOpinions } = assembleTopicDossier(t, articleData);
      return {
        ...t,
        milestoneCount: milestones.length,
        opinionCount: associatedOpinions.length,
        milestones,
        associatedOpinions
      };
    });
  } catch (err) {
    console.error('Failed to load topics in getInitialState:', err);
  }

  let dailyReports = [];
  let morningPreferences = DEFAULT_MORNING_PREFERENCES;
  try {
    if (typeof listReports === 'function') {
      dailyReports = listReports(50) || [];
    }
    if (typeof getSetting === 'function') {
      morningPreferences = getSetting('morning_report_preferences') || DEFAULT_MORNING_PREFERENCES;
    }
  } catch (err) {
    console.error('Failed to load reports in getInitialState:', err);
  }

  return {
    mode,
    articles: articleData,
    sources: sourceData,
    topics,
    countryStats: dynamicCountryStats,
    countryFeeds: dynamicCountryFeeds,
    crawlPlan,
    dailyBrief,
    dailyReports,
    morningPreferences,
    dashboard: buildDashboard(articleData, sourceData),
    reportPreview
  };
}

export function buildDashboard(articleData, sourceData) {
  const byType = countBy(articleData, "intelligenceType");
  const byRisk = countBy(articleData, "riskLevel");
  const byRegion = countBy(articleData, "region");
  const avgCredibility = Math.round(
    articleData.reduce((sum, item) => sum + item.credibilityScore, 0) / Math.max(articleData.length, 1)
  );

  return {
    totalArticles: articleData.length,
    activeSources: sourceData.length,
    highRisk: articleData.filter((item) => item.riskLevel === "高" || item.riskLevel === "高风险" || item.severity === "重大").length,
    avgCredibility: articleData.some(item => Number.isFinite(item.credibilityScore)) ? avgCredibility : '未评估',
    byType,
    byRisk,
    byRegion,
    updatedAt: new Date().toISOString()
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

export async function runCrawlSimulation() {
  const [{ data: articleData }, { data: sourceData }] = await Promise.all([
    getArticles(),
    getSources()
  ]);

  return {
    startedAt: new Date().toISOString(),
    sourceCount: sourceData.length,
    fetched: 12,
    deduplicated: 7,
    normalized: 5,
    analyzed: articleData.length,
    status: "success",
    message: "模拟采集完成：已完成公开来源拉取、正文清洗、去重、摘要分类和可信检查评分。"
  };
}

export { crawlPlan, dailyBrief, reportPreview };
