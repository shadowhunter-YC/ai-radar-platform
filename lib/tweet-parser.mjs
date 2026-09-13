import * as cheerio from 'cheerio';

const TRIVIAL_TITLE_REGEX = /^(yes|no|agreed|true|100%|looking into this|looking into it|indeed|right|exactly|cool|wow|thanks|yep|nope|confirmed|sounds right)[\.!\s]*$/i;

/**
 * 判断是否为 X / Twitter 相关的链接或来源
 */
export function isTweetSource(url = '', source = '') {
  const u = String(url || '').toLowerCase();
  const s = String(source || '').toLowerCase();
  return (
    u.includes('x.com') ||
    u.includes('twitter.com') ||
    u.includes('/twitter/user/') ||
    u.includes('/twitter/list/') ||
    u.includes('rss.wilsongo.top') ||
    s.includes('x (') ||
    s.includes('twitter')
  );
}

/**
 * 清洗 X / Twitter 的 HTML 正文，保留引用与回复的换行结构
 */
export function cleanTweetHtml(htmlOrText = '') {
  if (!htmlOrText) return '';
  try {
    const $ = cheerio.load(String(htmlOrText));
    // 将 <br> 替换为换行
    $('br').replaceWith('\n');
    // 为段落、引用块、div 添加换行隔离
    $('p, blockquote, div').each((_, el) => {
      $(el).prepend('\n').append('\n');
    });
    return $.text()
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  } catch {
    return String(htmlOrText)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

/**
 * 从 URL 或信源中提取 Twitter 用户名 Handle
 */
export function extractTwitterHandle(url = '', source = '') {
  const u = String(url || '');
  const urlMatch = u.match(/(?:x|twitter)\.com\/([a-zA-Z0-9_]+)/i) || u.match(/twitter\/user\/([a-zA-Z0-9_]+)/i);
  if (urlMatch && !['i', 'status', 'hashtag', 'search'].includes(urlMatch[1].toLowerCase())) {
    return urlMatch[1];
  }
  const s = String(source || '');
  const srcMatch = s.match(/@([a-zA-Z0-9_]+)/);
  if (srcMatch) return srcMatch[1];
  return '';
}

/**
 * 针对 X / Twitter 推文解析标题与结构化正文
 */
export function parseTweetDraftPayload({ rawTitle = '', rawContent = '', url = '', source = '' } = {}) {
  const cleanedText = cleanTweetHtml(rawContent || rawTitle);
  const handle = extractTwitterHandle(url, source);
  const authorDisplay = handle ? `@${handle}` : (source || 'X博主');

  let title = String(rawTitle || '').trim();
  // 移除常见的 RT 头部
  title = title.replace(/^RT\s+@?[a-zA-Z0-9_]+:\s*/i, '').trim();

  // 检查是否包含回复/引用上下文 (例如 "Re @someone: ..." 或 "<blockquote>...")
  let isReplyOrQuote = false;
  let contextTarget = '';
  let contextSnippet = '';

  const replyMatch = cleanedText.match(/(?:Re\s+@([a-zA-Z0-9_]+):\s*([\s\S]+))/i) ||
                     cleanedText.match(/(?:回复\s+@([a-zA-Z0-9_]+)[：:]\s*([\s\S]+))/i);

  if (replyMatch) {
    isReplyOrQuote = true;
    contextTarget = `@${replyMatch[1]}`;
    contextSnippet = replyMatch[2].replace(/\s+/g, ' ').trim().slice(0, 70);
  }

  // 判断原始标题是否过短、为极简回应（如 "yes"）或无明确意义
  const isTrivial = TRIVIAL_TITLE_REGEX.test(title) || title.length <= 15;

  let finalTitle = title;
  if (isTrivial) {
    if (contextSnippet) {
      finalTitle = `${authorDisplay} 回复推文表示认同（${title || '简评'}）：“${contextSnippet}”`;
    } else if (cleanedText.length > title.length + 10) {
      const rest = cleanedText.replace(new RegExp(`^${title}[\\s,.:;!]*`, 'i'), '').trim();
      const snippet = rest.slice(0, 60).replace(/\s+/g, ' ');
      finalTitle = `${authorDisplay} 发推点评：“${snippet}”`;
    } else {
      finalTitle = `${authorDisplay} X平台推文动态：“${title || '动态简述'}”`;
    }
  }

  // 整理供大模型理解的结构化正文
  const structuredText = [
    `【推特信源】${authorDisplay}`,
    `【推文原词】${title || cleanedText.slice(0, 100)}`,
    isReplyOrQuote ? `【互动属性】回复/引用推文（回应对象: ${contextTarget}）` : null,
    contextSnippet ? `【被回复推文议题】${contextSnippet}` : null,
    `【正文全文】\n${cleanedText}`,
    url ? `【原始链接】${url}` : null
  ].filter(Boolean).join('\n\n');

  return {
    title: finalTitle,
    text: structuredText.slice(0, 12000),
    source: handle ? `X (@${handle})` : (source || 'X (Twitter)'),
    handle,
    isTrivial
  };
}
