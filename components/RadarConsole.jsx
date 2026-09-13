"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import MorningReport from "./MorningReport";
import ManualCollection from "./ManualCollection";
import SourceManager from "./SourceManager";
import LlmConfigModal from "./LlmConfigModal";
import TopicTimelineBoard from "./TopicTimelineBoard";
import { CANONICAL_TAGS, normalizeTags, matchesType, getCategoryMeta } from "@/lib/tag-taxonomy.mjs";

const navItems = [
  { key: "overview", label: "情报驾驶舱", href: "/", icon: "dashboard" },
  { key: "morning", label: "每日AI早报", href: "/morning", icon: "morning" },
  { key: "topics", label: "AI情报时间线", href: "/topics", icon: "timeline" },
  { key: "analysis", label: "资讯库", href: "/analysis", icon: "library" },
  { key: "sources", label: "资讯源配置", href: "/sources", icon: "source" },
  { key: "credibility", label: "可信检查配置", href: "/credibility", icon: "shield" }
];

const pageMeta = {
  overview: {
    eyebrow: "",
    title: "AI情报驾驶舱",
    description: ""
  },
  topics: {
    eyebrow: "",
    title: "AI情报时间线",
    description: ""
  },
  sources: {
    eyebrow: "",
    title: "AI资讯源配置",
    description: ""
  },
  analysis: {
    eyebrow: "",
    title: "情报清单",
    description: ""
  },
  credibility: {
    eyebrow: "",
    title: "可信检查配置",
    description: ""
  },
  morning: {
    eyebrow: "",
    title: "每日AI早报",
    description: ""
  },
  reports: {
    eyebrow: "",
    title: "每日AI早报",
    description: ""
  }
};

const riskTone = {
  高: "danger",
  中: "warning",
  低: "success"
};

const layerOptions = [
  { key: "security", label: "处罚与事件", category: "安全事件", tone: "red" },
  { key: "regulation", label: "法规标准", category: "合规动态", tone: "yellow" },
  { key: "product", label: "产品突破", category: "产品动态", tone: "blue" }
];

const trustSignals = [
  {
    key: "source",
    label: "检测点：来源身份与权威性",
    description: "真实可落地。识别官方站点、公开镜像、论坛和未知来源的可信差异。"
  },
  {
    key: "crossCheck",
    label: "检测点：多来源交叉验证",
    description: "真实可落地。检查同一资讯是否能被官方说明、公开新闻或报告侧面印证。"
  },
  {
    key: "aiTrace",
    label: "检测点：文本生成痕迹",
    description: "启发式检测。识别模板化表达、事实密度不足、重复措辞等疑似AI改写信号。"
  },
  {
    key: "metadata",
    label: "检测点：C2PA / XMP / EXIF 元数据",
    description: "真实技术方向。参考 aicheck 对内容元数据和来源证据的检查思路。"
  },
  {
    key: "watermark",
    label: "检测点：已知水印机制",
    description: "真实技术方向，但仅适用于接入对应水印机制的内容，不代表可检测所有模型文本。"
  },
  {
    key: "time",
    label: "检测点：发布时间与转载链",
    description: "真实可落地。判断发布时间、转载链和镜像页时间是否存在不确定性。"
  }
];

export default function RadarConsole({ initialArticleId, initialState, view = "overview" }) {
  const [selectedRegion, setSelectedRegion] = useState("全部");
  const [selectedCountryCode, setSelectedCountryCode] = useState(initialState.countryStats[0]?.code || "US");
  const [activeLayers, setActiveLayers] = useState({
    security: true,
    regulation: true,
    product: true
  });
  const [selectedType, setSelectedType] = useState("全部");
  const [selectedTag, setSelectedTag] = useState("全部");
  const [selectedMonth, setSelectedMonth] = useState("全部");
  const [selectedCredibility, setSelectedCredibility] = useState("全部");
  const [searchQuery, setSearchQuery] = useState("");
  const [articles, setArticles] = useState(initialState.articles);
  const [selectedArticleId, setSelectedArticleId] = useState(initialArticleId || initialState.articles[0]?.id);
  const [configuredSources, setConfiguredSources] = useState(initialState.sources);
  const [overviewTimeSpan, setOverviewTimeSpan] = useState("all");

  function filterByTimeSpan(list = [], timeSpan = 'all') {
    if (!Array.isArray(list) || timeSpan === 'all') return list;
    const now = Date.now();
    return list.filter((item) => {
      const dStr = item.eventDate || item.primaryDate || item.publishedAt;
      if (!dStr) return true;
      const t = new Date(dStr).getTime();
      if (isNaN(t)) return true;
      const diffHours = (now - t) / (1000 * 60 * 60);
      if (timeSpan === 'today') {
        const isSameDay = new Date(dStr).toDateString() === new Date().toDateString();
        return isSameDay || (diffHours >= 0 && diffHours <= 36);
      }
      if (timeSpan === 'week') {
        return diffHours >= 0 && diffHours <= 7 * 24;
      }
      if (timeSpan === 'month') {
        return diffHours >= 0 && diffHours <= 31 * 24;
      }
      return true;
    });
  }

  function handleUpdateCategory(articleId, newCategory) {
    setArticles((prev) =>
      prev.map((a) => (a.id === articleId ? { ...a, intelligenceType: newCategory, category: newCategory } : a))
    );
    fetch('/api/articles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: articleId, intelligenceType: newCategory })
    }).catch((err) => console.error('Failed to update category:', err));
  }

  const [currentUser, setCurrentUser] = useState(null);
  const [llmModalOpen, setLlmModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("radar.sidebar.collapsed");
      if (saved !== null) {
        setSidebarCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("radar.sidebar.collapsed", String(next));
      } catch {}
      return next;
    });
  }

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => {
        if (data.loggedIn && data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      })
      .catch(() => setCurrentUser(null));
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" })
      });
      setCurrentUser(null);
      window.location.reload();
    } catch {}
  }

  const meta = pageMeta[view] || pageMeta.overview;
  const allTags = useMemo(
    () => ["全部", ...CANONICAL_TAGS],
    []
  );
  const allTypes = useMemo(
    () => ["全部", "法规政策", "AI安全标准", "安全产品突破", "GitHub开源", "违规处罚与事件", "行业动态"],
    []
  );
  const allMonths = useMemo(
    () => ["全部", ...new Set(articles.map((item) => item.publishedAt.slice(0, 7)))],
    [articles]
  );

  const timeFilteredArticles = useMemo(() => {
    return filterByTimeSpan(articles, overviewTimeSpan);
  }, [articles, overviewTimeSpan]);

  const filteredArticles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return articles.filter((item) => {
      if (selectedRegion !== "全部" && item.region !== selectedRegion) return false;
      if (selectedType !== "全部" && !matchesType(item.intelligenceType, selectedType)) return false;
      if (selectedTag !== "全部" && !normalizeTags(item.tags).includes(selectedTag)) return false;
      if (selectedMonth !== "全部" && item.publishedAt.slice(0, 7) !== selectedMonth) return false;
      if (selectedCredibility !== "全部" && getCredibilityLevel(item.credibilityScore) !== selectedCredibility) return false;
      if (query) {
        const searchableText = [
          item.title,
          item.summary,
          item.originalExcerpt,
          item.source,
          item.sourceType,
          item.region,
          item.intelligenceType,
          ...normalizeTags(item.tags)
        ]
          .join(" ")
          .toLowerCase();

        const tokens = query.split(/\s+/).filter(Boolean);
        const matchAll = tokens.every((token) => {
          if (token === 'hugging' || token === 'face' || token === 'huggingface' || token === 'hf') {
            return (
              searchableText.includes('hugging') ||
              searchableText.includes('huggingface') ||
              searchableText.includes('hf')
            );
          }
          return searchableText.includes(token);
        });
        if (!matchAll) return false;
      }
      return true;
    });
  }, [articles, searchQuery, selectedCredibility, selectedMonth, selectedRegion, selectedTag, selectedType]);

  const selectedArticle =
    filteredArticles.find((item) => item.id === selectedArticleId) ||
    filteredArticles[0] ||
    articles[0];

  function resetFilters() {
    setSelectedRegion("全部");
    setSelectedType("全部");
    setSelectedTag("全部");
    setSelectedMonth("全部");
    setSelectedCredibility("全部");
    setSearchQuery("");
  }

  return (
    <div className={`workspace-shell ${sidebarCollapsed ? "is-collapsed" : ""}`}>
      <aside className="app-sidebar" aria-label="平台导航">
        <div className="app-sidebar__brand">
          <div className="app-sidebar__brand-main">
            <span className="app-sidebar__mark" aria-hidden="true">
              <NavIcon name="radar" />
            </span>
            {!sidebarCollapsed && (
              <span>
                <strong>
                  AI安全合规雷达
                  <span style={{ color: "var(--color-brand)", fontSize: "1.3em", lineHeight: 1, marginLeft: 2 }}>.</span>
                </strong>
              </span>
            )}
          </div>
          <button
            type="button"
            className="app-sidebar__toggle"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "展开导航栏" : "折叠导航栏"}
            aria-label={sidebarCollapsed ? "展开导航栏" : "折叠导航栏"}
          >
            {sidebarCollapsed ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </button>
        </div>
        <nav className="app-sidebar__nav">
          {navItems.map((item) => (
            <a
              className={`app-sidebar__item ${view === item.key ? "is-active" : ""}`}
              href={item.href}
              key={item.key}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="app-sidebar__icon" aria-hidden="true">
                <NavIcon name={item.icon} />
              </span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </a>
          ))}
        </nav>

        {/* 用户登录与大模型配置入口 */}
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", width: "100%" }}>
          {currentUser ? (
            sidebarCollapsed ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <span
                  title={`${currentUser.username} (已登录)`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "rgba(134,188,37,0.15)",
                    border: "1px solid rgba(134,188,37,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--color-brand-strong)",
                    cursor: "default"
                  }}
                >
                  U
                </span>
                <button
                  type="button"
                  onClick={() => setLlmModalOpen(true)}
                  title="大模型配置"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    background: "rgba(134,188,37,0.12)",
                    border: "1px solid rgba(134,188,37,0.3)",
                    color: "#86bc25",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  设置
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="退出登录"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--color-text-secondary, #9ea5b3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: 12
                  }}
                >
                  退出
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "rgba(134,188,37,0.15)",
                        border: "1px solid rgba(134,188,37,0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--color-brand-strong)"
                      }}
                    >
                      A
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                      <strong style={{ fontSize: 13, color: "#fff" }}>{currentUser.username}</strong>
                      <span style={{ fontSize: 10, color: "#86bc25" }}>● 已登录</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    title="退出登录"
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "var(--color-text-secondary, #9ea5b3)",
                      cursor: "pointer",
                      fontSize: 12,
                      padding: "4px 6px"
                    }}
                  >
                    退出
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setLlmModalOpen(true)}
                  style={{
                    width: "100%",
                    background: "rgba(134,188,37,0.12)",
                    color: "#86bc25",
                    border: "1px solid rgba(134,188,37,0.3)",
                    borderRadius: 6,
                    padding: "7px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    transition: "all 0.15s ease"
                  }}
                >
                  <span>大模型配置</span>
                </button>
              </div>
            )
          ) : (
            <Link
              href="/login"
              title={sidebarCollapsed ? "管理员登录" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: sidebarCollapsed ? "8px" : "8px 12px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                color: "var(--color-text-secondary, #9ea5b3)",
                fontSize: 12,
                textDecoration: "none",
                transition: "all 0.15s ease"
              }}
            >
              {!sidebarCollapsed && <span>管理员登录</span>}
            </Link>
          )}
        </div>
      </aside>

      <div className="workspace-shell__main">
        <main className={`workspace-shell__content workspace-shell__content--${view}`}>
          <PageIntro meta={meta} view={view} onReset={resetFilters} />
          {view === "overview" ? (
            <OverviewPage
              initialState={initialState}
              articles={timeFilteredArticles}
              allArticles={articles}
              filteredArticles={filteredArticles}
              selectedCountryCode={selectedCountryCode}
              selectedRegion={selectedRegion}
              activeLayers={activeLayers}
              setActiveLayers={setActiveLayers}
              setSelectedCountryCode={setSelectedCountryCode}
              setSelectedRegion={setSelectedRegion}
              setSelectedArticleId={setSelectedArticleId}
              selectedType={selectedType}
              setSelectedType={setSelectedType}
              overviewTimeSpan={overviewTimeSpan}
              setOverviewTimeSpan={setOverviewTimeSpan}
            />
          ) : null}
          {view === "sources" ? (
            <SourceManager />
          ) : null}
          {view === "topics" ? (
            <TopicTimelineBoard
              initialTopics={initialState.topics || []}
              allArticles={initialState.articles || []}
              onSelectArticle={(item) => {
                setSelectedArticleId(item.id);
                setDrawerOpen(true);
              }}
            />
          ) : null}
          {view === "analysis" ? (
            <AnalysisPage
              allMonths={allMonths}
              allTags={allTags}
              allTypes={allTypes}
              filteredArticles={filteredArticles}
              searchQuery={searchQuery}
              selectedArticle={selectedArticle}
              selectedArticleId={selectedArticle?.id}
              selectedCredibility={selectedCredibility}
              selectedMonth={selectedMonth}
              selectedTag={selectedTag}
              selectedType={selectedType}
              setSearchQuery={setSearchQuery}
              setSelectedArticleId={setSelectedArticleId}
              setSelectedCredibility={setSelectedCredibility}
              setSelectedMonth={setSelectedMonth}
              setSelectedTag={setSelectedTag}
              onUpdateCategory={handleUpdateCategory}
              initialArticleId={initialArticleId}
            />
          ) : null}
          {view === "credibility" ? <CredibilityPage selectedArticle={selectedArticle} /> : null}
          {view === "morning" || view === "reports" ? (
            <MorningReport
              articles={articles}
              sources={configuredSources || initialState?.sources || []}
              initialReports={initialState?.dailyReports}
              initialPreferences={initialState?.morningPreferences}
            />
          ) : null}
        </main>
      </div>

      <LlmConfigModal
        isOpen={llmModalOpen}
        onClose={() => setLlmModalOpen(false)}
      />
    </div>
  );
}

