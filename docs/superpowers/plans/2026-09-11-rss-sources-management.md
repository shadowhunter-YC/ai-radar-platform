# Official RSS Feed Ingestion, AI Safety Filtering & Subscription Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement SQLite-backed persistent RSS subscription management with official AI safety/compliance presets, dual-layer topic relevance filtering to eliminate non-AI noise, and an interactive `/sources` frontend management interface.

**Architecture:** Extend SQLite schema in `lib/collection-store.mjs` with `rss_feeds` table; add feed-level XML keyword gatekeeper in `lib/collection-fetch.mjs` (Layer 1) and DeepSeek relevance verification in `app/api/collection/route.js` (Layer 2); expose `/api/sources` REST API; build a responsive `SourceManager` component in `/sources` to replace ephemeral in-memory state.

**Tech Stack:** Next.js 15 (App Router, Node.js runtime), SQLite (`node:sqlite` WAL mode), Cheerio (XML feed extraction), DeepSeek-V4-Pro (via SiliconFlow API), React.

---

### Task 1: SQLite Storage Layer & Official Preset Feeds

**Files:**
- Modify: `lib/collection-store.mjs`
- Modify: `tests/collection.test.mjs`

- [ ] **Step 1: Write the failing test for `rss_feeds` CRUD and presets**

Add tests to `tests/collection.test.mjs`:
```javascript
test('RSS 订阅源增删改查与官方预置', () => {
  const feeds = db.listRssFeeds();
  assert.ok(feeds.length >= 6, '默认自动初始化官方精选源');
  assert.ok(feeds.some(f => f.name.includes('CISA') && f.filterKeywords.includes('AI')));

  const custom = db.saveRssFeed({
    name: '测试合规源',
    url: 'https://example.com/rss.xml',
    category: '监管政策',
    filterKeywords: '合规,安全',
    enabled: 1
  });
  assert.ok(custom.id);
  assert.equal(custom.name, '测试合规源');

  const toggled = db.toggleRssFeed(custom.id, 0);
  assert.equal(toggled.enabled, 0);

  const deleted = db.deleteRssFeed(custom.id);
  assert.equal(deleted, true);
  assert.equal(db.getRssFeed(custom.id), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/collection.test.mjs`
Expected: FAIL with `db.listRssFeeds is not a function`

- [ ] **Step 3: Implement `rss_feeds` table schema and operations in `lib/collection-store.mjs`**

In `lib/collection-store.mjs`:
- Add `CREATE TABLE IF NOT EXISTS rss_feeds (...)` to `migrateSchema(s)`:
  - `id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT UNIQUE NOT NULL, category TEXT NOT NULL, description TEXT, filter_keywords TEXT, enabled INTEGER DEFAULT 1, cadence TEXT DEFAULT '每天', last_fetched_at TEXT, created_at TEXT NOT NULL`
  - Indexes: `idx_rss_category ON rss_feeds(category)`, `idx_rss_enabled ON rss_feeds(enabled)`.
