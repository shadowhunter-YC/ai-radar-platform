"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import DailyReports, { LatestDailyBrief } from "./DailyReports";
import ManualCollection from "./ManualCollection";
import SourceManager from "./SourceManager";
import { CANONICAL_TAGS, normalizeTags } from "@/lib/tag-taxonomy.mjs";

const navItems = [
  { key: "overview", label: "动态大屏", href: "/", icon: "dashboard" },
  { key: "analysis", label: "资讯库", href: "/analysis", icon: "library" },
  { key: "sources", label: "资讯源配置", href: "/sources", icon: "source" },
  { key: "credibility", label: "可信检查配置", href: "/credibility", icon: "shield" },
  { key: "reports", label: "报告中心", href: "/reports", icon: "report" }
];

const pageMeta = {
  overview: {
    eyebrow: "",
    title: "AI情报雷达平台",
    description: ""
  },
  sources: {
    eyebrow: "来源管理",
    title: "AI资讯源配置",
    description: "手动读取公开文章或RSS，使用 DeepSeek 分析，确认后保存到资讯库。没有后台定时采集。"
  },
  analysis: {
    eyebrow: "AI Analysis",
    title: "AI摘要、分类与标签生成",
    description: "将原始文章转化为可研判的资讯卡片，突出类型、标签、业务影响和跟进行动。"
  },
  credibility: {
    eyebrow: "Trust Check Console",
    title: "可信检查配置",
    description: "配置文本生成痕迹、来源可信、水印和元数据检测策略，为资讯入库与报告生成提供可信度依据。"
  },
  reports: {
    eyebrow: "个人日报",
    title: "报告中心",
    description: "选择关注的分类、标签和新闻，通过 DeepSeek 生成日报，并查看历史记录。"
  }
};

const riskTone = {
  高: "danger",
  中: "warning",
  低: "success"
};

