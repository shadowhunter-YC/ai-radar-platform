import { normalizeTags } from './tag-taxonomy.mjs';

export const DEFAULT_PREFERENCES = {
  types: [],
  tags: [],
  period: '24h',
  date: '',
  limit: 20
};

export const DEFAULT_MORNING_PREFERENCES = {
  // 重点关注博主、领袖与专家
  trackedBloggers: [
    'Sam Altman',
    'Yann LeCun',
    'Andrej Karpathy',
    'Dan Hendrycks',
    'Bruce Schneier'
  ],
  // 重点关注法规、政策与国际标准
  trackedLegislation: [
    'EU AI Act',
    'NIST AI RMF',
    'ISO/IEC 42001',
    '生成式人工智能服务管理暂行办法',
    '网络安全标准'
  ],
  // 核心业务分类
  types: ['法规政策', 'AI安全标准', '安全产品突破', 'GitHub开源', '违规处罚与事件'],
  // 关注细分标签
  tags: ['安全护栏', '红蓝评测', 'Prompt注入', '越狱防护', '数据泄露', '漏洞预警'],
  // 时间跨度
  period: '24h', // '24h' | '3d' | '7d' | 'all' | 'date'
  date: '',
  limit: 20
};

export function matchBlogger(article, bloggers = []) {
  if (!Array.isArray(bloggers) || !bloggers.length) return null;
  const contentToSearch = [
    article.title,
    article.summary,
    article.originalExcerpt,
    article.source,
    article.affectedEntity,
    article.primaryAuthority
  ].filter(Boolean).join(' ').toLowerCase();

  for (const blogger of bloggers) {
    const b = String(blogger).trim().toLowerCase();
    if (b && contentToSearch.includes(b)) {
      return blogger;
    }
  }
  return null;
}

export function matchLegislation(article, legislations = []) {
  if (!Array.isArray(legislations) || !legislations.length) return null;
  const contentToSearch = [
    article.title,
    article.summary,
    article.originalExcerpt,
    article.detailTag,
    article.primaryDocTitle,
    ...(Array.isArray(article.tags) ? article.tags : [])
  ].filter(Boolean).join(' ').toLowerCase();

  for (const law of legislations) {
    const raw = String(law).trim();
    if (!raw) continue;
    // 拆分括号内外的完整短语，如 "EU AI Act (欧盟人工智能法案)" -> ["eu ai act", "欧盟人工智能法案"]
    const phrases = raw.split(/[()（）]/).map(s => s.trim().toLowerCase()).filter(s => s.length >= 3);
    for (const phrase of phrases) {
      if (contentToSearch.includes(phrase)) {
        return law;
      }
    }
  }
  return null;
}

export function selectedReportMode(articles, libraryMode) {
  const count = articles.filter(a => a.isSample === true || (a.isSample === undefined && libraryMode === 'mock')).length;
  return count === articles.length ? 'mock' : count ? 'mixed' : 'local';
}

export function reportModeLabel(mode) {
  return mode === 'mock' ? '示例新闻' : mode === 'mixed' ? '含示例新闻与入库文章' : '入库文章';
}

export function filterReportArticles(articles, p = DEFAULT_PREFERENCES, now = Date.now()) {
  const period = p.period || '24h';
  const trackedBloggers = p.trackedBloggers || [];
  const trackedLegislation = p.trackedLegislation || [];

  return articles.filter(a => {
    const time = new Date(a.publishedAt).getTime();
    if (period === '24h' && !(time >= now - 86400000 && time <= now)) return false;
    if (period === '3d' && !(time >= now - 86400000 * 3 && time <= now)) return false;
    if (period === '7d' && !(time >= now - 86400000 * 7 && time <= now)) return false;
    if (period === 'date' && (!Number.isFinite(time) || !p.date || new Date(time + 28800000).toISOString().slice(0, 10) !== p.date)) return false;

    // 分类筛选 (若未设定或为空，则全选)
    if (p.types && p.types.length && !p.types.includes(a.intelligenceType)) {
      return false;
    }

    // 标签筛选
    if (p.tags && p.tags.length) {
      const articleTags = a.tags || [];
      const normalized = normalizeTags(articleTags);
      const tagMatch = p.tags.some(tag => articleTags.includes(tag) || normalized.includes(tag));
      
      // 如果标签未直接匹配，但命中了重点关注博主或法案，依然允许入围
      const bloggerHit = matchBlogger(a, trackedBloggers);
      const lawHit = matchLegislation(a, trackedLegislation);
      if (!tagMatch && !bloggerHit && !lawHit) {
        return false;
      }
    }

    return true;
  }).map(a => {
    const matchedBlogger = matchBlogger(a, trackedBloggers);
    const matchedLegislation = matchLegislation(a, trackedLegislation);
    let priorityScore = 0;
    if (matchedBlogger) priorityScore += 20;
    if (matchedLegislation) priorityScore += 20;
    if (a.severity === '重大') priorityScore += 10;
    return {
      ...a,
      _matchedBlogger: matchedBlogger,
      _matchedLegislation: matchedLegislation,
      _priorityScore: priorityScore
    };
  }).sort((a, b) => {
    // 优先按关注偏好匹配加权排序，其次按发布时间倒序
    if (b._priorityScore !== a._priorityScore) {
      return b._priorityScore - a._priorityScore;
    }
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });
}

export async function* readSSE(body) {
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).replace(/\r$/, ''); buffer = buffer.slice(end + 1);
        if (line.startsWith('data:')) yield line.slice(5).trim();
      }
      if (done) { if (buffer.startsWith('data:')) yield buffer.slice(5).trim(); break; }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function safeSourceUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