- Define `OFFICIAL_PRESET_FEEDS` array with CISA, NIST AI, OWASP GenAI, Trail of Bits, OpenAI, Anthropic, Google Security, Microsoft Security.
- Add functions:
  - `seedRssFeedsIfEmpty(s)`
  - `listRssFeeds()`
  - `getRssFeed(id)`
  - `saveRssFeed({ id, name, url, category, description, filterKeywords, enabled, cadence })`
  - `toggleRssFeed(id, enabled)`
  - `deleteRssFeed(id)`
  - `resetRssFeeds()`

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/collection.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/collection-store.mjs tests/collection.test.mjs
git commit -m "feat: add rss_feeds SQLite schema, official presets and CRUD helpers"
```

---

### Task 2: Feed-Level AI Keyword Filter (Layer 1 Gatekeeper)

**Files:**
- Modify: `lib/collection-fetch.mjs:65-75`
- Modify: `tests/collection.test.mjs`

- [ ] **Step 1: Write the failing test for `extractFeed` keyword filtering**

In `tests/collection.test.mjs`:
```javascript
test('RSS 解析支持根据关键词门禁过滤无关内容', () => {
  const rss = `<rss><channel>
    <item><title>NVD CVE-2026-1234: Linux kernel buffer overflow</title><description>Legacy memory corruption</description><link>https://example.com/1</link></item>
    <item><title>CISA Alert: Emerging LLM Agent jailbreak techniques</title><description>Adversarial attacks against Generative AI models</description><link>https://example.com/2</link></item>
    <item><title>Apache Tomcat patch released</title><description>Regular maintenance release</description><link>https://example.com/3</link></item>
  </channel></rss>`;

  const all = extractFeed(Buffer.from(rss), 'https://example.com/feed');
  assert.equal(all.length, 3);

  const filtered = extractFeed(Buffer.from(rss), 'https://example.com/feed', 'AI, LLM, Generative AI, 大模型');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].url, 'https://example.com/2');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/collection.test.mjs`
Expected: FAIL with `all.length === 3` vs `filtered.length === 1`

- [ ] **Step 3: Update `extractFeed` in `lib/collection-fetch.mjs`**

Upgrade `extractFeed(buffer, url, filterKeywords = null)`:
- If `filterKeywords` is non-empty:
  - Tokenize `filterKeywords` into an array of lowercase strings.
  - For each `<item>` / `<entry>`, inspect `title` and `description` / `summary`.
  - Only retain items matching at least one token.
- Deduplicate and limit to 5 candidate articles per feed.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/collection.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/collection-fetch.mjs tests/collection.test.mjs
git commit -m "feat: add keyword gatekeeper to extractFeed to discard non-AI articles"
```

---

### Task 3: DeepSeek AI Relevance Guardrail (Layer 2) & Route Updates

**Files:**
- Modify: `app/api/collection/route.js`
- Test: `tests/collection.test.mjs`

- [ ] **Step 1: Write test for DeepSeek relevance guardrail schema**

In `tests/collection.test.mjs`, verify that analysis payload structure handles `isRelevant: boolean`:
```javascript
test('分析结果包含 isRelevant 主题研判', () => {
  const analysis = {
    isRelevant: true,
    summary: '测试摘要',
    category: '安全事件',
    tags: ['AI安全'],
    impact: '高',
    action: '自查',
    model: 'deepseek'
  };
  assert.equal(analysis.isRelevant, true);
});
```

- [ ] **Step 2: Update DeepSeek prompt in `app/api/collection/route.js`**

In `app/api/collection/route.js`:
- Update `system` prompt:
  - Explicitly require JSON output: `isRelevant(boolean，判断是否与人工智能/大模型/算法的安全、合规、监管、漏洞或风险治理直接相关。若完全为传统软硬件漏洞且与AI无关，必须设为false)`
  - Retain `summary`, `category`, `tags`, `impact`, `action`.
- In `POST` handler, handle `action: 'crawl_feed'`:
  - Fetch feed details from `getRssFeed(feedId)`.
  - Pass `feed.filterKeywords` into `extractFeed`.
  - Update `feed.lastFetchedAt = new Date().toISOString()`.
  - Return extracted drafts.

- [ ] **Step 3: Run unit tests**

