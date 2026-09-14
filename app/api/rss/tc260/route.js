import * as cheerio from 'cheerio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5分钟缓存

const TC260_BASE = 'https://www.tc260.org.cn';
const TC260_NEWS_URL = 'https://www.tc260.org.cn/tc260/xwdt1/list.shtml';

export async function GET() {
  try {
    const res = await fetch(TC260_NEWS_URL, {
      headers: {
        'User-Agent': 'AIRadarPlatform/1.0 (+https://radar.wilsongo.top)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      next: { revalidate: 300 }
    });

    if (!res.ok) {
      return new Response(`无法获取 TC260 官网内容 (HTTP ${res.status})`, { status: 502 });
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const items = [];

    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('/202') && href.endsWith('.shtml')) {
        const fullUrl = new URL(href, TC260_NEWS_URL).href;
        const title = $(el).text().trim();
        const parent = $(el).closest('li, tr, div');
        const dateText = parent.find('.date, span, em').text().trim() || '';

        if (title && !items.some(it => it.link === fullUrl)) {
          let pubDateRfc = '';
          if (dateText) {
            try {
              const dt = new Date(`${dateText}T08:00:00+08:00`);
              if (!isNaN(dt.getTime())) {
                pubDateRfc = dt.toUTCString();
              }
            } catch {}
          }
          if (!pubDateRfc) {
            pubDateRfc = new Date().toUTCString();
          }

          items.push({
            title,
            link: fullUrl,
            pubDate: pubDateRfc,
            description: `${title} - 全国网络安全标准化技术委员会 (TC260) 官方发布`
          });
        }
      }
    });

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>全国网络安全标准化技术委员会 (TC260) 官网动态</title>
    <link>${TC260_NEWS_URL}</link>
    <description>全国网安标委 (TC260) 官方新闻动态、标准实践指南与国家治理框架动态</description>
    <language>zh-cn</language>
    <atom:link href="https://radar.wilsongo.top/api/rss/tc260" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.map(item => `    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.link}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description><![CDATA[${item.description}]]></description>
    </item>`).join('\n')}
  </channel>
</rss>`;

    return new Response(rssXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (err) {
    return new Response(`生成 TC260 RSS 失败: ${err.message}`, { status: 500 });
  }
}
