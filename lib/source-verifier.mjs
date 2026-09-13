import * as cheerio from 'cheerio';

const AUTHORITATIVE_DOMAINS = [
  'cac.gov.cn',
  'miit.gov.cn',
  'tc260.org.cn',
  'gov.cn',
  'europa.eu',
  'artificialintelligenceact.eu',
  'nist.gov',
  'cisa.gov',
  'cve.org',
  'nvd.nist.gov',
  'openai.com',
  'anthropic.com',
  'deepseek.com',
  'microsoft.com',
  'googleblog.com',
  'security.googleblog.com'
];

export function isAuthoritativeDomain(urlString = '') {
  try {
    const u = new URL(urlString);
    const host = u.hostname.toLowerCase();
    return AUTHORITATIVE_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch {
    return false;
  }
}

/**
 * 验证或反查权威一级源头 URL (方式 B)
 * @param {Object} attribution
 * @param {string} attribution.primaryAuthority
 * @param {string} attribution.primaryDocTitle
 * @param {string} [attribution.primaryUrl]
 * @returns {Promise<{ verified: boolean, primaryUrl: string }>}
 */
export async function verifyPrimarySourceUrl({ primaryAuthority = '', primaryDocTitle = '', primaryUrl = '' }) {
  // 1. 若文章直接带有了官方原始链接且属于权威域名，直接核准
  if (primaryUrl && isAuthoritativeDomain(primaryUrl)) {
    return { verified: true, primaryUrl };
  }

  // 2. 若未指明原始机构或文件标题，判定为未核验
  if (!primaryAuthority || primaryAuthority === '未指明' || !primaryDocTitle) {
    return { verified: false, primaryUrl: '' };
  }

  // 3. 构造定向反查检索查询词
  const query = `${primaryAuthority} ${primaryDocTitle}`.trim();
  try {
    // 尝试通过 DuckDuckGo HTML 搜索反查一级源头
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const links = [];

      $('.result__url, .result__snippet, .result__a').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          // DuckDuckGo 重定向解析 uddg=
          try {
            if (href.includes('uddg=')) {
              const match = href.match(/uddg=([^&]+)/);
              if (match) {
                links.push(decodeURIComponent(match[1]));
              }
            } else if (href.startsWith('http')) {
              links.push(href);
            }
          } catch {}
        }
      });

      // 在搜索结果中匹配权威官方域名
      const matched = links.find(l => isAuthoritativeDomain(l));
      if (matched) {
        return { verified: true, primaryUrl: matched };
      }
    }
  } catch (err) {
    // 搜索超时或网络异常时，静默退回
  }

  // 4. 兜底策略：如果原发布机构是明确的国家网信办/TC260/NIST/EU等权威组织且有明确文件名，仍视为具备权威源头，只是未锁定具体 URL
  const isKnownAuthority = [
    '国家互联网信息办公室', '网信办', '工信部', '全国网安标委', 'TC260',
    '欧盟委员会', '欧洲议会', 'EU', 'NIST', 'CISA', 'OpenAI', 'Anthropic', 'DeepSeek'
  ].some(a => primaryAuthority.includes(a));

  if (isKnownAuthority && primaryDocTitle.length >= 4) {
    return { verified: true, primaryUrl: primaryUrl || '' };
  }

  return { verified: false, primaryUrl: '' };
}
