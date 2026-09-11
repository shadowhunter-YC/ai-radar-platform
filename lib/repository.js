import {
  articles as mockArticles,
  countryStats,
  countryFeeds,
  crawlPlan,
  dailyBrief,
  reportPreview,
  sources as mockSources
} from "./mock-data";

import { importedArticles } from './collection-store.mjs';
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
  const combine = (existing, existingMode) => {
    const result = combineArticles(existing, imported, existingMode);
    return { ...result, data: applyFilters(result.data, filters) };
  };
  try {
    const db = await getPool();
    if (!db) {
      return combine(mockArticles, 'mock');
    }

    const result = await db.query("SELECT * FROM articles ORDER BY published_at DESC LIMIT 100");
    return combine(result.rows.map(toCamelArticle), 'postgres');
  } catch (error) {
    console.warn("Falling back to mock articles:", error.message);
    return combine(mockArticles, 'mock');
  }
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

  return {
    mode,
    articles: articleData,
    sources: sourceData,
    countryStats,
    countryFeeds,
    crawlPlan,
    dailyBrief,
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
    highRisk: articleData.filter((item) => item.riskLevel === "高").length,
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

export { countryFeeds, countryStats, crawlPlan, dailyBrief, reportPreview };