const layerOptions = [
  { key: "security", label: "安全事件", category: "安全事件", tone: "red" },
  { key: "regulation", label: "合规动态", category: "合规动态", tone: "yellow" },
  { key: "product", label: "产品动态", category: "产品动态", tone: "blue" }
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
  const [selectedArticleId, setSelectedArticleId] = useState(initialArticleId || initialState.articles[0]?.id);
  const [configuredSources, setConfiguredSources] = useState(initialState.sources);

  const meta = pageMeta[view] || pageMeta.overview;
  const allTags = useMemo(
    () => ["全部", ...CANONICAL_TAGS],
    []
  );
  const allTypes = useMemo(
    () => ["全部", ...new Set(initialState.articles.map((item) => item.intelligenceType))],
    [initialState.articles]
  );
  const allMonths = useMemo(
    () => ["全部", ...new Set(initialState.articles.map((item) => item.publishedAt.slice(0, 7)))],
    [initialState.articles]
  );

  const filteredArticles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return initialState.articles.filter((item) => {
      if (selectedRegion !== "全部" && item.region !== selectedRegion) return false;
      if (selectedType !== "全部" && item.intelligenceType !== selectedType) return false;
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

        if (!searchableText.includes(query)) return false;
      }
      return true;
    });
  }, [initialState.articles, searchQuery, selectedCredibility, selectedMonth, selectedRegion, selectedTag, selectedType]);

  const selectedArticle =
    filteredArticles.find((item) => item.id === selectedArticleId) ||
    filteredArticles[0] ||
    initialState.articles[0];

  function resetFilters() {
    setSelectedRegion("全部");
    setSelectedType("全部");
    setSelectedTag("全部");
    setSelectedMonth("全部");
    setSelectedCredibility("全部");
    setSearchQuery("");
  }

  return (
    <div className="workspace-shell">
      <aside className="app-sidebar" aria-label="平台导航">
        <div className="app-sidebar__brand">
          <span className="app-sidebar__mark" aria-hidden="true">
            <NavIcon name="radar" />
          </span>
          <span>
            <strong>AI情报雷达平台</strong>
          </span>
        </div>
        <nav className="app-sidebar__nav">
          {navItems.map((item) => (
            <a
              className={`app-sidebar__item ${view === item.key ? "is-active" : ""}`}
              href={item.href}
              key={item.key}
            >
              <span className="app-sidebar__icon" aria-hidden="true">
                <NavIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <div className="workspace-shell__main">
        <main className={`workspace-shell__content workspace-shell__content--${view}`}>
          <PageIntro meta={meta} view={view} onReset={resetFilters} />
          {view === "overview" ? (
            <OverviewPage
              initialState={initialState}
              filteredArticles={filteredArticles}
              selectedCountryCode={selectedCountryCode}
              selectedRegion={selectedRegion}
              activeLayers={activeLayers}
              setActiveLayers={setActiveLayers}
              setSelectedCountryCode={setSelectedCountryCode}
              setSelectedRegion={setSelectedRegion}
              setSelectedArticleId={setSelectedArticleId}
            />
          ) : null}
          {view === "sources" ? (
            <SourceManager />
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
              setSelectedType={setSelectedType}
            />
          ) : null}
          {view === "credibility" ? <CredibilityPage selectedArticle={selectedArticle} /> : null}
          {view === "reports" ? <DailyReports articles={initialState.articles} mode={initialState.mode} /> : null}
        </main>
      </div>
    </div>
  );
}

function NavIcon({ name }) {
  const icons = {
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

function PageIntro({ meta, view, onReset }) {
  return (
    <section className={`page-header ${view === "overview" ? "page-header--overview" : ""}`}>
      <div className="page-header__body">
        {meta.eyebrow ? <p className="page-header__eyebrow">{meta.eyebrow}</p> : null}
        <h1 className="page-header__title">{meta.title}</h1>
        {meta.description ? <p className="page-header__description">{meta.description}</p> : null}
      </div>
      <div className="page-header__actions">
        {view === "overview" ? (
          <>
            <span className="status-chip status-chip--blue">8个重点国家</span>
            <span className="status-chip status-chip--yellow">3类资讯图层</span>
            <span className="status-chip status-chip--green">OSM实时底图</span>
          </>
        ) : null}
        {view === "analysis" ? (
          <button className="button button--secondary" type="button" onClick={onReset}>
            重置筛选
          </button>
        ) : null}
      </div>
    </section>
  );
}

function OverviewStats({ dashboard, countryStats, articles }) {
  const securityCount =
    dashboard.byType?.["安全事件"] ||
    articles.filter((a) => a.intelligenceType === "安全事件").length;

  const stats = [
    {
      label: "收录资讯",
      value: dashboard.totalArticles,
      unit: "条",
      accent: "info",
      desc: "当前库内可分析"
    },
    {
      label: "活跃监控来源",
      value: dashboard.activeSources,
      unit: "个",
      accent: "success",
      desc: "持续采集中"
    },
    {
      label: "高风险事件",
      value: dashboard.highRisk,
      unit: "条",
      accent: "danger",
      desc: "需立即关注"
    },
    {
      label: "平均可信度",
      value: dashboard.avgCredibility,
      unit: "%",
      accent: "success",
      desc: "全量资讯均值"
    },
    {
      label: "重点关注标签",
      value: CANONICAL_TAGS.length,
      unit: "类",
      accent: "info",
      desc: "固化分类体系"
    },
    {
      label: "安全类事件",
      value: securityCount,
      unit: "条",
      accent: "warning",
      desc: "攻击/漏洞/泄露"
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

function OverviewPage({
  initialState,
  filteredArticles,
  selectedCountryCode,
  selectedRegion,
  activeLayers,
  setActiveLayers,
  setSelectedCountryCode,
  setSelectedRegion,
  setSelectedArticleId
}) {
  const [liveTotals, setLiveTotals] = useState({});
  const liveCountryCodes = ["US", "CN", "JP"];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveTotals((current) => {
        const next = { ...current };
        liveCountryCodes.forEach((code, index) => {
          next[code] = (next[code] || 0) + index + 1;
        });
        return next;
      });
    }, 2200);

    return () => window.clearInterval(timer);
  }, []);

  const liveCountryStats = useMemo(() => {
    const totalBase = initialState.countryStats.reduce((sum, country) => sum + country.total, 0);
    const totalDelta = Object.values(liveTotals).reduce((sum, value) => sum + value, 0);
    const liveGrandTotal = totalBase + totalDelta;

    return initialState.countryStats
      .map((country) => {
        const delta = liveTotals[country.code] || 0;
        const total = country.total + delta;
        const highRisk = country.highRisk + Math.floor(delta / 5);
        const heat = Math.min(100, country.heat + Math.floor(delta / 4));

        return {
          ...country,
          total,
          highRisk,
          heat,
          share: `${((total / liveGrandTotal) * 100).toFixed(1)}%`,
          liveDelta: delta
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [initialState.countryStats, liveTotals]);

  const selectedCountry =
    liveCountryStats.find((country) => country.code === selectedCountryCode) ||
    liveCountryStats[0];
  const selectedFeed = initialState.countryFeeds[selectedCountry.code];

  function selectCountry(country) {
    setSelectedCountryCode(country.code);
    setSelectedRegion(country.region);
  }

  return (
    <>
      <OverviewStats
        dashboard={initialState.dashboard}
        countryStats={initialState.countryStats}
        articles={initialState.articles}
      />
      <section className="dashboard-grid dashboard-grid--overview">
        <div className="panel panel--map">
          <PanelHeader eyebrow="全球雷达" title="全球AI相关动态分布" action={`${selectedCountry.name} / ${selectedCountry.total} 条动态`} />
          <div className="geo-board">
            <div className="country-ranking">
              <div className="table-title">
                <strong>AI相关热点国家 TOP 8</strong>
                <span>AI相关资讯热度指数</span>
              </div>
              <div className="country-row country-row--head">
                <span>国家</span>
                <span>动态数</span>
                <span>重点关注</span>
                <span>热度占比</span>
              </div>
              {liveCountryStats.map((country) => (
                <button
                  className={`country-row ${selectedCountryCode === country.code ? "is-active" : ""} ${country.liveDelta ? "is-live" : ""}`}
                  key={country.code}
                  onClick={() => selectCountry(country)}
                  type="button"
                >
                  <span>{country.name}</span>
                  <span>
                    {country.total}
                    {country.liveDelta ? <em>+{country.liveDelta}</em> : null}
                  </span>
                  <span>
                    {country.highRisk}
                    {country.liveDelta >= 5 ? <em>+{Math.floor(country.liveDelta / 5)}</em> : null}
                  </span>
                  <span>{country.share}</span>
                </button>
              ))}
            </div>
            <WorldMap
              activeLayers={activeLayers}
              countries={liveCountryStats}
              selectedCountryCode={selectedCountryCode}
              selectCountry={selectCountry}
              setActiveLayers={setActiveLayers}
            />
          </div>
        </div>
        <LatestDailyBrief articles={initialState.articles} />
      </section>
      <CountryFeedPanel
        activeLayers={activeLayers}
        articles={initialState.articles}
        country={selectedCountry}
        feed={selectedFeed}
        setSelectedArticleId={setSelectedArticleId}
      />
    </>
  );
}

function CountryFeedPanel({ activeLayers, articles, country, feed, setSelectedArticleId }) {
  if (!feed) {
    return null;
  }

  const visibleCategories = feed.categories.filter((category) => {
    const matchedLayer = layerOptions.find((layer) => layer.category === category.name);
    return matchedLayer ? activeLayers[matchedLayer.key] : true;
  });

  return (
    <aside className="country-feed-panel country-feed-panel--wide" aria-label={`${country.name}AI相关资讯`}>
      <div className="country-feed-panel__head">
        <div>
          <span>当前国家</span>
          <strong>{feed.country}</strong>
        </div>
        <em>{country.total} 条动态</em>
      </div>
      <div className="country-feed-summary">
        <div>
          <span>资讯总量</span>
          <strong>{country.total}</strong>
        </div>
        <div>
          <span>重点关注</span>
          <strong>{country.highRisk}</strong>
        </div>
        <div>
          <span>热度占比</span>
          <strong>{country.share}</strong>
        </div>
      </div>
      <div className="country-feed-scroll">
        {visibleCategories.map((category) => (
          <section className="feed-category" key={category.name}>
            <div className="feed-category__title">
              <strong>{category.name}</strong>
              <span>{category.count} 条</span>
            </div>
            <div className="feed-news-list">
              {category.items.map((item, index) => {
                const article = findArticleForFeed(articles, country.code, category.name, index);

                return (
                <Link
                  className="feed-news"
                  href={`/analysis?article=${article.id}`}
                  key={item}
                  onClick={() => setSelectedArticleId(article.id)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{item}</p>
                </Link>
                );
              })}
            </div>
          </section>
        ))}
        {visibleCategories.length === 0 ? <p className="empty-state">请至少选择一个地图图层。</p> : null}
      </div>
    </aside>
  );
}

function findArticleForFeed(articles, countryCode, categoryName, index) {
  const normalizedCategory = categoryName;
  const countryArticles = articles.filter(
    (article) => article.countryCode === countryCode && article.intelligenceType === normalizedCategory
  );
  const typeArticles = articles.filter((article) => article.intelligenceType === normalizedCategory);
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
  setSelectedType
}) {
  const [trustResults, setTrustResults] = useState({});
  const selectedTrustResult = selectedArticle ? trustResults[selectedArticle.id] : null;

  function runArticleTrustCheck(article) {
    setTrustResults((current) => ({
      ...current,
      [article.id]: buildTrustCheck(article, "标准")
    }));
  }

  return (
    <section className="analysis-workspace">
      <div className="panel analysis-search-card">
        <label className="analysis-search-card__query">
          搜索AI资讯
          <input
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="输入产品、事件、国家、来源或关键词"
            value={searchQuery}
          />
        </label>
        <div className="analysis-search-card__filters">
          <label>
            情报类型
            <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
              {allTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            关键标签
            <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
              {allTags.map((tag) => (
                <option key={tag}>{tag}</option>
              ))}
            </select>
          </label>
          <label>
            年月
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              {allMonths.map((month) => (
                <option key={month} value={month}>
                  {month === "全部" ? "全部" : formatMonth(month)}
                </option>
              ))}
            </select>
          </label>
          <label>
            可信度范围
            <select value={selectedCredibility} onChange={(event) => setSelectedCredibility(event.target.value)}>
              <option>全部</option>
              <option>高</option>
              <option>中</option>
              <option>低</option>
            </select>
          </label>
        </div>
      </div>

      <section className="dashboard-grid analysis-grid">
        <div className="panel analysis-list-panel">
          <PanelHeader eyebrow="资讯检索" title="资讯结果" action={`${filteredArticles.length} 条`} />
          <div className="article-list article-list--spaced">
            {filteredArticles.map((item) => (
              <button
                className={`article-row ${selectedArticleId === item.id ? "is-active" : ""}`}
                key={item.id}
                onClick={() => setSelectedArticleId(item.id)}
                type="button"
              >
                <span className={`risk-dot risk-dot--${riskTone[item.riskLevel]}`} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.isSample ? '示例新闻' : item.provenance === 'paste' ? '用户提供' : '入库文章'} / {item.sourceType} / {item.intelligenceType} / {formatDate(item.publishedAt)}</small>
                </span>
              </button>
            ))}
            {filteredArticles.length === 0 ? <p className="empty-state">没有匹配的AI资讯。</p> : null}
          </div>
        </div>

        <div className="panel analysis-detail-panel">
          <PanelHeader eyebrow="资讯详情" title="AI资讯卡片详情" action="详情" />
          
          <IntelDetail
            checkResult={selectedTrustResult}
            onRunTrustCheck={runArticleTrustCheck}
            selectedArticle={selectedArticle}
            setSelectedTag={setSelectedTag}
          />
        </div>
      </section>
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
        <PanelHeader eyebrow="检查策略" title="可信检查配置" action={strictness} />
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
        <PanelHeader eyebrow="技术参考" title="检测点说明" action="可配置" />
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

function WorldMap({ activeLayers, countries, selectedCountryCode, selectCountry, setActiveLayers }) {
  const mapRef = useRef(null);
  const dragRef = useRef(null);
  const [view, setView] = useState({ scale: 1.08, x: 0, y: 0 });
  const zoom = 2;
  const tileCols = [0, 1, 2, 3];
  const tileRows = [1, 2];

  function updateScale(nextScale) {
    setView((current) => ({
      ...current,
      scale: Math.max(1, Math.min(3.2, nextScale))
    }));
  }

  function handleWheel(event) {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -0.12 : 0.12;
    updateScale(view.scale + direction);
  }

  function handlePointerDown(event) {
    if (event.target instanceof Element && event.target.closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y
    };
  }

  function handlePointerMove(event) {
    if (!dragRef.current) return;
    const nextX = dragRef.current.originX + event.clientX - dragRef.current.startX;
    const nextY = dragRef.current.originY + event.clientY - dragRef.current.startY;
    setView((current) => ({
      ...current,
      x: Math.max(-420, Math.min(420, nextX)),
      y: Math.max(-240, Math.min(240, nextY))
    }));
  }

  function handlePointerUp(event) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function resetMap() {
    setView({ scale: 1.08, x: 0, y: 0 });
  }

  return (
    <div
      className="world-map world-map--osm"
      aria-label="OpenStreetMap AI情报世界地图"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      ref={mapRef}
    >
      <MapLayerControl activeLayers={activeLayers} setActiveLayers={setActiveLayers} />
      <div
        className="osm-world"
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`
        }}
      >
        <div className="osm-tiles" aria-hidden="true">
          {tileRows.flatMap((row) =>
            tileCols.map((col) => (
              <img
                alt=""
                className="osm-tile"
                draggable="false"
                key={`${col}-${row}`}
                src={`https://tile.openstreetmap.org/${zoom}/${col}/${row}.png`}
                style={{
                  left: `${col * 25}%`,
                  top: `${(row - 1) * 50}%`,
                  width: "25%",
                  height: "50%"
                }}
              />
            ))
          )}
        </div>
        <div className="osm-overlay" aria-hidden="true" />
        <div className="osm-grid" aria-hidden="true" />
        <div className="osm-markers">
          {countries.map((country) => (
            <button
              aria-label={`查看${country.name}情报`}
              className={`osm-marker ${selectedCountryCode === country.code ? "is-active" : ""}`}
              key={country.code}
              onClick={() => selectCountry(country)}
              style={{
                left: `${projectLng(country.lng)}%`,
                top: `${projectLat(country.lat)}%`,
                "--heat": country.heat
              }}
              type="button"
            >
              <i />
              <span>{country.name}</span>
            </button>
          ))}
          {countries.flatMap((country) =>
            layerOptions
              .filter((layer) => activeLayers[layer.key])
              .map((layer, index) => (
                <span
                  className={`event-dot event-dot--${layer.tone}`}
                  key={`${country.code}-${layer.key}`}
                  style={{
                    left: `${projectLng(country.lng + layerOffset(index).lng)}%`,
                    top: `${projectLat(country.lat + layerOffset(index).lat)}%`
                  }}
                  title={`${country.name} / ${layer.label}`}
                />
              ))
          )}
        </div>
      </div>
      <div className="map-controls" aria-label="地图缩放控制">
        <button type="button" onClick={() => updateScale(view.scale + 0.22)} aria-label="放大地图">+</button>
        <button type="button" onClick={() => updateScale(view.scale - 0.22)} aria-label="缩小地图">-</button>
        <button type="button" onClick={resetMap} aria-label="复位地图">⌂</button>
      </div>
      <div className="map-zoom-label">Zoom {view.scale.toFixed(2)}x</div>
      <div className="osm-legend" aria-hidden="true">
        <span>高</span>
        <i />
        <span>低</span>
      </div>
      <a
        className="osm-attribution"
        href="https://www.openstreetmap.org/copyright"
        rel="noreferrer"
        target="_blank"
      >
        © OpenStreetMap contributors
      </a>
    </div>
  );
}

function MapLayerControl({ activeLayers, setActiveLayers }) {
  return (
    <div className="map-layer-control" aria-label="地图图层筛选">
      <div className="map-layer-control__title">
        <strong>图层</strong>
        <span>筛选地图点位</span>
      </div>
      {layerOptions.map((layer) => (
        <label className={`map-layer map-layer--${layer.tone}`} key={layer.key}>
          <input
            checked={activeLayers[layer.key]}
            onChange={(event) =>
              setActiveLayers((current) => ({
                ...current,
                [layer.key]: event.target.checked
              }))
            }
            type="checkbox"
          />
          <i />
          <span>{layer.label}</span>
        </label>
      ))}
    </div>
  );
}

function layerOffset(index) {
  const offsets = [
    { lng: -2.8, lat: 1.8 },
    { lng: 2.8, lat: 1.4 },
    { lng: 0.6, lat: -2.6 }
  ];

  return offsets[index] || offsets[0];
}

function projectLng(lng) {
  return ((lng + 180) / 360) * 100;
}

function projectLat(lat) {
  const clamped = Math.max(Math.min(lat, 66.5), -66.5);
  const rad = (clamped * Math.PI) / 180;
  const mercatorY = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  return ((mercatorY * 4 - 1) / 2) * 100;
}

function IntelDetail({ checkResult, onRunTrustCheck, selectedArticle, setSelectedTag }) {
  if (!selectedArticle) {
    return <p className="empty-state">请选择一条情报。</p>;
  }

  function runTrustCheck() {
    onRunTrustCheck(selectedArticle);
  }

  return (
    <article className="intel-detail">
      <div className="intel-detail__head">
        <span className="badge badge--neutral">{selectedArticle.intelligenceType}</span>
        <span className="badge badge--neutral">{formatDate(selectedArticle.publishedAt)}</span>
      </div>
      <h2>{selectedArticle.title}</h2>
      <p>{selectedArticle.summary}</p>
      <section className="intel-insight" aria-label="观点与见解">
        <span>观点与见解</span>
        <p>{selectedArticle.insight || selectedArticle.recommendedAction || selectedArticle.summary}</p>
      </section>
      <div className="intel-detail__actions">
        <button className="button button--primary" type="button" onClick={runTrustCheck}>
          可信检查
        </button>
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
        <span className="panel-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <span>{action}</span>
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
