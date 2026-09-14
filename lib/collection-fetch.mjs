import { lookup } from 'node:dns/promises';
import https from 'node:https';
import ipaddr from 'ipaddr.js';
import robotsParser from 'robots-parser';
import * as cheerio from 'cheerio';
const agent = 'AIRadarDemo';
export function normalizeUrl(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) throw new Error('仅支持公开HTTPS链接，不支持登录凭据或自定义端口。');
  u.hash = ''; return u;
}
export function isPublicAddress(address) { try { const ip = ipaddr.process(address); return ip.range() === 'unicast'; } catch { return false; } }
async function request(url, context) {
  const u = normalizeUrl(url);
  // Use only validated public addresses and pin the connection to that exact IP.
  const addresses = (await lookup(u.hostname, { all: true })).filter(a => isPublicAddress(a.address));
  if (!addresses.length) throw new Error('不允许访问本机、内网或保留地址。');
  if (++context.requests > 8) throw new Error('已达到本次8次网络请求上限。');
  const previous = context.last.get(u.hostname) || 0;
  await new Promise(resolve => setTimeout(resolve, Math.max(0, 1500 - (Date.now() - previous))));
  context.last.set(u.hostname, Date.now());
  return new Promise((resolve, reject) => {
    const addr = addresses.find(a => a.family === 4) || addresses[0];
    const req = https.get(u, { headers: { 'User-Agent': `${agent}/1.0 (manual collection; no scheduled crawling)`, Accept: 'text/html,application/xml,application/rss+xml,text/plain', 'Accept-Encoding': 'identity' },
      lookup: (_hostname, options, cb) => cb(null, options.all ? [addr] : addr.address, addr.family), signal: context.signal }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > 2000000) req.destroy(new Error('页面超过2MB限制。')); else chunks.push(chunk); });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', buffer: Buffer.concat(chunks) }));
    });
    req.setTimeout(15000, () => req.destroy(new Error('来源响应超时，请稍后或改用粘贴正文。')));
    req.on('error', reject);
  });
}
export async function allowedRead(url, context, options = {}) {
  const u = normalizeUrl(url);
  const isFeedOrInternal = options.skipRobots || u.hostname === 'wewe.wilsongo.top' || u.hostname === 'rss.wilsongo.top' || u.pathname.includes('/feeds/');
  if (!isFeedOrInternal) {
    if (!context.robots.has(u.origin)) {
      const robotUrl = `${u.origin}/robots.txt`, result = await request(robotUrl, context);
      if (result.status !== 404 && result.status !== 410 && result.status !== 200) throw new Error(`无法确认站点采集规则（robots HTTP ${result.status}），本次停止。`);
      if (result.status === 200 && /<html/i.test(result.buffer.toString('utf8'))) throw new Error('站点返回访问验证页面，已停止采集。');
      context.robots.set(u.origin, robotsParser(robotUrl, result.status === 200 ? result.buffer.toString('utf8') : ''));
    }
    const robot = context.robots.get(u.origin);
    if (robot.isAllowed(u.href, agent) === false) throw new Error('站点robots规则不允许采集此链接，已停止。');
    const delay = robot.getCrawlDelay(agent) || 0;
    if (delay > 15) throw new Error('站点要求较长采集间隔，本次演示不访问该来源。');
    if (delay > 1.5) await new Promise(resolve => setTimeout(resolve, delay * 1000));
  }
  const result = await request(u.href, context);
  if (result.status >= 300 && result.status < 400) throw new Error('链接发生跳转，请在浏览器打开后复制最终HTTPS地址。');
  if (result.status !== 200) throw new Error(`来源返回HTTP ${result.status}，本次停止；可改用粘贴正文。`);
  if (!/html|xml|text\/plain/i.test(result.type)) throw new Error('仅支持HTML或RSS/Atom文本，不支持文件下载。');
  return result.buffer;
}
export function extractArticle(buffer, url, fallbackText = '') {
  const $ = cheerio.loadBuffer(buffer);
  const title = ($('meta[property="og:title"]').attr('content') || $('h1').first().text() || $('title').text()).trim().slice(0, 300);
  const rawDate = $('meta[property="article:published_time"]').attr('content') || $('time[datetime]').first().attr('datetime');
  const publishedAt = rawDate && Number.isFinite(Date.parse(rawDate)) ? new Date(rawDate).toISOString() : null;
  $('script,style,nav,footer,header,aside,form,noscript,svg').remove();

  const candidates = [];
  if ($('main').length) candidates.push($('main').first());
  $('article').each((_, el) => candidates.push($(el)));
  if ($('.entry-content, .post-content, .article-body, #content').length) {
    candidates.push($('.entry-content, .post-content, .article-body, #content').first());
  }
  candidates.push($('body'));

  let bestText = '';
  for (const cand of candidates) {
    const ps = cand.find('p,h1,h2,h3,li').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
    const t = [...new Set(ps)].join('\n').slice(0, 12000);
    if (t.length > bestText.length) {
      bestText = t;
    }
  }

  let text = bestText;
  if ((!text || text.length < 200) && fallbackText && fallbackText.length >= 100) {
    text = fallbackText.slice(0, 12000);
  }

  if (!title || text.length < 200 || /just a moment|verify you are human|access denied/i.test(title)) throw new Error('未提取到足够正文，可能需要登录、脚本渲染或验证。请改用粘贴正文。');
  return { title, text, publishedAt, url, source: new URL(url).hostname, kind: 'web', collectedAt: new Date().toISOString() };
}
function compileKeywordFilter(filterKeywords) {
  if (!filterKeywords) return null;
  const rawKeywords = typeof filterKeywords === 'string'
    ? filterKeywords.split(/[,，\n|]/).map(k => k.trim()).filter(Boolean)
    : Array.isArray(filterKeywords)
      ? filterKeywords.map(k => String(k).trim()).filter(Boolean)
      : [];
  if (!rawKeywords.length) return null;
  const matchers = rawKeywords.map(k => {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (/^[a-zA-Z0-9_-]+$/.test(k)) {
      return new RegExp(`\\b${escaped}\\b`, 'i');
    }
    return new RegExp(escaped, 'i');
  });
  return text => matchers.some(rx => rx.test(text));
}

