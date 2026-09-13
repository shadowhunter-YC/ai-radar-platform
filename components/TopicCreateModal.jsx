"use client";

import { useState, useEffect, useMemo } from "react";
import { matchArticleToTimeline, suggestRuleKeywords } from "@/lib/topic-matcher.mjs";

const CATEGORIES = ["AI 法规动态", "AI 安全产品动态", "事件动态"];

export default function TopicCreateModal({
  isOpen,
  onClose,
  onCreated,
  topicToEdit = null,
  allArticles = []
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("AI 法规动态");
  const [keywordsText, setKeywordsText] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = Boolean(topicToEdit);

  useEffect(() => {
    if (topicToEdit) {
      setTitle(topicToEdit.title || "");
      setCategory(topicToEdit.category || "AI 法规动态");
      const kws = topicToEdit.ruleKeywords || topicToEdit.rule_keywords || [];
      setKeywordsText(Array.isArray(kws) ? kws.join("\n") : String(kws));
      setSummary(topicToEdit.summary || "");
    } else {
      setTitle("");
      setCategory("AI 法规动态");
      setKeywordsText("");
      setSummary("");
    }
    setError("");
  }, [topicToEdit, isOpen]);

  // 根据当前输入的标题智能推荐关键词
  const smartSuggestions = useMemo(() => {
    if (!title.trim()) return [];
    return suggestRuleKeywords(title, category);
  }, [title, category]);

  // 客户端毫秒级实时预估匹配命中数
  const estimatedMatches = useMemo(() => {
    if (!allArticles || allArticles.length === 0) return null;
    const ruleKeywords = keywordsText
      .split(/[\n,，]/)
      .map(k => k.trim())
      .filter(Boolean);
    const mockTopic = { category, ruleKeywords };
    return allArticles.filter(a => matchArticleToTimeline(a, mockTopic)).length;
  }, [allArticles, category, keywordsText]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError("请输入专题名称");
      return;
    }

    setLoading(true);
    setError("");

    // 将用户输入的逗号或换行分隔的关键词解析为数组；若为空则尝试自动填充建议
    let ruleKeywords = keywordsText
      .split(/[\n,，]/)
      .map(k => k.trim())
      .filter(Boolean);

    if (ruleKeywords.length === 0 && smartSuggestions.length > 0) {
      ruleKeywords = smartSuggestions;
    }

    try {
      const url = "/api/topics";
      const method = isEdit ? "PUT" : "POST";
      const payload = isEdit
        ? { id: topicToEdit.id, title: title.trim(), category, ruleKeywords, summary: summary.trim() }
        : { title: title.trim(), category, ruleKeywords, summary: summary.trim() };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (isEdit ? "更新专题失败" : "创建专题失败"));
      }

      onCreated(data.topic);
      onClose();
    } catch (err) {
      setError(err.message || "提交专题出现异常");
    } finally {
      setLoading(false);
    }
  }

  function handleApplySuggestion(sug) {
    setKeywordsText(prev => {
      const lines = prev.split("\n").map(l => l.trim()).filter(Boolean);
      if (!lines.includes(sug)) lines.push(sug);
      return lines.join("\n");
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {isEdit ? (topicToEdit?.isPreset ? "编辑标杆专题规则" : "编辑关注专题规则") : "新建AI情报专题"}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
              {isEdit && topicToEdit?.isPreset
                ? "自定义修改该系统标杆专题的抽取关键词规则与研判，变更将即时更新时间线。"
                : "定义专题分类与抽取关键词规则，系统将自动汇聚历史与新增文章形成时间线。"}
            </p>
          </div>
          <button className="button button--subtle" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
          {error ? (
            <div className="alert-box alert-box--danger" style={{ fontSize: 12, padding: "8px 12px" }}>
              {error}
            </div>
          ) : null}

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              专题分类（严格三选一）
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 4,
                border: "1px solid var(--color-border)",
                background: "#fff",
                fontSize: 13
              }}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              专题名称
            </label>
            <input
              type="text"
              placeholder="例如：openAI 模型动态、中国生成式大模型备案进展"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 4,
                border: "1px solid var(--color-border)",
                fontSize: 13
              }}
              required
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                匹配关键词规则（多条件过滤）
              </label>
              {smartSuggestions.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setKeywordsText(smartSuggestions.join("\n"))}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-brand)",
                    fontSize: 11,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline"
                  }}
                >
                  智能填入: {smartSuggestions.join(" & ")}
                </button>
              ) : null}
            </div>
            <p style={{ margin: "0 0 6px", fontSize: 11, color: "var(--color-text-muted)" }}>
              每行一个条件组（各组为 AND 关系）；组内用竖线 | 表示同义词（OR 关系）。
            </p>
            <textarea
              rows={3}
              placeholder={"例如：\nOpenAI|ChatGPT|GPT|o1\n模型|沙箱|安全"}
              value={keywordsText}
              onChange={e => setKeywordsText(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 4,
                border: "1px solid var(--color-border)",
                fontSize: 12,
                fontFamily: "monospace"
              }}
            />

            {/* 智能建议徽章 */}
            {smartSuggestions.length > 0 && !keywordsText.includes(smartSuggestions[0]) ? (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>推荐关键词:</span>
                {smartSuggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplySuggestion(sug)}
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      backgroundColor: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      cursor: "pointer",
                      color: "#334155"
                    }}
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            ) : null}

            {/* 实时命中预估提示 */}
            {estimatedMatches !== null ? (
              <div style={{ marginTop: 8, fontSize: 11.5 }}>
                {estimatedMatches > 0 ? (
                  <span style={{ color: "#15803d", fontWeight: 600 }}>
                    匹配预测: 预计命中 {estimatedMatches} 个客观历史/最新里程碑
                  </span>
                ) : (
                  <span style={{ color: "#b91c1c", fontWeight: 600 }}>
                    匹配预测: 预计命中 0 个里程碑（规则过窄或库内暂无该关键词，建议点击上方推荐词或减少过滤条件）
                  </span>
                )}
              </div>
            ) : null}
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              专题概述（可选）
            </label>
            <textarea
              rows={2}
              placeholder="输入本专题的研究目标或核心监管关切点..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 4,
                border: "1px solid var(--color-border)",
                fontSize: 12
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              className="button button--subtle"
              onClick={onClose}
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="button button--primary"
              disabled={loading}
            >
              {loading ? "保存并计算中..." : isEdit ? "保存规则更改" : "确认创建专题"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
