import * as cheerio from 'cheerio';

export const CURATED_TWITTER_RECOMMENDATIONS = {
  topics: [
    {
      name: 'AI安全与治理前沿',
      query: '"AI safety" OR "AI alignment" OR "AI governance"',
      minFaves: '50',
      description: '全网高赞 AI 安全、模型对齐与算法治理核心讨论'
    },
    {
      name: '加州 SB 1047 与全球法案争议',
      query: '"SB 1047" OR "AI regulation" OR "EU AI Act"',
      minFaves: '50',
      description: '围绕加州 SB 1047 法案与全球大模型监管立法的白热化交锋'
    },
    {
      name: '大模型越狱与红蓝攻防',
      query: '"jailbreak" OR "prompt injection" OR "LLM red teaming"',
      minFaves: '50',
      description: '最新的大语言模型越狱漏洞、Prompt注入渗透与前沿攻防'
    },
    {
      name: 'AI 减速论与末日风险大辩论',
      query: 'Dario OR "slow down AI" OR "pause AI" OR "existential risk"',
      minFaves: '30',
      description: 'Anthropic Dario 减速呼吁引发的产业领袖周末大辩论'
    },
    {
      name: '开源模型权重与安全护栏',
      query: '"open weights" OR "Llama Guard" OR "open source AI safety"',
      minFaves: '30',
      description: 'Meta开源权重安全争议与新一代运行时安全护栏技术'
    }
  ],
  leaders: [
    {
      name: 'Dario Amodei',
      handle: 'DarioAmodei',
      role: 'Anthropic CEO',
      description: 'Anthropic 联合创始人兼 CEO，安全派与模型对齐核心代表'
    },
    {
      name: 'Sam Altman',
      handle: 'sama',
      role: 'OpenAI CEO',
      description: 'OpenAI 创始人兼 CEO，大模型产业领袖与商业化推动者'
    },
    {
      name: 'Elon Musk',
      handle: 'elonmusk',
      role: 'xAI / Tesla',
      description: 'xAI 创始人，长期深度关注超级智能安全与通用风险'
    },
    {
      name: 'Yann LeCun',
      handle: 'ylecun',
      role: 'Meta Chief AI Scientist',
      description: '图灵奖得主、Meta 首席 AI 科学家，开源与技术乐观派旗手'
    },
    {
      name: 'Gary Marcus',
      handle: 'GaryMarcus',
      role: 'NYU Professor / Author',
      description: '纽约大学名誉教授，知名 AI 批评家与监管听证会专家'
    },
    {
      name: 'Dan Hendrycks',
      handle: 'DanHendrycks',
      role: 'CAIS Executive Director',
      description: 'Center for AI Safety 执行董事，前沿灾难性风险专家'
    },
    {
      name: 'Eliezer Yudkowsky',
      handle: 'ESYudkowsky',
      role: 'MIRI Co-founder',
      description: '机器智能研究院 (MIRI) 联合创始人，AI 对齐理论先驱'
    }
  ]
};

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
    u.includes('/twitter/keyword/') ||
    u.includes('/twitter/search/') ||
    u.includes('rss.wilsongo.top') ||
    s.includes('x (') ||
    s.includes('twitter') ||
    s.includes('x热点') ||
    s.includes('x/twitter')
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