function NavIcon({ name }) {
  const icons = {
    timeline: (
      <>
        <path d="M6 5v14" />
        <circle cx="6" cy="7" r="2" />
        <circle cx="6" cy="12" r="2" />
        <circle cx="6" cy="17" r="2" />
        <path d="M11 7h8" />
        <path d="M11 12h6" />
        <path d="M11 17h8" />
      </>
    ),
    dashboard: (
      <>
        <path d="M4 16.5 8.4 12l3.2 2.6L18 7.5" />
        <path d="M4 5v14h16" />
      </>
    ),
    library: (
      <>
        <path d="M5 7.5h14" />
        <path d="M7 4.5h10" />
        <path d="M6 10.5h12v8H6z" />
        <path d="M9 14.5h6" />
      </>
    ),
    morning: (
      <>
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
        <path d="M6 6h10" />
        <path d="M6 10h10" />
        <path d="M6 14h6" />
      </>
    ),
    source: (
      <>
        <path d="M6 7.5h5" />
        <path d="M13 7.5h5" />
        <path d="M6 16.5h5" />
        <path d="M13 16.5h5" />
        <path d="M11 7.5a2 2 0 0 0 2 2v5a2 2 0 0 0-2 2" />
      </>
    ),
    shield: (
      <>
        <path d="M12 4.5 18 7v4.4c0 3.9-2.4 6.8-6 8.1-3.6-1.3-6-4.2-6-8.1V7z" />
        <path d="m9.4 12.2 1.8 1.8 3.7-4" />
      </>
    ),
    report: (
      <>
        <path d="M7 4.5h7l3 3v12H7z" />
        <path d="M14 4.5v3h3" />
        <path d="M9.5 12h5" />
        <path d="M9.5 15h5" />
      </>
    ),
    radar: (
      <>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 12 17 7" />
        <path d="M4.5 12h2" />
        <path d="M17.5 12h2" />
      </>
    )
  };

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  );
}

function PageIntro({ meta, view }) {
  return (
    <section className={`page-header ${view === "overview" ? "page-header--overview" : ""}`}>
      <div className="page-header__body">
        {meta.eyebrow ? <p className="page-header__eyebrow">{meta.eyebrow}</p> : null}
        <h1 className="page-header__title">{meta.title}</h1>
        {meta.description ? <p className="page-header__description">{meta.description}</p> : null}
      </div>
    </section>
  );
}

function OverviewStats({ dashboard, articles }) {
  const currentArticles = articles || [];
  const securityCount = currentArticles.filter((a) => ['违规处罚与事件', '安全事件'].includes(a.intelligenceType)).length;
  const highRiskCount = currentArticles.filter((a) => a.riskLevel === "高" || a.riskLevel === "高风险" || a.severity === "重大").length;
  const stdCount = currentArticles.filter((a) => ['AI安全标准', '标准规范', '安全标准'].includes(a.intelligenceType)).length;
  const gitCount = currentArticles.filter((a) => ['GitHub开源', 'GitHub项目', 'GitHub', '开源生态'].includes(a.intelligenceType)).length;
  const validCred = currentArticles.filter(a => Number.isFinite(a.credibilityScore));
  const avgCredibility = validCred.length
    ? Math.round(validCred.reduce((acc, a) => acc + a.credibilityScore, 0) / validCred.length)
    : (dashboard?.avgCredibility || 90);

  const stats = [
    {
      label: "收录资讯",
      value: currentArticles.length,
      unit: "条",
      accent: "info",
      desc: "当前时间窗口内"
    },
    {
      label: "活跃监控来源",
      value: dashboard?.activeSources || 16,
      unit: "个",
      accent: "success",
      desc: "全网持续巡检"
    },
    {
      label: "高风险事件",
      value: highRiskCount,
      unit: "条",
      accent: "danger",
      desc: "需立即研判关注"
    },
    {
      label: "平均可信度",
      value: avgCredibility,
      unit: "%",
      accent: "success",
      desc: "客观一手核查均值"
    },
    {
      label: "安全标准与开源",
      value: stdCount + gitCount,
      unit: "项",
      accent: "info",
      desc: "标准规范与开源工具"
    },
    {
      label: "安全处罚与事件",
      value: securityCount,
      unit: "起",
      accent: "warning",
      desc: "攻击/越狱/罚单"
    }
  ];

  return (
    <section className="metric-grid" aria-label="平台核心指标">
      {stats.map((stat) => (
        <div className={`metric-card metric-card--${stat.accent}`} key={stat.label}>
          <span>{stat.label}</span>
          <strong>
            {stat.value}
            <em>{stat.unit}</em>
          </strong>
          <p>{stat.desc}</p>
        </div>
      ))}
    </section>
  );
}

