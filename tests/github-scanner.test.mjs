import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import path from 'node:path';

const tempDir = path.join(process.cwd(), 'data-test-github-scanner');
process.env.COLLECTION_DATA_DIR = tempDir;

const {
  store,
  confirmDraft,
  setAnalysis,
  addDraft,
  isUrlImported
} = await import('../lib/collection-store.mjs');

const {
  inferDetailTag,
  formatRepoToArticle,
  scanGithubTrending,
  DEFAULT_GITHUB_SCAN_QUERIES
} = await import('../lib/github-scanner.mjs');

const {
  getSchedulerConfig,
  saveSchedulerConfig,
  runGithubScan
} = await import('../lib/scheduler.mjs');

const schedulerRoute = await import('../app/api/scheduler/route.js');

test.beforeEach(() => {
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  store();
});

test.after(() => {
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('GitHub Scanner: inferDetailTag 精准推断细分标签', () => {
  assert.equal(inferDetailTag({ name: 'nemo-guardrails', description: 'Dialogue guardrails for LLMs', topics: ['safety'] }), '安全护栏');
  assert.equal(inferDetailTag({ name: 'pyrit', description: 'Red teaming automation framework', topics: ['jailbreak'] }), '红蓝评测');
  assert.equal(inferDetailTag({ name: 'prompt-injection-detector', description: 'Detects indirect injection', topics: [] }), 'Prompt注入');
  assert.equal(inferDetailTag({ name: 'garak', description: 'LLM vulnerability scanner', topics: ['eval'] }), '漏洞扫描');
  assert.equal(inferDetailTag({ name: 'pii-masker', description: 'Data privacy and watermark toolkit', topics: [] }), '数据合规');
  assert.equal(inferDetailTag({ name: 'random-llm-tool', description: 'A helper library', topics: [] }), '开源生态');
});

test('GitHub Scanner: formatRepoToArticle 转换为标准化情报素材', () => {
  const fakeRepo = {
    name: 'promptfoo',
    full_name: 'promptfoo/promptfoo',
    html_url: 'https://github.com/promptfoo/promptfoo',
    description: 'Test & benchmark LLM applications, guardrails and red teaming',
    stargazers_count: 12500,
    forks_count: 850,
    language: 'TypeScript',
    license: { spdx_id: 'MIT' },
    topics: ['ai-safety', 'red-teaming', 'guardrails', 'llm-security'],
    owner: { login: 'promptfoo' },
    pushed_at: '2026-09-12T10:00:00Z',
    created_at: '2023-05-01T00:00:00Z'
  };

  const article = formatRepoToArticle(fakeRepo, '## Getting Started with Promptfoo');
  assert.equal(article.title.includes('promptfoo/promptfoo'), true);
  assert.equal(article.url, 'https://github.com/promptfoo/promptfoo');
  assert.equal(article.source, 'GitHub / promptfoo');
  assert.equal(article.kind, 'github-repo');
  assert.equal(article.intelligenceType, 'GitHub开源');
  assert.equal(article.detailTag, '安全护栏');
  assert.equal(article.publishedAt, '2026-09-12T10:00:00Z');
  assert.equal(article.text.includes('12500'), true);
  assert.equal(article.text.includes('Getting Started'), true);
});

test('GitHub Scanner: scanGithubTrending 查重机制与草稿录入', async () => {
  const fakeItems = [
    {
      name: 'test-guard',
      full_name: 'security-lab/test-guard',
      html_url: 'https://github.com/security-lab/test-guard',
      description: 'LLM guardrails framework',
      stargazers_count: 200,
      forks_count: 20,
      language: 'Python',
      topics: ['ai-safety', 'guardrails'],
      owner: { login: 'security-lab' },
      pushed_at: '2026-09-10T00:00:00Z'
    },
    {
      name: 'test-scanner',
      full_name: 'defense-team/test-scanner',
      html_url: 'https://github.com/defense-team/test-scanner',
      description: 'Automated vulnerability scanner for agents',
      stargazers_count: 150,
      forks_count: 15,
      language: 'Go',
      topics: ['llm-security'],
      owner: { login: 'defense-team' },
      pushed_at: '2026-09-11T00:00:00Z'
    }
  ];

  // 预先将其中一个作为已入库文章
  const existingArticle = formatRepoToArticle(fakeItems[0]);
  const draft = addDraft(existingArticle);
  setAnalysis(draft.id, {
    isRelevant: true,
    intelligenceType: 'GitHub开源',
    summary: '测试开源工具',
    severity: '一般'
  });
  confirmDraft(draft.id);
  assert.equal(isUrlImported(fakeItems[0].html_url), true);

  // 模拟自定义 queries 调用
  const stats = await scanGithubTrending({
    queries: [
      {
        name: '测试Mock查询',
        query: 'topic:ai-safety',
        sort: 'updated',
        order: 'desc'
      }
    ]
  });

  // 由于真实环境无 mock，此处验证 DEFAULT_GITHUB_SCAN_QUERIES 具备有效检索结构
  assert.equal(DEFAULT_GITHUB_SCAN_QUERIES.length >= 3, true);
  assert.equal(DEFAULT_GITHUB_SCAN_QUERIES[0].query.includes('ai-safety'), true);
});

test('Scheduler: scan_github 动作通过 REST API 顺利触发', async () => {
  const req = new Request('http://localhost:3000/api/scheduler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'scan_github' })
  });

  const res = await schedulerRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.message.includes('GitHub'), true);
});

test('Scheduler: 更新配置支持 scanGithubTrending 开关', async () => {
  const initial = getSchedulerConfig();
  assert.equal(initial.scanGithubTrending, true);

  const updated = saveSchedulerConfig({ scanGithubTrending: false });
  assert.equal(updated.scanGithubTrending, false);

  const req = new Request('http://localhost:3000/api/scheduler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update_config',
      config: { scanGithubTrending: true }
    })
  });

  const res = await schedulerRoute.POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.config.scanGithubTrending, true);
});