export function extractFeed(buffer, url, filterKeywords = null) {
  const $ = cheerio.load(buffer.toString('utf8'), { xml: true });
  if (!$('rss,feed').length) throw new Error('不是有效的RSS/Atom订阅地址，请填写订阅链接而非网站首页。');
  const seen = new Set(), entries = [];
  const matchesKeywords = compileKeywordFilter(filterKeywords);

  $('item,entry').each((_, el) => {
    const node = $(el);
    const title = node.find('title').first().text().trim();
    const description = (node.find('description').first().text() || node.find('summary').first().text() || node.find('content').first().text() || '').trim();

    if (matchesKeywords) {
      const targetText = `${title} ${description}`;
      if (!matchesKeywords(targetText)) return;
    }

    const rawContent = (node.find('content\\:encoded').text() || node.find('content').text() || node.find('description').text() || node.find('summary').text() || '').trim();
    let fallbackText = '';
    if (rawContent) {
      try {
        fallbackText = cheerio.load(rawContent).text().replace(/\s+/g, ' ').trim();
      } catch {
        fallbackText = rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }

    const raw = node.find('link[rel="alternate"]').attr('href') || node.find('link').first().attr('href') || node.find('link').first().text();
    try {
      let linkStr = raw.trim();
      if (linkStr.startsWith('http://mp.weixin.qq.com')) {
        linkStr = 'https://' + linkStr.slice(7);
      }
      const href = normalizeUrl(new URL(linkStr, url).href).href;
      if (!seen.has(href)) { seen.add(href); entries.push({ title, url: href, fallbackText }); }
    } catch {}
  });
  return entries.slice(0, 3);
}
export function fetchContext(signal) { return { requests: 0, last: new Map(), robots: new Map(), signal }; }
