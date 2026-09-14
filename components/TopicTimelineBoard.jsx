"use client";

import { useMemo, useState, useEffect } from "react";
import TopicCreateModal from "./TopicCreateModal";

const CATEGORY_PILLS = ["全部", "AI 法规动态", "AI 安全产品动态", "事件动态"];

const CATEGORY_COLORS = {
  "AI 法规动态": {
    bg: "#f0fdf4",
    border: "#bbf7d0",
    text: "#15803d"
  },
  "AI 安全产品动态": {
    bg: "#eff6ff",
    border: "#bfdbfe",
    text: "#1d4ed8"
  },
  "事件动态": {
    bg: "#fef2f2",
    border: "#fecaca",
    text: "#b91c1c"
  }
};

export default function TopicTimelineBoard({ initialTopics = [], allArticles = [], onSelectArticle }) {
  const [topics, setTopics] = useState(initialTopics);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedTopicId, setSelectedTopicId] = useState(initialTopics[0]?.id || "");
  const [sortAsc, setSortAsc] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [topicToEdit, setTopicToEdit] = useState(null);

  // Tab 切换：演进时间线 vs 关联行业观点与深度解读
  const [activeTab, setActiveTab] = useState("timeline");

  // 侧边栏详情抽屉状态
  const [selectedDrawerArticle, setSelectedDrawerArticle] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerList, setDrawerList] = useState([]);

  // 过滤展示的专题
  const filteredTopics = useMemo(() => {
    if (selectedCategory === "全部") return topics;
    return topics.filter(t => t.category === selectedCategory);
  }, [topics, selectedCategory]);

  // 当前激活的专题
  const activeTopic = useMemo(() => {
    return filteredTopics.find(t => t.id === selectedTopicId) || filteredTopics[0] || null;
  }, [filteredTopics, selectedTopicId]);

  // 对里程碑进行排序
  const milestones = useMemo(() => {
    if (!activeTopic?.milestones) return [];
    const list = [...activeTopic.milestones];
    return list.sort((a, b) => {
      const timeA = new Date(a.timelineDate || a.publishedAt || 0).getTime();
      const timeB = new Date(b.timelineDate || b.publishedAt || 0).getTime();
      return sortAsc ? timeA - timeB : timeB - timeA;
    });
  }, [activeTopic, sortAsc]);

  const associatedOpinions = activeTopic?.associatedOpinions || [];

  // 当前抽屉在列表中的索引
  const currentDrawerIndex = useMemo(() => {
    if (!selectedDrawerArticle || !drawerList.length) return -1;
    return drawerList.findIndex(a => a.id === selectedDrawerArticle.id);
  }, [selectedDrawerArticle, drawerList]);

  function navigateDrawerAdjacent(delta) {
    if (!drawerList.length || currentDrawerIndex === -1) return;
    const nextIdx = currentDrawerIndex + delta;
    if (nextIdx >= 0 && nextIdx < drawerList.length) {
      setSelectedDrawerArticle(drawerList[nextIdx]);
    }
  }

  // 键盘快捷键监听：Esc 关闭抽屉，↑/↓ 键翻页
  useEffect(() => {
    function handleKeyDown(e) {
      if (!isDrawerOpen) return;
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        navigateDrawerAdjacent(-1);
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        navigateDrawerAdjacent(1);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, currentDrawerIndex, drawerList]);

  function handleArticleClick(item, list) {
    setSelectedDrawerArticle(item);
    setDrawerList(list || []);
    setIsDrawerOpen(true);
    if (onSelectArticle) {
      onSelectArticle(item);
    }
  }

  function handleOpenCreate() {
    setTopicToEdit(null);
    setIsCreateModalOpen(true);
  }

  function handleOpenEdit(e, topic) {
    e.stopPropagation();
    setTopicToEdit(topic);
    setIsCreateModalOpen(true);
  }

  function handleTopicSaved(savedTopic) {
    setTopics(prev => {
      const exists = prev.some(t => t.id === savedTopic.id);
      if (exists) {
        return prev.map(t => (t.id === savedTopic.id ? savedTopic : t));
      }
      return [savedTopic, ...prev];
    });
    setSelectedTopicId(savedTopic.id);
  }

  async function handleDeleteTopic(e, topicId) {
    e.stopPropagation();
    if (!confirm("确认删除该自定义专题？（删除后不影响底层资讯库）")) return;

    try {
      const res = await fetch(`/api/topics?id=${encodeURIComponent(topicId)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setTopics(prev => prev.filter(t => t.id !== topicId));
      } else {
        const data = await res.json();
        alert(data.error || "删除失败");
      }
    } catch {
      alert("网络异常，删除失败");
    }
  }

  function formatDate(str) {
    if (!str) return "未知时间";
    try {
      const d = new Date(str);
      if (isNaN(d.getTime())) return str;
      return d.toISOString().slice(0, 10);
    } catch {
      return str;
    }
  }

  return (
    <section className="topic-timeline-board">
      {/* 顶部控制栏 */}
      <div className="topic-header-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-secondary)" }}>
            专题分类:
          </span>
          <div className="filter-pills" style={{ display: "flex", gap: 6 }}>
            {CATEGORY_PILLS.map(cat => (
              <button
                key={cat}
                type="button"
                className={`filter-pill ${selectedCategory === cat ? "is-active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: selectedCategory === cat ? "1px solid var(--color-brand)" : "1px solid var(--color-border)",
                  backgroundColor: selectedCategory === cat ? "var(--color-brand)" : "#ffffff",
                  color: selectedCategory === cat ? "#ffffff" : "var(--color-text-secondary)",
                  transition: "all 0.15s ease"
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="button button--primary"
          onClick={handleOpenCreate}
          style={{ fontSize: 12, padding: "6px 14px" }}
        >
          + 新建演进专题
        </button>
      </div>

      {/* 主体工作台：左侧专题导航 + 右侧时间线档案 */}
      <div className="topic-workspace-grid" style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        {/* 左侧专题导航卡片 */}
        <div className="panel topic-sidebar-panel" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid var(--color-border-subtle)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)" }}>
              专题清单 ({filteredTopics.length})
            </span>
          </div>

          {filteredTopics.map(t => {
            const colors = CATEGORY_COLORS[t.category] || CATEGORY_COLORS["AI 法规动态"];
            const isActive = activeTopic?.id === t.id;

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTopicId(t.id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  border: isActive ? `1.5px solid ${colors.text}` : "1px solid var(--color-border-subtle)",
                  backgroundColor: isActive ? "#ffffff" : "var(--color-surface, #ffffff)",
                  boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 4,
                      backgroundColor: colors.bg,
                      color: colors.text,
                      border: `1px solid ${colors.border}`
                    }}
                  >
                    {t.category}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {t.isPreset ? (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "var(--color-text-muted)",
                          backgroundColor: "#f1f5f9",
                          padding: "1px 5px",
                          borderRadius: 3,
                          border: "1px solid #e2e8f0"
                        }}
                      >
                        标杆
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={e => handleOpenEdit(e, t)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--color-brand-strong, #86bc25)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: "0 2px"
                      }}
                      title="编辑规则"
                    >
                      编辑
                    </button>
                    {!t.isPreset ? (
                      <button
                        type="button"
                        onClick={e => handleDeleteTopic(e, t.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          fontSize: 11,
                          cursor: "pointer",
                          padding: "0 2px"
                        }}
                        title="删除该专题"
                      >
                        删除
                      </button>
                    ) : null}
                  </div>
                </div>

                <strong style={{ fontSize: 13, lineHeight: 1.4, display: "block", color: "var(--color-text)", marginBottom: 4 }}>
                  {t.title}
                </strong>

                <div style={{ fontSize: 11, color: "var(--color-text-muted)", display: "flex", gap: 10 }}>
                  <span>{t.milestoneCount || t.milestones?.length || 0} 个里程碑</span>
                  <span>{t.opinionCount || t.associatedOpinions?.length || 0} 篇解读</span>
                </div>
              </div>
            );
          })}

          {filteredTopics.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", textAlign: "center", padding: "20px 0" }}>
              当前分类下暂无专题。
            </p>
          ) : null}
        </div>

        {/* 右侧专题知识档案与时间线 */}
        {activeTopic ? (
          <div className="panel topic-main-panel" style={{ padding: 18, minHeight: 640 }}>
            {/* 专题顶部综述栏 */}
            <div className="topic-dossier-header" style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--color-border-subtle)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 4,
                      backgroundColor: (CATEGORY_COLORS[activeTopic.category] || CATEGORY_COLORS["AI 法规动态"]).bg,
                      color: (CATEGORY_COLORS[activeTopic.category] || CATEGORY_COLORS["AI 法规动态"]).text,
                      border: `1px solid ${(CATEGORY_COLORS[activeTopic.category] || CATEGORY_COLORS["AI 法规动态"]).border}`
                    }}
                  >
                    {activeTopic.category}
                  </span>
                  {activeTopic.isPreset ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        backgroundColor: "#f1f5f9",
                        padding: "2px 6px",
                        borderRadius: 3,
                        border: "1px solid #e2e8f0"
                      }}
                    >
                      系统标杆
                    </span>
                  ) : null}
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--color-text)" }}>
                    {activeTopic.title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={e => handleOpenEdit(e, activeTopic)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 12px",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-brand-strong, #86bc25)",
                    backgroundColor: "rgba(134, 188, 37, 0.08)",
                    border: "1px solid rgba(134, 188, 37, 0.35)",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  title="编辑当前专题的抽取规则与信息"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  编辑规则
                </button>
              </div>

              {activeTopic.summary ? (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 6,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    color: "#334155"
                  }}
                >
                  <strong style={{ color: "#0f172a", display: "inline-block", marginRight: 6 }}>
                    现状综述与研判:
                  </strong>
                  {activeTopic.summary}
                </div>
              ) : null}

              {/* 关键词抽取规则展示 */}
              {activeTopic.ruleKeywords && activeTopic.ruleKeywords.length > 0 ? (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11, color: "var(--color-text-muted)" }}>
                  <span>抽取规则:</span>
                  {activeTopic.ruleKeywords.map((kw, i) => (
                    <span
                      key={i}
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#f1f5f9",
                        border: "1px solid #e2e8f0",
                        borderRadius: 4,
                        fontFamily: "monospace"
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {/* 顶部 Tab 切换：时间线 vs 关联行业观点与深度解读 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border)", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab("timeline")}
                  style={{
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: activeTab === "timeline" ? 700 : 500,
                    color: activeTab === "timeline" ? "var(--color-brand-strong, #86bc25)" : "var(--color-text-secondary)",
                    borderBottom: activeTab === "timeline" ? "2px solid var(--color-brand-strong, #86bc25)" : "2px solid transparent",
                    background: "none",
                    borderTop: "none",
                    borderLeft: "none",
                    borderRight: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <span>时间线</span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "1px 6px",
                      borderRadius: 10,
                      backgroundColor: activeTab === "timeline" ? "rgba(134,188,37,0.15)" : "#f1f5f9",
                      color: activeTab === "timeline" ? "var(--color-brand-strong, #86bc25)" : "var(--color-text-muted)",
                      fontFamily: "monospace"
                    }}
                  >
                    {milestones.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("opinions")}
                  style={{
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: activeTab === "opinions" ? 700 : 500,
                    color: activeTab === "opinions" ? "var(--color-brand-strong, #86bc25)" : "var(--color-text-secondary)",
                    borderBottom: activeTab === "opinions" ? "2px solid var(--color-brand-strong, #86bc25)" : "2px solid transparent",
                    background: "none",
                    borderTop: "none",
                    borderLeft: "none",
                    borderRight: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <span>关联行业观点与深度解读</span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "1px 6px",
                      borderRadius: 10,
                      backgroundColor: activeTab === "opinions" ? "rgba(134,188,37,0.15)" : "#f1f5f9",
                      color: activeTab === "opinions" ? "var(--color-brand-strong, #86bc25)" : "var(--color-text-muted)",
                      fontFamily: "monospace"
                    }}
                  >
                    {associatedOpinions.length}
                  </span>
                </button>
              </div>

              {/* 时间线控制按钮（倒序/正序） */}
              {activeTab === "timeline" && milestones.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSortAsc(!sortAsc)}
                  style={{
                    background: "none",
                    border: "1px solid var(--color-border)",
                    borderRadius: 4,
                    padding: "3px 8px",
                    fontSize: 11,
                    cursor: "pointer",
                    color: "var(--color-text-secondary)"
                  }}
                >
                  {sortAsc ? "正序 (早 -> 晚)" : "倒序 (最新在前)"}
                </button>
              )}
            </div>

            {/* TAB 1: 演进时间线 (铺满，极简紧凑：时间、标题、摘要) */}
            {activeTab === "timeline" && (
              <div className="timeline-container" style={{ width: "100%" }}>
                {milestones.length === 0 ? (
                  <div style={{ padding: "24px 20px", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: 6, border: "1px dashed #cbd5e1" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                      当前库内暂无命中本专题的客观事件里程碑
                    </p>
                    <div style={{ margin: "12px auto", maxWidth: 460, fontSize: 11.5, color: "#475569", textAlign: "left", backgroundColor: "#ffffff", padding: "10px 14px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                      <div><strong>当前分类：</strong>{activeTopic.category}</div>
                      <div style={{ marginTop: 4 }}><strong>关键词规则：</strong>{activeTopic.ruleKeywords && activeTopic.ruleKeywords.length > 0 ? activeTopic.ruleKeywords.join(" & ") : "（无）"}</div>
                      <div style={{ marginTop: 6, color: "#991b1b", lineHeight: 1.5 }}>
                        原因排查：系统要求文章<strong>同时满足</strong>专题分类与关键词（AND 关系）。若关键词过窄，会导致匹配结果为 0。
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={e => handleOpenEdit(e, activeTopic)}
                      style={{ fontSize: 12, padding: "5px 14px" }}
                    >
                      修改抽取规则
                    </button>
                  </div>
                ) : (
                  <div className="timeline-nodes-list" style={{ position: "relative", paddingLeft: 24 }}>
                    {/* 时间线轴线 */}
                    <div
                      style={{
                        position: "absolute",
                        left: 7,
                        top: 10,
                        bottom: 10,
                        width: 2,
                        backgroundColor: "var(--color-border)"
                      }}
                    />

                    {milestones.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        onClick={() => handleArticleClick(item, milestones)}
                        style={{
                          position: "relative",
                          marginBottom: 10
                        }}
                      >
                        {/* 节点原点 */}
                        <div
                          style={{
                            position: "absolute",
                            left: -24 + 3,
                            top: 12,
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: item.severity === "重大" ? "#ef4444" : "var(--color-brand, #86bc25)",
                            border: "2px solid #ffffff",
                            boxShadow: "0 0 0 1px var(--color-border)"
                          }}
                        />

                        {/* 紧凑卡片：只保留时间、标题、摘要 */}
                        <div
                          className="timeline-compact-card"
                          style={{
                            padding: "10px 14px",
                            borderRadius: 6,
                            backgroundColor: "#ffffff",
                            border: "1px solid var(--color-border)",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: "var(--font-en, monospace)",
                                fontWeight: 700,
                                color: "#0f172a",
                                backgroundColor: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                padding: "1px 6px",
                                borderRadius: 3
                              }}
                            >
                              {formatDate(item.timelineDate || item.publishedAt)}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                              详情 &rarr;
                            </span>
                          </div>

                          <h4
                            style={{
                              margin: "0 0 4px",
                              fontSize: 13.5,
                              fontWeight: 600,
                              lineHeight: 1.4,
                              color: "var(--color-text)"
                            }}
                          >
                            {item.title}
                          </h4>

                          <p
                            style={{
                              margin: 0,
                              fontSize: 12,
                              lineHeight: 1.55,
                              color: "var(--color-text-secondary)"
                            }}
                          >
                            {item.summary}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: 关联行业观点与深度解读 (铺满展示) */}
            {activeTab === "opinions" && (
              <div className="opinions-full-container" style={{ width: "100%" }}>
                {associatedOpinions.length === 0 ? (
                  <div style={{ padding: "24px 20px", backgroundColor: "#f8fafc", borderRadius: 6, border: "1px dashed #cbd5e1", textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)" }}>
                      暂无与本专题相关的专家观点文章。
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {associatedOpinions.map((op, opIdx) => (
                      <div
                        key={op.id || opIdx}
                        onClick={() => handleArticleClick(op, associatedOpinions)}
                        className="opinion-full-card"
                        style={{
                          padding: "12px 14px",
                          borderRadius: 6,
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: 4,
                                color: "#4338ca",
                                backgroundColor: "#eef2ff",
                                border: "1px solid #c7d2fe"
                              }}
                            >
                              行业观点
                            </span>
                            <span style={{ fontSize: 11, fontFamily: "var(--font-en, monospace)", color: "var(--color-text-muted)" }}>
                              {formatDate(op.publishedAt)}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                              · {op.source}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                            详情 &rarr;
                          </span>
                        </div>

                        <strong style={{ fontSize: 13.5, lineHeight: 1.4, display: "block", color: "var(--color-text)", marginBottom: 4 }}>
                          {op.title}
                        </strong>

                        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: "#475569" }}>
                          {op.insight || op.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="panel" style={{ padding: 40, textAlign: "center", minHeight: 400 }}>
            <p style={{ color: "var(--color-text-muted)" }}>请选择左侧专题查看AI情报时间线。</p>
          </div>
        )}
      </div>

      {/* 侧边栏详情抽屉 (Slide-over Detail Drawer) */}
      {isDrawerOpen && selectedDrawerArticle && (
        <>
          <div
            className="atomic-intel-drawer-overlay"
            onClick={() => setIsDrawerOpen(false)}
          />

          <aside className="atomic-intel-drawer">
            {/* 抽屉顶部控制栏 */}
            <div className="atomic-intel-drawer__header">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 16, color: 'var(--color-text)', fontWeight: 700 }}>
                    {selectedDrawerArticle.contentNature === 'opinion' ? '行业观点深度档案' : '演进情报深度研判'}
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
                    #{selectedDrawerArticle.id}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  来源: {selectedDrawerArticle.source} · {formatDate(selectedDrawerArticle.timelineDate || selectedDrawerArticle.primaryDate || selectedDrawerArticle.publishedAt)}
                </span>
              </div>

              {/* 右侧控制：前后翻页与关闭 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {drawerList.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      disabled={currentDrawerIndex <= 0}
                      onClick={() => navigateDrawerAdjacent(-1)}
                      style={{
                        background: 'var(--color-surface-strong)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: 11,
                        cursor: currentDrawerIndex <= 0 ? 'not-allowed' : 'pointer',
                        opacity: currentDrawerIndex <= 0 ? 0.4 : 1
                      }}
                      title="快捷键: ↑ 或 k"
                    >
                      上一条
                    </button>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)', padding: '0 4px' }}>
                      {currentDrawerIndex + 1}/{drawerList.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentDrawerIndex >= drawerList.length - 1}
                      onClick={() => navigateDrawerAdjacent(1)}
                      style={{
                        background: 'var(--color-surface-strong)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: 11,
                        cursor: currentDrawerIndex >= drawerList.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: currentDrawerIndex >= drawerList.length - 1 ? 0.4 : 1
                      }}
                      title="快捷键: ↓ 或 j"
                    >
                      下一条
                    </button>
                  </div>
                )}

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
            <div className="atomic-intel-drawer__body" style={{ padding: '20px 24px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 状态徽章条 */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {selectedDrawerArticle.intelligenceType ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #cbd5e1'
                      }}
                    >
                      {selectedDrawerArticle.intelligenceType}
                    </span>
                  ) : null}

                  {selectedDrawerArticle.contentNature === 'opinion' ? (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
                      行业观点
                    </span>
                  ) : selectedDrawerArticle.sourceOrigin === 'direct' ? (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
                      官方直采
                    </span>
                  ) : selectedDrawerArticle.verificationStatus === 'verified' ? (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                      一手源已穿透
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, backgroundColor: '#fefce8', color: '#b45309', border: '1px solid #fef08a' }}>
                      未核实一手源头
                    </span>
                  )}

                  {selectedDrawerArticle.affectedEntity ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: '#f8fafc', color: '#0284c7', border: '1px solid #bae6fd' }}>
                      主体: {selectedDrawerArticle.affectedEntity}
                    </span>
                  ) : null}

                  {selectedDrawerArticle.detailTag ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                      #{selectedDrawerArticle.detailTag}
                    </span>
                  ) : null}

                  {selectedDrawerArticle.severity === '重大' ? (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: '#b91c1c', backgroundColor: '#fee2e2', border: '1px solid #fca5a5' }}>
                      重大关注
                    </span>
                  ) : null}
                </div>

                {/* 标题 */}
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.35, color: 'var(--color-text)' }}>
                  {selectedDrawerArticle.title}
                </h2>

                {/* 核心摘要 */}
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 16px' }}>
                  <strong style={{ fontSize: 12, color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>
                    执行摘要 (Executive Summary)
                  </strong>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#334155' }}>
                    {selectedDrawerArticle.summary}
                  </p>
                </div>

                {/* 战略研判与观点见解 */}
                {(selectedDrawerArticle.insight || selectedDrawerArticle.recommendedAction) ? (
                  <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '12px 16px' }}>
                    <strong style={{ fontSize: 12, color: '#166534', display: 'block', marginBottom: 6 }}>
                      战略研判与执行建议 (Strategic Insights)
                    </strong>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#14532d' }}>
                      {selectedDrawerArticle.insight || selectedDrawerArticle.recommendedAction}
                    </p>
                  </div>
                ) : null}

                {/* 一手源穿透与引用 */}
                {(selectedDrawerArticle.primaryAuthority || selectedDrawerArticle.primaryDocTitle || selectedDrawerArticle.primaryQuote || selectedDrawerArticle.primaryUrl) ? (
                  <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '12px 16px' }}>
                    <strong style={{ fontSize: 12, color: '#0369a1', display: 'block', marginBottom: 6 }}>
                      一手源头穿透溯源
                    </strong>
                    {selectedDrawerArticle.primaryAuthority ? (
                      <div style={{ fontSize: 12.5, color: '#0c4a6e', marginBottom: 4 }}>
                        <strong>权威机构：</strong>{selectedDrawerArticle.primaryAuthority}
                      </div>
                    ) : null}
                    {selectedDrawerArticle.primaryDocTitle ? (
                      <div style={{ fontSize: 12.5, color: '#0c4a6e', marginBottom: 4 }}>
                        <strong>官方文件：</strong>《{selectedDrawerArticle.primaryDocTitle}》
                      </div>
                    ) : null}
                    {selectedDrawerArticle.primaryUrl ? (
                      <div style={{ fontSize: 12.5, color: '#0c4a6e', marginBottom: 4 }}>
                        <strong>官方源头直达：</strong>
                        <a
                          href={selectedDrawerArticle.primaryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#0284c7', textDecoration: 'underline', wordBreak: 'break-all' }}
                        >
                          {selectedDrawerArticle.primaryUrl}
                        </a>
                      </div>
                    ) : null}
                    {selectedDrawerArticle.primaryQuote ? (
                      <div style={{ marginTop: 8, padding: '8px 12px', borderLeft: '3px solid #0284c7', backgroundColor: '#ffffff', fontSize: 12, fontStyle: 'italic', color: '#334155', borderRadius: '0 4px 4px 0' }}>
                        "{selectedDrawerArticle.primaryQuote}"
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* 标签列表 */}
                {selectedDrawerArticle.tags && selectedDrawerArticle.tags.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>关联标签:</span>
                    {selectedDrawerArticle.tags.map((t, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          color: '#475569'
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* 原文链接入口 */}
                {(selectedDrawerArticle.primaryUrl || selectedDrawerArticle.url) ? (
                  <div style={{ paddingTop: 8, borderTop: '1px solid var(--color-border-subtle)' }}>
                    <a
                      href={selectedDrawerArticle.primaryUrl || selectedDrawerArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: 'var(--color-brand)',
                        color: '#ffffff',
                        textDecoration: 'none'
                      }}
                    >
                      访问出处原链 &rarr;
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </>
      )}

      {/* 新建/编辑专题模态框 */}
      <TopicCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleTopicSaved}
        topicToEdit={topicToEdit}
        allArticles={allArticles}
      />
    </section>
  );
}