function DecisionHub({ articles = [], selectedType, onSelectType }) {
  const regArticles = articles.filter((a) => ['法规政策', '合规动态', '监管政策'].includes(a.intelligenceType));
  const stdArticles = articles.filter((a) => ['AI安全标准', '标准规范', '安全标准'].includes(a.intelligenceType));
  const prodArticles = articles.filter((a) => ['安全产品突破', '产品动态', 'AI安全'].includes(a.intelligenceType));
  const gitArticles = articles.filter((a) => ['GitHub开源', 'GitHub项目', 'GitHub', '开源生态'].includes(a.intelligenceType));
  const incidentArticles = articles.filter((a) => ['违规处罚与事件', '安全事件'].includes(a.intelligenceType));

  const cards = [
    {
      key: '法规政策',
      title: '最新法规政策',
      count: regArticles.length,
      unit: '部/篇',
      badge: '监管前沿',
      desc: '国家法规 · 部门规章 · 大模型备案 · 治理法案',
      color: '#7e22ce',
      border: '#c084fc',
      bg: '#faf5ff'
    },
    {
      key: 'AI安全标准',
      title: '权威安全标准',
      count: stdArticles.length,
      unit: '项/份',
      badge: '合规基准',
      desc: 'ISO 42001 · OWASP Top 10 · AIUC-1 · NIST RMF',
      color: '#0369a1',
      border: '#0ea5e9',
      bg: '#f0f9ff'
    },
    {
      key: '安全产品突破',
      title: 'AI安全产品突破',
      count: prodArticles.length,
      unit: '款/项',
      badge: '防御武器',
      desc: 'Cyber专用模型 · 运行时护栏 · 提示注入防火墙',
      color: '#4d7c0f',
      border: '#86bc25',
      bg: '#f7fee7'
    },
    {
      key: 'GitHub开源',
      title: 'GitHub开源生态',
      count: gitArticles.length,
      unit: '个/库',
      badge: '开源工具',
      desc: '自动化漏洞扫描 · 红队渗透测试 · 护栏代码库',
      color: '#4338ca',
      border: '#6366f1',
      bg: '#eef2ff'
    },
    {
      key: '违规处罚与事件',
      title: '安全事件与处罚',
      count: incidentArticles.length,
      unit: '起/件',
      badge: '高危预警',
      desc: '模型越狱 · 提示注入 · 监管罚单 · 司法诉讼',
      color: '#b91c1c',
      border: '#f87171',
      bg: '#fef2f2'
    }
  ];

  return (
    <section className="decision-hub" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 14, color: 'var(--color-text)' }}>五大决策专区</strong>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>点击任一专区卡片，全屏联动聚焦</span>
        </div>
        {selectedType !== '全部' && (
          <button
            type="button"
            onClick={() => onSelectType('全部')}
            style={{
              background: 'rgba(134,188,37,0.15)',
              border: '1px solid rgba(134,188,37,0.35)',
              color: 'var(--color-brand-strong)',
              fontSize: 12,
              padding: '3px 10px',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            取消专区筛选（当前: {selectedType}）
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {cards.map((c) => {
          const isActive = selectedType === c.key;
          return (
            <div
              key={c.key}
              onClick={() => onSelectType(isActive ? '全部' : c.key)}
              style={{
                background: isActive ? `${c.border}22` : c.bg,
                border: `1.5px solid ${isActive ? c.border : 'var(--color-border)'}`,
                borderRadius: 6,
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                boxShadow: isActive ? `0 0 12px ${c.border}33` : '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 5
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>{c.title}</strong>
                <span
                  style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: `${c.border}22`,
                    color: c.color,
                    border: `1px solid ${c.border}44`,
                    fontWeight: 600
                  }}
                >
                  {isActive ? '● 筛选中' : c.badge}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <strong style={{ fontSize: 24, color: c.color, fontFamily: 'monospace', fontWeight: 700 }}>
                  {c.count}
                </strong>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.unit}</span>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                  {isActive ? '点击重置' : '点击聚焦'} →
                </span>
              </div>

              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.35 }}>
                {c.desc}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OverviewPage({
  initialState,
  articles,
  allArticles,
  filteredArticles,
  selectedCountryCode,
  selectedRegion,
  activeLayers,
  setActiveLayers,
  setSelectedCountryCode,
  setSelectedRegion,
  setSelectedArticleId,
  selectedType,
  setSelectedType,
  overviewTimeSpan,
  setOverviewTimeSpan
}) {
  const currentArticles = articles || initialState.articles || [];

  const countryStats = useMemo(() => {
    const list = currentArticles;
    const definitions = [
      { code: "US", name: "美国", region: "North America", lat: 39.8283, lng: -98.5795, themes: ["NIST框架", "大模型安全", "监管审查"] },
      { code: "EU", name: "欧盟", region: "Europe", lat: 50.8503, lng: 4.3517, themes: ["EU AI Act", "高风险AI", "合规义务"] },
      { code: "CN", name: "中国", region: "Asia Pacific", lat: 35.8617, lng: 104.1954, themes: ["大模型备案", "生成式AI治理", "数据合规"] },
      { code: "GLOBAL", name: "全球综合", region: "Global", lat: 20, lng: 0, themes: ["全球治理", "模型安全", "国际标准"] }
    ];
    const totalAll = Math.max(list.length, 1);
    return definitions.map(def => {
      const matching = list.filter(a => def.code === 'GLOBAL' ? (a.countryCode === 'GLOBAL' || a.region === 'Global') : a.countryCode === def.code);
      const total = matching.length;
      const highRisk = matching.filter(a => a.riskLevel === '高' || a.riskLevel === '高风险' || a.severity === '重大').length;
      const share = `${((total / totalAll) * 100).toFixed(1)}%`;
      const heat = Math.min(100, Math.max(12, Math.round((total / totalAll) * 100) + (highRisk > 0 ? 30 : 15)));
      return { ...def, total, highRisk, share, heat };
    }).sort((a, b) => b.total - a.total);
  }, [currentArticles]);

  const selectedCountry =
    countryStats.find((country) => country.code === selectedCountryCode) ||
    countryStats[0] ||
    initialState.countryStats[0];
  const selectedFeed = initialState.countryFeeds[selectedCountry.code];

  function selectCountry(country) {
    setSelectedCountryCode(country.code);
    setSelectedRegion(country.region);
  }

  return (
    <>
      {/* 顶部时间跨度筛选栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: '10px 16px',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <strong style={{ fontSize: 14, color: 'var(--color-text)' }}>宏观态势时间窗口</strong>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            当前展示：<strong>{overviewTimeSpan === 'today' ? '当日（过去24小时）' : overviewTimeSpan === 'week' ? '当周（过去7天）' : overviewTimeSpan === 'month' ? '当月（过去30天）' : '所有收录情报'}</strong>
            （共 {currentArticles.length} 条情报）
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.04)', padding: 3, borderRadius: 6, border: '1px solid var(--color-border)' }}>
          {[
            { key: 'today', label: '当日' },
            { key: 'week', label: '当周' },
            { key: 'month', label: '当月' },
            { key: 'all', label: '所有' }
          ].map((tab) => {
            const isTabActive = overviewTimeSpan === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setOverviewTimeSpan(tab.key)}
                style={{
                  padding: '4px 14px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: isTabActive ? 700 : 500,
                  border: isTabActive ? '1px solid var(--color-brand)' : '1px solid transparent',
                  cursor: 'pointer',
                  background: isTabActive ? 'var(--color-brand)' : 'transparent',
                  color: isTabActive ? '#ffffff' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <DecisionHub
        articles={currentArticles}
        selectedType={selectedType}
        onSelectType={setSelectedType}
      />
      <OverviewStats
        dashboard={initialState.dashboard}
        articles={currentArticles}
      />
      <section className="panel panel--jurisdiction" style={{ width: '100%', marginBottom: 24 }}>
        <PanelHeader
          title="全球主要法域 AI 监管态势与动态"
          action={`${selectedCountry.name} · ${selectedCountry.total} 项动态`}
        />
        <div className="geo-board">
          <div className="country-ranking">
            <div className="table-title">
              <strong>重点法域监管排行榜</strong>
              <span>AI合规热度指数</span>
            </div>
            <div className="country-row country-row--head">
              <span>法域/国家</span>
              <span>动态数</span>
              <span>重点关注</span>
              <span>热度占比</span>
            </div>
            {countryStats.map((country) => (
              <button
                className={`country-row ${selectedCountryCode === country.code ? "is-active" : ""}`}
                key={country.code}
                onClick={() => selectCountry(country)}
                type="button"
              >
                <span>{country.name}</span>
                <span>{country.total}</span>
                <span>{country.highRisk}</span>
                <span>{country.share}</span>
              </button>
            ))}
          </div>
          <JurisdictionFeedBoard
            articles={currentArticles}
            country={selectedCountry}
            feed={selectedFeed}
            selectedType={selectedType}
            setSelectedArticleId={setSelectedArticleId}
          />
        </div>
      </section>
    </>
  );
}

function JurisdictionFeedBoard({ articles, country, feed, selectedType, setSelectedArticleId }) {
  if (!country) return null;

  const feedCategories = [
    { key: '法规政策', label: '法规政策规制', color: '#7e22ce', border: '#c084fc', bg: '#faf5ff' },
    { key: 'AI安全标准', label: 'AI安全标准规范', color: '#0369a1', border: '#0ea5e9', bg: '#f0f9ff' },
    { key: '安全产品突破', label: 'Cyber模型与护栏', color: '#4d7c0f', border: '#86bc25', bg: '#f7fee7' },
    { key: 'GitHub开源', label: 'GitHub开源生态', color: '#4338ca', border: '#6366f1', bg: '#eef2ff' },
    { key: '违规处罚与事件', label: '典型事件与处罚', color: '#b91c1c', border: '#f87171', bg: '#fef2f2' }
  ];

  return (
    <div
      className="jurisdiction-feed-board"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minWidth: 0
      }}
    >
      {/* 头部：当前选中法域的核心态势指标 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 12
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: 18, color: 'var(--color-text)' }}>{country.name}</strong>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(134,188,37,0.12)',
                color: 'var(--color-brand-strong)',
                fontWeight: 700
              }}
            >
              {country.code} · {country.region}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            {(country.themes || []).map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                  background: 'var(--color-page)',
                  padding: '2px 6px',
                  borderRadius: 3,
                  border: '1px solid var(--color-border)'
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>资讯总量</div>
            <strong style={{ fontSize: 18, color: 'var(--color-text)', fontFamily: 'monospace' }}>{country.total}</strong>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>重点关注</div>
            <strong style={{ fontSize: 18, color: '#b91c1c', fontFamily: 'monospace' }}>{country.highRisk}</strong>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>热度指数</div>
            <strong style={{ fontSize: 18, color: 'var(--color-brand-strong)', fontFamily: 'monospace' }}>{country.heat}%</strong>
          </div>
        </div>
      </div>

      {/* 核心五分类情报流水卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, flex: 1 }}>
        {feedCategories.map((cat) => {
          const matching = (articles || []).filter((a) => {
            const typeMatch = matchesType(a.intelligenceType, cat.key);
            if (!typeMatch) return false;
            if (country.code === 'GLOBAL') return true;
            if (country.code === 'EU') return a.countryCode === 'EU' || a.region === 'Europe';
            if (country.code === 'US') return a.countryCode === 'US' || a.region === 'North America';
            if (country.code === 'CN') return a.countryCode === 'CN' || a.region === 'Asia Pacific';
            return a.countryCode === country.code || a.region === country.region;
          });

          const isMatching = selectedType === '全部' || selectedType === cat.key;

          return (
            <div
              key={cat.key}
              style={{
                background: cat.bg,
                border: isMatching && selectedType !== '全部' ? `2px solid ${cat.border}` : `1px solid ${cat.border}55`,
                borderRadius: 6,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                opacity: !isMatching ? 0.45 : 1,
                transition: 'all 0.2s ease',
                boxShadow: isMatching && selectedType !== '全部' ? `0 0 10px ${cat.border}25` : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <strong style={{ fontSize: 12, color: cat.color }}>{cat.label}</strong>
                  {isMatching && selectedType !== '全部' && (
                    <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: cat.color, color: '#ffffff', fontWeight: 700 }}>
                      聚焦中
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: cat.color,
                    background: `${cat.border}25`,
                    padding: '1px 5px',
                    borderRadius: 8,
                    fontWeight: 600
                  }}
                >
                  {matching.length} 条
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {matching.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '6px 2px', fontStyle: 'italic' }}>
                    暂无该法域直接归档
                  </div>
                ) : (
                  matching.slice(0, 2).map((article, idx) => (
                    <Link
                      key={article.id}
                      href={`/analysis?article=${article.id}`}
                      onClick={() => setSelectedArticleId(article.id)}
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text)',
                        textDecoration: 'none',
                        lineHeight: 1.4,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 5,
                        padding: '5px 6px',
                        borderRadius: 4,
                        background: 'rgba(255,255,255,0.85)',
                        border: '1px solid rgba(0,0,0,0.04)',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            fontWeight: 500
                          }}
                        >
                          {article.title}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {article.source} · {formatDate(article.publishedAt)}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部跳转指引 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 8,
          borderTop: '1px solid var(--color-border)',
          fontSize: 12,
          flexWrap: 'wrap',
          gap: 8
        }}
      >
        <span style={{ color: 'var(--color-text-muted)' }}>
          点击任意情报条目，直接进入深度可信研判工作台
        </span>
        <Link
          href={`/analysis?query=${encodeURIComponent(country.name)}`}
          style={{ color: 'var(--color-brand-strong)', textDecoration: 'none', fontWeight: 600 }}
        >
          查看全部 {country.name} 合规情报 →
        </Link>
      </div>
    </div>
  );
}

function findArticleForFeed(articles, countryCode, categoryName, index) {
  const countryArticles = articles.filter(
    (article) => article.countryCode === countryCode && matchesType(article.intelligenceType, categoryName)
  );
  const typeArticles = articles.filter((article) => matchesType(article.intelligenceType, categoryName));
  const candidates = countryArticles.length > 0 ? countryArticles : typeArticles;

  return candidates[index % candidates.length] || articles[0];
}

function SourcesPage({ configuredSources, setConfiguredSources }) {
  const [sourceForm, setSourceForm] = useState({
    name: "",
    method: "RSS订阅",
    url: "",
    apiId: "",
    apiHash: "",
    frequency: "每天"
  });
  const [editingSource, setEditingSource] = useState(null);
  const [sourceMethodFilter, setSourceMethodFilter] = useState("全部");
  const [featureConfig, setFeatureConfig] = useState({
    keywords: ["网络安全", "数据泄露", "AI合规", "深度伪造"],
    excludeKeywords: ["招聘", "课程广告", "无关营销"],
    targets: ["安全事件", "合规动态"],
    matchMode: "标准",
    scope: "全部资讯源"
  });
  const [featureKeywordInput, setFeatureKeywordInput] = useState("");
  const [excludeKeywordInput, setExcludeKeywordInput] = useState("");
  const featureTargets = ["产品动态", "合规动态", "安全事件", "漏洞风险", "开源项目", "行业报告"];
  const matchModes = ["宽松", "标准", "严格"];

  function updateSourceForm(field, value) {
    setSourceForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function saveSource(event) {
    event.preventDefault();
    const name = sourceForm.name.trim() || "新的AI资讯源";
    const isBotCollection = sourceForm.method === "Bot收集";
    const url = isBotCollection
      ? `Telegram群组配置：api_id ${sourceForm.apiId.trim() || "待填写"}`
      : sourceForm.url.trim() || "https://example.com/ai-news";
    const nextSource = {
      id: Date.now(),
      name,
      type: "待自动识别",
      url,
      region: "自动识别",
      reliability: 70,
      apiId: sourceForm.apiId,
      apiHash: sourceForm.apiHash,
      collectionMethod: sourceForm.method,
      status: "采集中",
      cadence: sourceForm.frequency,
      owner: "平台自动处理",
      notes: "平台采集后自动完成分类、摘要、标签和入库去重。",
      lastRun: "刚刚"
    };

    setConfiguredSources((current) => [nextSource, ...current]);
    setSourceForm({
      name: "",
      method: sourceForm.method,
      url: "",
      apiId: "",
      apiHash: "",
      frequency: sourceForm.frequency
    });
  }

  function openEditSource(source) {
    const isBotCollection = source.collectionMethod === "Bot收集";
    setEditingSource({
      id: source.id,
      name: source.name,
      method: source.collectionMethod || "RSS订阅",
      url: isBotCollection ? "" : source.url,
      apiId: source.apiId || "",
      apiHash: source.apiHash || "",
      frequency: source.cadence || "每天",
      status: source.status || "采集中"
    });
  }

  function updateEditingSource(field, value) {
    setEditingSource((current) => ({
      ...current,
      [field]: value
    }));
  }

  function saveEditingSource(event) {
    event.preventDefault();
    const isBotCollection = editingSource.method === "Bot收集";
    const nextUrl = isBotCollection
      ? `Telegram群组配置：api_id ${editingSource.apiId.trim() || "待填写"}`
      : editingSource.url.trim() || "https://example.com/ai-news";

    setConfiguredSources((current) =>
      current.map((source) =>
        source.id === editingSource.id
          ? {
              ...source,
              name: editingSource.name.trim() || source.name,
              url: nextUrl,
              apiId: editingSource.apiId,
              apiHash: editingSource.apiHash,
              collectionMethod: editingSource.method,
              cadence: editingSource.frequency,
              status: editingSource.status
            }
          : source
      )
    );
    setEditingSource(null);
  }

  function deleteSource(sourceId) {
    setConfiguredSources((current) => current.filter((source) => source.id !== sourceId));
    setEditingSource((current) => (current?.id === sourceId ? null : current));
  }

  function addFeatureKeyword(field, value, clearInput) {
    const nextValue = value.trim();
    if (!nextValue) return;

    setFeatureConfig((current) => ({
      ...current,
      [field]: current[field].includes(nextValue) ? current[field] : [...current[field], nextValue]
    }));
    clearInput("");
  }

  function removeFeatureKeyword(field, value) {
    setFeatureConfig((current) => ({
      ...current,
      [field]: current[field].filter((item) => item !== value)
    }));
  }

  function handleFeatureInputKeyDown(event, field, value, clearInput) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addFeatureKeyword(field, value, clearInput);
  }

  function toggleFeatureTarget(target) {
    setFeatureConfig((current) => ({
      ...current,
      targets: current.targets.includes(target)
        ? current.targets.filter((item) => item !== target)
        : [...current.targets, target]
    }));
  }

  const activeCount = configuredSources.filter((source) => source.status !== "已暂停").length;
  const isBotCollection = sourceForm.method === "Bot收集";
  const sourceMethods = ["全部", "RSS订阅", "API", "URL监测", "Bot收集"];
  const sourceMethodStats = useMemo(
    () =>
      sourceMethods.reduce((stats, method) => {
        stats[method] =
          method === "全部"
            ? configuredSources.length
            : configuredSources.filter((source) => source.collectionMethod === method).length;
        return stats;
      }, {}),
    [configuredSources]
  );
  const groupedSources = useMemo(() => {
    const methodsToShow = sourceMethodFilter === "全部" ? sourceMethods.slice(1) : [sourceMethodFilter];

    return methodsToShow
      .map((method) => ({
        method,
        sources: configuredSources.filter((source) => source.collectionMethod === method)
      }))
      .filter((group) => group.sources.length > 0);
  }, [configuredSources, sourceMethodFilter]);

  return (
    <section className="source-config-page">
      <ManualCollection />
      <div className="panel source-config-card">
        <PanelHeader eyebrow="新增来源" title="配置一个AI资讯源" action="4项即可" />
        <form className="source-form" onSubmit={saveSource}>
          <label>
            来源名称
            <input
              onChange={(event) => updateSourceForm("name", event.target.value)}
              placeholder="例如：OpenAI 官方博客"
              value={sourceForm.name}
            />
          </label>
          <label>
            采集方式
            <select value={sourceForm.method} onChange={(event) => updateSourceForm("method", event.target.value)}>
              <option>RSS订阅</option>
              <option>API</option>
              <option>URL监测</option>
              <option>Bot收集</option>
            </select>
          </label>
          {isBotCollection ? (
            <div className="bot-fields">
              <label>
                api_id
                <input
                  onChange={(event) => updateSourceForm("apiId", event.target.value)}
                  placeholder="填写 Telegram API ID"
                  value={sourceForm.apiId}
                />
              </label>
              <label>
                api_hash
                <input
                  onChange={(event) => updateSourceForm("apiHash", event.target.value)}
                  placeholder="填写 Telegram API Hash"
                  value={sourceForm.apiHash}
                />
              </label>
              <p>
                Bot收集方案参考 GitHub 项目 NextBSpiders。需要参考项目说明，前往 Telegram 官方开发者页面获取 api_id 和 api_hash 后再配置。
              </p>
            </div>
          ) : (
            <label>
              来源地址
              <input
                onChange={(event) => updateSourceForm("url", event.target.value)}
                placeholder="粘贴网站、订阅源或接口地址"
                value={sourceForm.url}
              />
            </label>
          )}
          <label>
            采集频率
            <select value={sourceForm.frequency} onChange={(event) => updateSourceForm("frequency", event.target.value)}>
              <option>每天</option>
              <option>每周</option>
              <option>手动</option>
            </select>
          </label>
          <button className="button button--primary" type="submit">保存配置</button>
        </form>
        <section className="source-feature-config" aria-label="特征值配置">
          <div className="source-feature-config__head">
            <div>
              <span>采集约束</span>
              <strong>特征值配置</strong>
            </div>
            <em>{featureConfig.matchMode}</em>
          </div>
          <div className="feature-field">
            <label>
              关注关键词
              <div className="feature-input-row">
                <input
                  onChange={(event) => setFeatureKeywordInput(event.target.value)}
                  onKeyDown={(event) =>
                    handleFeatureInputKeyDown(event, "keywords", featureKeywordInput, setFeatureKeywordInput)
                  }
                  placeholder="例如：网络安全"
                  value={featureKeywordInput}
                />
                <button
                  type="button"
                  onClick={() => addFeatureKeyword("keywords", featureKeywordInput, setFeatureKeywordInput)}
                >
                  添加
                </button>
              </div>
            </label>
            <div className="feature-tags">
              {featureConfig.keywords.map((keyword) => (
                <button key={keyword} type="button" onClick={() => removeFeatureKeyword("keywords", keyword)}>
                  {keyword}
                  <span>×</span>
                </button>
              ))}
            </div>
          </div>
          <div className="feature-field">
            <label>
              排除关键词
              <div className="feature-input-row">
                <input
                  onChange={(event) => setExcludeKeywordInput(event.target.value)}
                  onKeyDown={(event) =>
                    handleFeatureInputKeyDown(event, "excludeKeywords", excludeKeywordInput, setExcludeKeywordInput)
                  }
                  placeholder="例如：广告"
                  value={excludeKeywordInput}
                />
                <button
                  type="button"
                  onClick={() => addFeatureKeyword("excludeKeywords", excludeKeywordInput, setExcludeKeywordInput)}
                >
                  添加
                </button>
              </div>
            </label>
            <div className="feature-tags feature-tags--muted">
              {featureConfig.excludeKeywords.map((keyword) => (
                <button key={keyword} type="button" onClick={() => removeFeatureKeyword("excludeKeywords", keyword)}>
                  {keyword}
                  <span>×</span>
                </button>
              ))}
            </div>
          </div>
          <div className="feature-field">
            <span className="feature-field__label">关注对象</span>
            <div className="feature-toggle-grid">
              {featureTargets.map((target) => (
                <button
                  className={featureConfig.targets.includes(target) ? "is-active" : ""}
                  key={target}
                  onClick={() => toggleFeatureTarget(target)}
                  type="button"
                >
                  {target}
                </button>
              ))}
            </div>
          </div>
          <div className="feature-rule-grid">
            <label>
              匹配强度
              <div className="feature-segment">
                {matchModes.map((mode) => (
                  <button
                    className={featureConfig.matchMode === mode ? "is-active" : ""}
                    key={mode}
                    onClick={() => setFeatureConfig((current) => ({ ...current, matchMode: mode }))}
                    type="button"
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </label>
            <label>
              适用范围
              <select
                value={featureConfig.scope}
                onChange={(event) => setFeatureConfig((current) => ({ ...current, scope: event.target.value }))}
              >
                <option>全部资讯源</option>
                <option>仅当前新增来源</option>
              </select>
            </label>
          </div>
          <p className="source-feature-config__note">
            平台会优先保留命中特征值的内容，并降低排除词命中的资讯入库优先级。
          </p>
        </section>
      </div>

      <div className="panel source-library-card">
        <PanelHeader eyebrow="来源清单" title="来源地址清单" action="手动触发" />
        <div className="source-library-summary">
          <div>
            <span>来源总数</span>
            <strong>{configuredSources.length}</strong>
          </div>
          <div>
            <span>待手动选择</span>
            <strong>{activeCount}</strong>
          </div>
          <div>
            <span>支持方式</span>
            <strong>4</strong>
          </div>
        </div>
        <div className="source-method-tabs" aria-label="按采集方式筛选">
          {sourceMethods.map((method) => (
            <button
              className={sourceMethodFilter === method ? "is-active" : ""}
              key={method}
              onClick={() => setSourceMethodFilter(method)}
              type="button"
            >
              <span>{method}</span>
              <em>{sourceMethodStats[method]}</em>
            </button>
          ))}
        </div>
        <div className="source-table" aria-label="已配置采集网站清单">
          {groupedSources.map((group) => (
            <section className="source-method-group" key={group.method}>
              <div className="source-method-group__head">
                <strong>{group.method}</strong>
                <span>{group.sources.length} 个来源</span>
              </div>
              {group.sources.map((source, index) => (
                <div className="source-row" key={source.id}>
                  <div>
                    <strong>{source.name}</strong>
                    <span>{source.url}</span>
                  </div>
                  <div>
                    <span>{source.collectionMethod}</span>
                    <small>尚未验证可采集性 · 不定时运行</small>
                  </div>
                  <div className="source-row__actions">
                    <em>仅配置地址</em>
                    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('choose-collection-source', { detail: { url: source.url, method: source.collectionMethod } }))}>选择并试采集</button>
                    <button type="button" onClick={() => openEditSource(source)}>编辑</button>
                    <button className="source-row__delete" type="button" onClick={() => deleteSource(source.id)}>删除</button>
                  </div>
                </div>
              ))}
            </section>
          ))}
          {groupedSources.length === 0 ? <p className="empty-state">当前分类下还没有配置来源。</p> : null}
        </div>
      </div>
      {editingSource ? (
        <SourceEditModal
          editingSource={editingSource}
          onClose={() => setEditingSource(null)}
          onSave={saveEditingSource}
          onUpdate={updateEditingSource}
        />
      ) : null}
    </section>
  );
}

function SourceEditModal({ editingSource, onClose, onSave, onUpdate }) {
  const isBotCollection = editingSource.method === "Bot收集";

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="source-edit-modal" role="dialog" aria-modal="true" aria-label="编辑AI资讯源">
        <div className="source-edit-modal__head">
          <div>
            <span>编辑来源</span>
            <strong>{editingSource.name}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭编辑窗口">×</button>
        </div>
        <form className="source-form" onSubmit={onSave}>
          <label>
            来源名称
            <input value={editingSource.name} onChange={(event) => onUpdate("name", event.target.value)} />
          </label>
          <label>
            采集方式
            <select value={editingSource.method} onChange={(event) => onUpdate("method", event.target.value)}>
              <option>RSS订阅</option>
              <option>API</option>
              <option>URL监测</option>
              <option>Bot收集</option>
            </select>
          </label>
          {isBotCollection ? (
            <div className="bot-fields">
              <label>
                api_id
                <input value={editingSource.apiId} onChange={(event) => onUpdate("apiId", event.target.value)} />
              </label>
              <label>
                api_hash
                <input value={editingSource.apiHash} onChange={(event) => onUpdate("apiHash", event.target.value)} />
              </label>
              <p>
                Bot收集方案参考 GitHub 项目 NextBSpiders。需要参考项目说明，前往 Telegram 官方开发者页面获取 api_id 和 api_hash 后再配置。
              </p>
            </div>
          ) : (
            <label>
              来源地址
              <input value={editingSource.url} onChange={(event) => onUpdate("url", event.target.value)} />
            </label>
          )}
          <div className="source-edit-modal__grid">
            <label>
              采集频率
              <select value={editingSource.frequency} onChange={(event) => onUpdate("frequency", event.target.value)}>
                <option>每天</option>
                <option>每周</option>
                <option>手动</option>
              </select>
            </label>
            <label>
              状态
              <select value={editingSource.status} onChange={(event) => onUpdate("status", event.target.value)}>
                <option>采集中</option>
                <option>待接入</option>
                <option>样例数据</option>
                <option>已暂停</option>
              </select>
            </label>
          </div>
          <div className="source-edit-modal__actions">
            <button className="button button--secondary" type="button" onClick={onClose}>取消</button>
            <button className="button button--primary" type="submit">保存修改</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AnalysisPage({
  allMonths,
  allTags,
  allTypes,
  filteredArticles,
  searchQuery,
  selectedArticle,
  selectedArticleId,
  selectedCredibility,
  selectedMonth,
  selectedTag,
  selectedType,
  setSearchQuery,
  setSelectedArticleId,
  setSelectedCredibility,
  setSelectedMonth,
  setSelectedTag,
  setSelectedType,
  onUpdateCategory,
  initialArticleId
}) {
  const [trustResults, setTrustResults] = useState({});
  const [isDrawerOpen, setIsDrawerOpen] = useState(Boolean(initialArticleId));
  const selectedTrustResult = selectedArticle ? trustResults[selectedArticle.id] : null;

  function runArticleTrustCheck(article) {
    setTrustResults((current) => ({
      ...current,
      [article.id]: buildTrustCheck(article, "标准")
    }));
  }

  // 键盘快捷键监听：Esc 关闭抽屉，↑/↓ 键翻页
  useEffect(() => {
    function handleKeyDown(e) {
      if (!isDrawerOpen) return;
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        navigateToAdjacent(-1);
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        navigateToAdjacent(1);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, selectedArticleId, filteredArticles]);

  const currentIndex = filteredArticles.findIndex((a) => a.id === selectedArticleId);

  function navigateToAdjacent(delta) {
    if (currentIndex === -1 && filteredArticles.length > 0) {
      setSelectedArticleId(filteredArticles[0].id);
      return;
    }
    const newIdx = currentIndex + delta;
    if (newIdx >= 0 && newIdx < filteredArticles.length) {
      setSelectedArticleId(filteredArticles[newIdx].id);
    }
  }

  function handleRowClick(item) {
    setSelectedArticleId(item.id);
    setIsDrawerOpen(true);
  }

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedType !== '全部' ||
    selectedTag !== '全部' ||
    selectedMonth !== '全部' ||
    selectedCredibility !== '全部';

  function resetAllFilters() {
    setSearchQuery('');
    setSelectedType('全部');
    setSelectedTag('全部');
    setSelectedMonth('全部');
    setSelectedCredibility('全部');
  }

  return (
    <section className="analysis-workspace">
      {/* 顶部：单行高密度情报检索与筛选栏 */}
      <div className="analysis-search-bar">
        <div className="analysis-search-bar__query">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索政策法规、标准规范、Cyber模型、开源工具、受影响主体或关键词（支持空格分词）..."
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="analysis-search-bar__clear"
              title="清空输入"
            >
              ✕
            </button>
          )}
        </div>

        <div className="analysis-search-bar__filters">
          <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
            {allTypes.map((type) => (
              <option key={type} value={type}>{type === "全部" ? "全部类型" : type}</option>
            ))}
          </select>
          <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag === "全部" ? "全部标签" : tag}</option>
            ))}
          </select>
          <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
            {allMonths.map((month) => (
              <option key={month} value={month}>
                {month === "全部" ? "全部年月" : formatMonth(month)}
              </option>
            ))}
          </select>
          <select value={selectedCredibility} onChange={(event) => setSelectedCredibility(event.target.value)}>
            <option value="全部">可信度</option>
            <option value="高">高可信</option>
            <option value="中">中可信</option>
            <option value="低">低可信</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="analysis-search-bar__reset"
              title="清除所有筛选条件"
            >
              重置
            </button>
          )}
        </div>

        <div className="analysis-search-bar__count">
          共 <span>{filteredArticles.length}</span> 条
        </div>
      </div>

      {/* 主体：原子情报全景数据表格 */}
      <div className="panel analysis-table-panel">
        <div className="atomic-intel-table-wrapper">
          <table className="atomic-intel-table">
            <thead>
              <tr>
                <th style={{ width: 58, textAlign: 'center' }}>风险</th>
                <th style={{ minWidth: 320 }}>标题与核心议题</th>
                <th style={{ width: 110 }}>分类</th>
                <th style={{ width: 160 }}>权威来源</th>
                <th style={{ width: 115 }}>时间</th>
                <th style={{ width: 125 }}>置信度</th>
                <th style={{ width: 90, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredArticles.map((item) => {
                const meta = getCategoryMeta(item.intelligenceType, item);
                const isSelected = selectedArticleId === item.id && isDrawerOpen;
                const dateStr = item.primaryDate || (item.publishedAt ? item.publishedAt.slice(0, 10) : '-');
                const isMajor = item.severity === '重大' || item.riskLevel === '高' || item.riskLevel === '高风险';
                const isMedium = item.severity === '中度' || item.riskLevel === '中' || item.riskLevel === '中风险';
                const riskColor = isMajor ? '#b91c1c' : isMedium ? '#b45309' : '#15803d';
                const riskBg = isMajor ? '#fee2e2' : isMedium ? '#fef3c7' : '#f0fdf4';
                const riskBorder = isMajor ? '#fca5a5' : isMedium ? '#fde68a' : '#bbf7d0';
                const riskLabel = isMajor ? '高风险' : isMedium ? '中风险' : '稳健';

                return (
                  <tr
                    key={item.id}
                    onClick={() => handleRowClick(item)}
                    className={isSelected ? 'is-active' : ''}
                  >
                    {/* 风险等级 */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 3,
                          color: riskColor,
                          background: riskBg,
                          border: `1px solid ${riskBorder}`,
                          display: 'inline-block',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {riskLabel}
                      </span>
                    </td>

                    {/* 标题与核心议题 */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <strong
                          style={{
                            fontSize: 13.5,
                            color: 'var(--color-text)',
                            lineHeight: 1.45,
                            fontWeight: 600
                          }}
                        >
                          {item.title}
                        </strong>

                        {item.summary && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--color-text-muted)',
                              lineHeight: 1.4,
                              maxWidth: 620,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {item.summary}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 情报类型 */}
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          color: meta.color,
                          border: `1px solid ${meta.border}88`,
                          backgroundColor: `${meta.border}15`,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {meta.label}
                      </span>
                    </td>

                    {/* 权威来源 */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <strong style={{ fontSize: 12.5, color: 'var(--color-text)', fontWeight: 600 }}>
                          {item.primaryAuthority || item.source}
                        </strong>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {item.sourceType || (item.sourceOrigin === 'direct' ? '官方公报' : '公开网页')}
                        </span>
                      </div>
                    </td>

                    {/* 发生/发布时间 */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 12.5, fontFamily: 'monospace', color: 'var(--color-text)', fontWeight: 600 }}>
                          {dateStr}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                          {item.eventDate ? '真实发生日' : '发布时间'}
                        </span>
                      </div>
                    </td>

                    {/* 置信度 */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12.5, fontFamily: 'monospace', fontWeight: 700, color: item.credibilityScore >= 95 ? '#15803d' : item.credibilityScore >= 80 ? '#0284c7' : '#b45309' }}>
                            {item.credibilityScore || 90}%
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                            {getCredibilityLevel(item.credibilityScore)}
                          </span>
                        </div>
                        <div style={{ width: 50, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${item.credibilityScore || 90}%`,
                              height: '100%',
                              background: item.credibilityScore >= 95 ? '#16a34a' : item.credibilityScore >= 80 ? '#0ea5e9' : '#f59e0b'
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 操作 */}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(item);
                        }}
                        style={{
                          background: 'rgba(134,188,37,0.12)',
                          border: '1px solid rgba(134,188,37,0.3)',
                          color: 'var(--color-brand-strong)',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 9px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        详情 →
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredArticles.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    没有匹配的原子情报，请调整检索关键词或分类筛选条件。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 点击资讯呼出的弹出式侧边栏 (Slide-over Detail Drawer) */}
      {isDrawerOpen && selectedArticle && (
        <>
          {/* 背景遮罩 */}
          <div
            className="atomic-intel-drawer-overlay"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* 侧边栏主体 */}
          <aside className="atomic-intel-drawer">
            {/* 抽屉头部 */}
            <div className="atomic-intel-drawer__header">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 16, color: 'var(--color-text)', fontWeight: 700 }}>
                    原子情报深度研判
                  </strong>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '1px 6px',
                      borderRadius: 3,
                      background: 'rgba(134,188,37,0.15)',
                      color: 'var(--color-brand-strong)',
                      fontWeight: 600
                    }}
                  >
                    #{selectedArticle.id}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  来源: {selectedArticle.source} · {selectedArticle.primaryDate || selectedArticle.publishedAt?.slice(0, 10)}
                </span>
              </div>

              {/* 右侧控制：前后翻页与关闭 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    disabled={currentIndex <= 0}
                    onClick={() => navigateToAdjacent(-1)}
                    style={{
                      background: 'var(--color-surface-strong)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 11,
                      cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer',
                      opacity: currentIndex <= 0 ? 0.4 : 1
                    }}
                    title="快捷键: ↑ 或 k"
                  >
                    上一篇
                  </button>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)', padding: '0 4px' }}>
                    {currentIndex + 1}/{filteredArticles.length}
                  </span>
                  <button
                    type="button"
                    disabled={currentIndex >= filteredArticles.length - 1}
                    onClick={() => navigateToAdjacent(1)}
                    style={{
                      background: 'var(--color-surface-strong)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 11,
                      cursor: currentIndex >= filteredArticles.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: currentIndex >= filteredArticles.length - 1 ? 0.4 : 1
                    }}
                    title="快捷键: ↓ 或 j"
                  >
                    下一篇
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  style={{
                    background: 'var(--color-surface-strong)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: 14,
                    color: 'var(--color-text-secondary)'
                  }}
                  title="关闭 (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 抽屉内容区 */}
            <div className="atomic-intel-drawer__body">
              <IntelDetail
                checkResult={selectedTrustResult}
                onRunTrustCheck={runArticleTrustCheck}
                selectedArticle={selectedArticle}
                setSelectedTag={(tag) => {
                  setSelectedTag(tag);
                  setIsDrawerOpen(false);
                }}
                onUpdateCategory={onUpdateCategory}
              />
            </div>
          </aside>
        </>
      )}
    </section>
  );
}

function CredibilityPage({ selectedArticle }) {
  const [strictness, setStrictness] = useState("标准");
  const [enabledSignals, setEnabledSignals] = useState({
    source: true,
    crossCheck: true,
    aiTrace: true,
    metadata: false,
    watermark: false,
    time: true
  });

  function toggleSignal(key) {
    setEnabledSignals((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  function applyStrictnessPreset(mode) {
    setStrictness(mode);
    if (mode === "宽松") {
      setEnabledSignals({
        source: true,
        crossCheck: false,
        aiTrace: false,
        metadata: false,
        watermark: false,
        time: true
      });
    } else if (mode === "标准") {
      setEnabledSignals({
        source: true,
        crossCheck: true,
        aiTrace: true,
        metadata: false,
        watermark: false,
        time: true
      });
    } else if (mode === "严格") {
      setEnabledSignals({
        source: true,
        crossCheck: true,
        aiTrace: true,
        metadata: true,
        watermark: true,
        time: true
      });
    }
  }

  return (
    <section className="trust-console-grid trust-console-grid--config">
      <div className="panel trust-config-panel">
        <PanelHeader title="可信检查策略" action={strictness} />
        <div className="trust-mode-group" aria-label="检查严格度">
          {["宽松", "标准", "严格"].map((mode) => (
            <button
              className={strictness === mode ? "is-active" : ""}
              key={mode}
              onClick={() => applyStrictnessPreset(mode)}
              type="button"
            >
              {mode}
            </button>
          ))}
        </div>

        <section className="trust-signal-list">
          {trustSignals.map((signal) => (
            <label className="trust-signal" key={signal.key}>
              <input
                checked={enabledSignals[signal.key]}
                onChange={() => toggleSignal(signal.key)}
                type="checkbox"
              />
              <span>
                <strong>{signal.label}</strong>
                <small>{signal.description}</small>
              </span>
            </label>
          ))}
        </section>
      </div>

      <div className="panel trust-reference-panel">
        <PanelHeader title="检测点说明" />
        <div className="trust-detection-note">
          <p>左侧检测点分为两类：元数据、水印和来源证据属于真实技术方向；文本生成痕迹属于启发式判断，需要结合模型或检测服务降低误判。</p>
          <p>当前页面用于配置检测策略，单条资讯的检查入口放在 02「AI资讯卡片详情」中。</p>
        </div>
        <div className="trust-reference-card">
          <span>参考项目</span>
          <div className="trust-reference-links">
            <a href="https://github.com/MatrixA/aicheck" rel="noreferrer" target="_blank">
              MatrixA / aicheck
            </a>
            <a href="https://github.com/google-deepmind/synthid-text" rel="noreferrer" target="_blank">
              Google DeepMind / synthid-text
            </a>
          </div>
          <p>用于说明本配置的技术参考方向：元数据、文件来源证据、已知水印机制和文本水印检查；不声明可直接检测所有模型文本。</p>
        </div>
      </div>
    </section>
  );
}

function IntelDetail({ checkResult, onRunTrustCheck, selectedArticle, setSelectedTag, onUpdateCategory }) {
  if (!selectedArticle) {
    return <p className="empty-state">请选择一条情报。</p>;
  }

  function runTrustCheck() {
    onRunTrustCheck(selectedArticle);
  }

  const catMeta = getCategoryMeta(selectedArticle.intelligenceType, selectedArticle);

  return (
    <article className="intel-detail">
      <div className="intel-detail__head" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 6,
            color: catMeta.color,
            border: `1px solid ${catMeta.border}`,
            backgroundColor: catMeta.bg
          }}
        >
          {catMeta.label}
        </span>
        {selectedArticle.contentNature === 'opinion' ? (
          <span className="badge" style={{ backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
            行业观点
          </span>
        ) : selectedArticle.sourceOrigin === 'direct' ? (
          <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
            官方直采
          </span>
        ) : selectedArticle.verificationStatus === 'verified' ? (
          <span className="badge" style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
            一手源已穿透
          </span>
        ) : (
          <span className="badge" style={{ backgroundColor: '#fefce8', color: '#b45309', border: '1px solid #fef08a' }}>
            未核实一手源头
          </span>
        )}
        {selectedArticle.detailTag ? (
          <span className="badge badge--neutral" style={{ color: '#cbd5e1' }}>
            {selectedArticle.detailTag}
          </span>
        ) : null}
        {selectedArticle.severity ? (
          <span className={`badge badge--${selectedArticle.severity === '重大' ? 'danger' : 'warning'}`}>
            关注级别: {selectedArticle.severity}
          </span>
        ) : null}
        <span className="badge badge--neutral">{formatDate(selectedArticle.publishedAt)}</span>
      </div>
      <h2>{selectedArticle.title}</h2>
      <p>{selectedArticle.summary}</p>
      <section className="intel-insight" aria-label="观点与见解">
        <span>观点与见解</span>
        <p>{selectedArticle.insight || selectedArticle.recommendedAction || selectedArticle.summary}</p>
      </section>
      <div className="intel-detail__actions" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="button button--primary" type="button" onClick={runTrustCheck}>
          可信检查
        </button>
        {onUpdateCategory ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
            <span>校正分类:</span>
            <select
              value={selectedArticle.intelligenceType || '行业动态'}
              onChange={(e) => onUpdateCategory(selectedArticle.id, e.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: 12,
                borderRadius: 6,
                background: 'var(--color-surface, #ffffff)',
                color: 'var(--color-text, #111827)',
                border: '1px solid var(--color-border-strong, #d1d5db)'
              }}
            >
              <option value="法规政策">法规政策</option>
              <option value="安全产品突破">安全产品突破</option>
              <option value="违规处罚与事件">违规处罚与事件</option>
              <option value="行业动态">行业动态</option>
            </select>
          </div>
        ) : null}
      </div>
      {checkResult ? <TrustCheckResult result={checkResult} /> : null}
      <div className="tag-row">
        {selectedArticle.tags.map((tag) => (
          <button className="tag" key={tag} type="button" onClick={() => setSelectedTag(tag)}>
            {tag}
          </button>
        ))}
      </div>
      <dl className="intel-facts">
        <div>
          <dt>来源</dt>
          <dd>{selectedArticle.source}</dd>
        </div>
        {selectedArticle.affectedEntity ? (
          <div>
            <dt>涉事/监管主体</dt>
            <dd style={{ color: '#67e8f9', fontWeight: 600 }}>{selectedArticle.affectedEntity}</dd>
          </div>
        ) : null}
        {selectedArticle.detailTag ? (
          <div>
            <dt>细分标签</dt>
            <dd>{selectedArticle.detailTag}</dd>
          </div>
        ) : null}
        <div>
          <dt>影响</dt>
          <dd>{selectedArticle.impact}</dd>
        </div>
        <div>
          <dt>建议</dt>
          <dd>{selectedArticle.recommendedAction}</dd>
        </div>
        <div>
          <dt>信息来源网站或群组</dt>
          <dd>{renderSourceLink(selectedArticle)}</dd>
        </div>
        {selectedArticle.primaryAuthority ? (
          <div>
            <dt>权威一手源头主体</dt>
            <dd style={{ color: '#0284c7', fontWeight: 600 }}>{selectedArticle.primaryAuthority}</dd>
          </div>
        ) : null}
        {selectedArticle.primaryDocTitle ? (
          <div>
            <dt>原始文件/事件名称</dt>
            <dd>{selectedArticle.primaryDocTitle}</dd>
          </div>
        ) : null}
        {selectedArticle.primaryDate ? (
          <div>
            <dt>原始发生日期</dt>
            <dd>{formatDate(selectedArticle.primaryDate)}</dd>
          </div>
        ) : null}
        {selectedArticle.primaryUrl ? (
          <div>
            <dt>一手源头直达链接</dt>
            <dd>
              <a href={selectedArticle.primaryUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-brand)', wordBreak: 'break-all' }}>
                {selectedArticle.primaryUrl}
              </a>
            </dd>
          </div>
        ) : null}
        {selectedArticle.primaryQuote ? (
          <div>
            <dt>出处佐证证据</dt>
            <dd style={{ fontStyle: 'italic', color: '#475569' }}>"{selectedArticle.primaryQuote}"</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

function TrustCheckResult({ result }) {
  return (
    <section className="trust-check-result" aria-label="可信检查结果">
      <div className="trust-check-result__head">
        <div>
          <span>可信检查完成</span>
          <strong>{result.finalScore}%</strong>
        </div>
        <em>{result.verdict}</em>
      </div>
      <div className="trust-check-result__metrics">
        <span>URL检查 {result.urlStatus.label}</span>
        <span>文本生成痕迹 {result.aiFlavor}%</span>
        <span>可信度影响 {result.delta}</span>
        <span>策略模式 {result.strictness}</span>
      </div>
      <ul>
        {result.reasons.map((reason) => (
          <li key={reason.label}>{reason.detail}</li>
        ))}
      </ul>
    </section>
  );
}

function getCredibilityLevel(score) {
  if (score === null || score === undefined) return '未评估';
  if (score >= 70) return "高";
  if (score >= 40) return "中";
  return "低";
}

function getTrustConfig(strictness, enabledSignals = {}) {
  const enabledCount = Object.values(enabledSignals).filter(Boolean).length || trustSignals.length;
  const configs = {
    宽松: {
      aiThreshold: 80,
      falsePositiveRisk: "较低",
      scene: "普通资讯浏览",
      multiplier: 0.7
    },
    标准: {
      aiThreshold: 65,
      falsePositiveRisk: "中等",
      scene: "日报入库前检查",
      multiplier: 1
    },
    严格: {
      aiThreshold: 50,
      falsePositiveRisk: "较高",
      scene: "重点事件复核",
      multiplier: 1.35
    }
  };

  return {
    ...configs[strictness],
    enabledCount
  };
}

function buildTrustCheck(article, strictness = "标准", enabledSignals = {}) {
  const config = getTrustConfig(strictness, enabledSignals);
  const urlStatus = assessUrlStatus(article.url);
  const enabled = {
    source: true,
    crossCheck: true,
    aiTrace: true,
    metadata: true,
    watermark: true,
    time: true,
    ...enabledSignals
  };
  const credScore = article.credibilityScore ?? 85;
  const aiScore = article.aiGeneratedScore ?? 15;
  const sourcePenalty = enabled.source ? getSourcePenalty(article) : 0;
  const urlPenalty = enabled.source ? urlStatus.penalty : 0;
  const crossPenalty = enabled.crossCheck ? (article.sourceType.includes("镜像") ? 6 : 2) : 0;
  const aiPenalty = enabled.aiTrace ? Math.round(Math.max(0, aiScore - config.aiThreshold) * 0.28) : 0;
  const metadataPenalty = enabled.metadata ? (article.watermarkStatus.includes("镜像") ? 4 : 1) : 0;
  const watermarkPenalty = enabled.watermark ? (article.watermarkStatus.includes("检测到") ? 6 : 0) : 0;
  const timePenalty = enabled.time ? (String(article.publishedAt).includes("T") ? 1 : 5) : 0;
  const rawPenalty = sourcePenalty + urlPenalty + crossPenalty + aiPenalty + metadataPenalty + watermarkPenalty + timePenalty;
  const penalty = Math.round(rawPenalty * config.multiplier);
  const uncappedScore = Math.max(0, Math.min(100, credScore - penalty));
  const finalScore = urlStatus.isExample ? Math.min(42, uncappedScore) : uncappedScore;
  const aiFlavor = Math.max(8, Math.min(96, Math.round(aiScore * config.multiplier + metadataPenalty)));
  const verdict = finalScore >= 85 ? "可信，可直接入库" : finalScore >= 70 ? "可信，建议保留来源备注" : "建议人工复核";

  return {
    aiFlavor,
    delta: penalty === 0 ? "0分" : `-${penalty}分`,
    finalScore,
    strictness,
    urlStatus,
    verdict,
    reasons: [
      {
        label: "URL检查",
        value: urlStatus.label,
        detail: urlStatus.detail
      },
      {
        label: "来源检查",
        value: sourcePenalty ? `扣${sourcePenalty}分` : "通过",
        detail: sourcePenalty || urlPenalty ? "来源为公开镜像、社区渠道或示例链接，需要保留采集备注。" : "来源权威性较高，未发现明显来源风险。"
      },
      {
        label: "文本生成痕迹",
        value: `${aiFlavor}%`,
        detail: aiPenalty ? "文本存在一定模板化或改写痕迹，按当前严格度扣分。" : "文本结构和事实密度处于可接受范围。"
      },
      {
        label: "水印与元数据",
        value: article.watermarkStatus,
        detail: metadataPenalty > 1 ? "元数据来自镜像页或间接页面，建议保留原始链接。" : "未发现会显著降低可信度的水印或元数据问题。"
      },
      {
        label: "时间一致性",
        value: formatDate(article.publishedAt),
        detail: timePenalty > 1 ? "发布时间不够精确，适合进入人工复核队列。" : "发布时间字段完整，可用于日报和趋势统计。"
      }
    ]
  };
}

function assessUrlStatus(url = "") {
  if (!url || url.includes("example.com")) {
    return {
      detail: "该资讯使用示例URL，未通过真实来源检查，可信度需明显下调。",
      isExample: true,
      label: "示例URL",
      penalty: 38
    };
  }

  if (url.includes("twstalker.com")) {
    return {
      detail: "URL来自公开镜像页，适合演示采集，但正式研判需保留原始X账号并做二次校验。",
      isExample: false,
      label: "镜像页",
      penalty: 8
    };
  }

  if (url.startsWith("https://")) {
    return {
      detail: "URL格式为公开HTTPS地址，可作为后续后端可访问性检查对象。",
      isExample: false,
      label: "公开URL",
      penalty: 0
    };
  }

  return {
    detail: "URL格式不完整，需要进入人工复核。",
    isExample: false,
    label: "待复核",
    penalty: 15
  };
}

function renderSourceLink(article) {
  const urlStatus = assessUrlStatus(article.url);

  if (urlStatus.isExample) {
    return (
      <span className="source-link-warning">
        {article.source} / 示例链接，未提供真实来源URL
      </span>
    );
  }

  return (
    <a href={article.url} rel="noreferrer" target="_blank">
      {article.source} / {article.url}
    </a>
  );
}

function getSourcePenalty(article) {
  if (article.sourceType.includes("官方")) return 0;
  if (article.sourceType.includes("镜像")) return 7;
  if (article.sourceType.includes("社区")) return 5;
  return 3;
}

function formatMonth(month) {
  const [year, value] = month.split("-");
  return `${year}年${value}月`;
}

function formatDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return dateValue;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function PanelHeader({ eyebrow, title, action }) {
  return (
    <div className="panel-header">
      <div>
        {eyebrow ? <span className="panel-eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      {action ? <span>{action}</span> : null}
    </div>
  );
}

function ScoreBar({ label, value }) {
  return (
    <div className="score-bar">
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <i>
        <b style={{ width: `${value}%` }} />
      </i>
    </div>
  );
}