Run: `node tests/collection.test.mjs`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/api/collection/route.js tests/collection.test.mjs
git commit -m "feat: add AI relevance guardrail to DeepSeek prompt and crawl_feed action"
```

---

### Task 4: RSS Feeds REST API (`/api/sources`)

**Files:**
- Create: `app/api/sources/route.js`
- Create: `tests/sources-api.test.mjs`

- [ ] **Step 1: Write route integration test**

Create `tests/sources-api.test.mjs`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST, DELETE } from '../app/api/sources/route.js';

test('/api/sources REST API 增删改查及预置恢复', async () => {
  const getRes = await GET();
  assert.equal(getRes.status, 200);
  const { sources } = await getRes.json();
  assert.ok(Array.isArray(sources));
  assert.ok(sources.length > 0);

  const addReq = new Request('http://localhost/api/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'save',
      feed: {
        name: '自定义测试源',
        url: 'https://test-compliance.org/feed',
        category: '监管政策',
        filterKeywords: 'AI, 合规'
      }
    })
  });
  const addRes = await POST(addReq);
  assert.equal(addRes.status, 200);
  const { feed } = await addRes.json();
  assert.equal(feed.name, '自定义测试源');

  const delReq = new Request(`http://localhost/api/sources?id=${feed.id}`, { method: 'DELETE' });
  const delRes = await DELETE(delReq);
  assert.equal(delRes.status, 200);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/sources-api.test.mjs`
Expected: FAIL (file not found)

- [ ] **Step 3: Implement `app/api/sources/route.js`**

Implement `GET`, `POST`, `DELETE` handlers:
- `GET`: Call `listRssFeeds()`. Return `{ sources }`.
- `POST`: Validate origin / inputs. Handle `action: 'save'`, `action: 'toggle'`, `action: 'reset'`.
- `DELETE`: Get `id` from URL search params. Call `deleteRssFeed(id)`. Return `{ success }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/sources-api.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/sources/route.js tests/sources-api.test.mjs
git commit -m "feat: implement /api/sources REST endpoint with validation and tests"
```

---

### Task 5: Frontend Subscription Management & Ingestion UI

**Files:**
- Create: `components/SourceManager.jsx`
- Modify: `components/RadarConsole.jsx`
- Modify: `components/ManualCollection.jsx`

- [ ] **Step 1: Create `SourceManager.jsx` component**

Features in `SourceManager.jsx`:
- Loads feeds from `GET /api/sources` on mount.
- Category filter chips: `全部`, `监管政策`, `AI安全`, `头部厂商`, `自定义`.
- Header action buttons:
  - `[＋ 新增 RSS 订阅]`: Opens modal with validation, category selector, and AI filter keywords helper.
  - `[⚡ 恢复官方预置]`: Calls `POST /api/sources` with `action: 'reset'`.
- Feed items cards:
  - Title, URL link, Category badge.
  - Keyword Gatekeeper tags display (e.g. `[AI, LLM, 算法]` or `[全量接收]`).
  - Active toggle switch (immediately calls `POST /api/sources` with `action: 'toggle'`).
  - Action buttons:
    - `[⚡ 立即采集]`: Triggers collection for this specific feed; dispatches event or calls collection API and brings results into the review area.
    - `[✏️ 编辑]`: Opens edit modal.
    - `[🗑️ 删除]`: Calls `DELETE /api/sources?id=...` with confirmation.

- [ ] **Step 2: Integrate `SourceManager` into `RadarConsole.jsx`**

In `components/RadarConsole.jsx`:
- Replace the in-memory `SourcesPage` with `SourceManager`.
- Keep layout coherent with cyber-dark theme (`var(--color-brand-...)`).

- [ ] **Step 3: Enhance `ManualCollection.jsx` to receive trigger events from `SourceManager`**

Support `choose-and-run-feed` event so when a user clicks `[⚡ 立即采集]` on any feed card, it smoothly scrolls to the collection workspace, initiates the feed crawl, applies keyword filtering, and shows the candidate articles for DeepSeek analysis.

- [ ] **Step 4: Verify Next.js build locally**

Run: `npm run build`
Expected: Build passes with 0 Webpack client/server errors.

- [ ] **Step 5: Commit**

```bash
git add components/SourceManager.jsx components/RadarConsole.jsx components/ManualCollection.jsx
git commit -m "feat: integrate persistent SourceManager UI with filtering, CRUD and ingestion"
```

---

### Task 6: Verification, Production Pack & NAS Deployment

**Files:**
- Package: `ai-radar-deploy.tar.gz`
- NAS Deployment: `Wilson-Home` (`192.168.1.107`)

- [ ] **Step 1: Run all unit and integration test suites**

Run: `node tests/article-library.test.mjs && node tests/collection.test.mjs && node tests/daily-report.test.mjs && node tests/sources-api.test.mjs`
Expected: 100% tests pass.

- [ ] **Step 2: Pack deployment bundle**

Run: `./deploy-nas.sh pack`
Expected: `ai-radar-deploy.tar.gz` generated successfully.

- [ ] **Step 3: Upload and rebuild on NAS**

Run `scp` and invoke `docker compose up -d --build` via `nas_run.sh`.

- [ ] **Step 4: Verify live site**

- Check `GET https://radar.wilsongo.top/api/sources` returns preset feeds.
- Open `https://radar.wilsongo.top/sources` and verify feed cards, toggle switches, keyword pills, and instant collection.
- Update `walkthrough.md`.
