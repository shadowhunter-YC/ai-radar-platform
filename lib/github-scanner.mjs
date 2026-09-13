import { isUrlImported, cachedDraft, addDraft } from './collection-store.mjs';

const GITHUB_API_BASE = 'https://api.github.com';
const USER_AGENT = 'AIRadarPlatform/1.0 (AI Safety & Security Scanner)';

/**
 * 默认扫描的 AI 安全检索表达式组合
 */
export const DEFAULT_GITHUB_SCAN_QUERIES = [
  {
    name: 'AI安全与治理项目',
    query: 'topic:ai-safety stars:>15',
    sort: 'updated',
    order: 'desc'
  },
  {
    name: '大模型攻防与安全审计',
    query: 'topic:llm-security stars:>15',
    sort: 'updated',
    order: 'desc'
  },
  {
    name: '运行时安全护栏',
    query: 'topic:guardrails stars:>15',
    sort: 'updated',
    order: 'desc'
  },
  {
    name: 'Prompt注入与越狱防御',
    query: 'topic:prompt-injection stars:>15',
    sort: 'updated',
    order: 'desc'
  },
  {
    name: '评测基准与自动化靶场',
    query: 'promptfoo OR garak OR PyRIT OR "llm guardrails" stars:>20',
    sort: 'updated',
    order: 'desc'
  }
];

/**
 * 推断项目的细分标签
 */
export function inferDetailTag(repo) {
  const text = `${repo.name || ''} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
  if (text.includes('guardrail') || text.includes('护栏')) {
    return '安全护栏';
  }
  if (text.includes('red-team') || text.includes('jailbreak') || text.includes('越狱') || text.includes('adversarial')) {
    return '红蓝评测';
  }
  if (text.includes('prompt-injection') || text.includes('injection') || text.includes('注入')) {
    return 'Prompt注入';
  }
  if (text.includes('benchmark') || text.includes('eval') || text.includes('scanner') || text.includes('vulnerability') || text.includes('audit')) {
    return '漏洞扫描';
  }
  if (text.includes('privacy') || text.includes('pii') || text.includes('watermark') || text.includes('脱敏') || text.includes('水印')) {
    return '数据合规';
  }
  return '开源生态';
}

/**
 * 执行单次 GitHub 仓库搜索
 */
export async function searchGithubRepositories(query, { sort = 'updated', order = 'desc', perPage = 10, signal, token } = {}) {
  const q = encodeURIComponent(query);
  const url = `${GITHUB_API_BASE}/search/repositories?q=${q}&sort=${sort}&order=${order}&per_page=${perPage}`;
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/vnd.github.v3+json'
  };

  const authToken = token || process.env.GITHUB_TOKEN;
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(url, {
    method: 'GET',
    headers,
    signal: signal || AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`GitHub API 查询失败 (HTTP ${res.status}): ${errBody.slice(0, 160)}`);
  }

  const data = await res.json();
  return data.items || [];
}

/**
 * 获取仓库 README 核心正文
 */
export async function fetchRepoReadme(owner, repo, { signal, token } = {}) {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`;
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/vnd.github.raw+json'
  };

  const authToken = token || process.env.GITHUB_TOKEN;
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: signal || AbortSignal.timeout(10000)
    });

    if (res.ok) {
      const text = await res.text();
      return text.slice(0, 8000);
    }
  } catch {}

  return '';
}

/**
 * 将 GitHub 仓库元数据转为标准化资讯素材
 */
export function formatRepoToArticle(repo, readmeText = '') {
  const ownerLogin = repo.owner?.login || '开源贡献者';
  const repoName = repo.name || '未命名项目';
  const desc = repo.description ? repo.description.trim() : 'AI 安全与大模型防御开源项目';
  const stars = repo.stargazers_count || 0;
  const forks = repo.forks_count || 0;
  const lang = repo.language || 'Python';
  const license = repo.license?.spdx_id || repo.license?.name || 'Open Source';
  const topics = Array.isArray(repo.topics) ? repo.topics : [];
  const detailTag = inferDetailTag(repo);

  // 拼接具有高研判价值的正文素材
  const overview = [
    `GitHub 标杆开源项目：${repo.full_name}`,
    `项目地址: ${repo.html_url}`,
    `项目定位与描述: ${desc}`,
    `核心技术指标: Star 标星 ${stars}，Fork 分支 ${forks}，主要编程语言 ${lang}，开源协议 ${license}`,
    `安全与技术标签: ${topics.join(', ') || 'AI Safety'}`,
    `最新代码提交/发布时间: ${repo.pushed_at || repo.updated_at || repo.created_at}`,
    '\n--- 项目核心文档与功能说明 ---',
    readmeText ? readmeText.slice(0, 6000) : desc
  ].join('\n');

  // 时间优先采用最近更新或推送时间，若无则使用创建时间
  const eventDate = repo.pushed_at || repo.updated_at || repo.created_at || new Date().toISOString();

  return {
    title: `GitHub 热门开源：${repo.full_name} (${desc.slice(0, 80)})`,
    text: overview,
    publishedAt: eventDate,
    timelineDate: eventDate,
    url: repo.html_url,
    primaryUrl: repo.html_url,
    source: `GitHub / ${ownerLogin}`,
    kind: 'github-repo',
    intelligenceType: 'GitHub开源',
    detailTag,
    affectedEntity: ownerLogin,
    severity: '一般',
    tags: ['GitHub', '开源安全', ...topics.slice(0, 3)].filter(Boolean),
    collectedAt: new Date().toISOString()
  };
}

/**
 * 扫描 GitHub AI 安全开源每日趋势
 */
export async function scanGithubTrending({
  queries = DEFAULT_GITHUB_SCAN_QUERIES,
  perQueryLimit = 5,
  maxTotal = 15,
  signal,
  token
} = {}) {
  const stats = {
    queried: 0,
    reposFound: 0,
    skippedDuplicates: 0,
    draftsCreated: [],
    errors: []
  };

  const seenUrls = new Set();

  for (const qObj of queries) {
    if (signal?.aborted) break;
    stats.queried++;

    try {
      const items = await searchGithubRepositories(qObj.query, {
        sort: qObj.sort,
        order: qObj.order,
        perPage: perQueryLimit,
        signal,
        token
      });

      for (const repo of items) {
        if (!repo?.html_url) continue;
        if (seenUrls.has(repo.html_url)) continue;
        seenUrls.add(repo.html_url);

        // 1. 严格排重：已入库则跳过
        if (isUrlImported(repo.html_url)) {
          stats.skippedDuplicates++;
          continue;
        }

        // 2. 检查是否有草稿
        let draft = cachedDraft(repo.html_url);
        if (!draft) {
          // 抓取 README 丰富正文
          const readme = await fetchRepoReadme(repo.owner?.login, repo.name, { signal, token });
          const article = formatRepoToArticle(repo, readme);
          draft = addDraft(article);
        }

        if (draft) {
          stats.draftsCreated.push(draft);
          stats.reposFound++;
        }

        if (stats.draftsCreated.length >= maxTotal) {
          break;
        }
      }
    } catch (err) {
      stats.errors.push({ query: qObj.name, error: err.message });
      // 如果触发限流，不再连续发送请求
      if (err.message.includes('403') || err.message.includes('rate limit')) {
        break;
      }
    }

    if (stats.draftsCreated.length >= maxTotal) {
      break;
    }
  }

  return stats;
}
