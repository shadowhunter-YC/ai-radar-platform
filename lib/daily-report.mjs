export const DEFAULT_PREFERENCES = { types: [], tags: [], period: 'all', date: '', limit: 10 };
export function selectedReportMode(articles, libraryMode) {
  const count = articles.filter(a => a.isSample === true || (a.isSample === undefined && libraryMode === 'mock')).length;
  return count === articles.length ? 'mock' : count ? 'mixed' : 'local';
}
export function reportModeLabel(mode) {
  return mode === 'mock' ? '示例新闻' : mode === 'mixed' ? '含示例新闻与入库文章' : '入库文章';
}
export function filterReportArticles(articles, p, now = Date.now()) {
  return articles.filter(a => {
    const time = new Date(a.publishedAt).getTime();
    if (p.period === '24h' && !(time >= now - 86400000 && time <= now)) return false;
    if (p.period === 'date' && (!Number.isFinite(time) || !p.date || new Date(time + 28800000).toISOString().slice(0, 10) !== p.date)) return false;
    return (!p.types.length || p.types.includes(a.intelligenceType)) && (!p.tags.length || p.tags.some(tag => normalizeTags(a.tags).includes(tag)));
  }).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
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
import { normalizeTags } from './tag-taxonomy.mjs';
