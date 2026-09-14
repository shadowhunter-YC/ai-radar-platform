"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_MORNING_PREFERENCES,
  filterReportArticles,
  readSSE,
  safeSourceUrl,
  reportModeLabel
} from '@/lib/daily-report.mjs';
import { CANONICAL_TAGS } from '@/lib/tag-taxonomy.mjs';

const STORAGE_HISTORY = 'radar.morning.history.v1';
const STORAGE_PREFS = 'radar.morning.preferences.v1';

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function getStoredHistory() {
  const value = readStorage(STORAGE_HISTORY, []);
  return Array.isArray(value)
    ? value.filter(r => typeof r?.content === 'string' && r.createdAt).slice(0, 50)
    : [];
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('morning-reports-change'));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

function dateLabel(value) {
  if (!value) return '未知时间';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return String(value);
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function dateOnly(value) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function getShanghaiDateStr(value = new Date()) {
  try {
    const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;
    if (!Number.isFinite(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  } catch {
    return new Date(value).toISOString().slice(0, 10);
  }
}

function parseRichInline(text) {
  if (!text) return null;
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|\[\d+\])/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={key++} style={{ color: 'var(--color-text, #111827)', fontWeight: 700 }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (/^\[\d+\]$/.test(token)) {
      parts.push(
        <span
          key={key++}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1px 5px',
            margin: '0 2px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--color-brand-strong, #86bc25)',
            background: 'rgba(134, 188, 37, 0.12)',
            border: '1px solid rgba(134, 188, 37, 0.35)',
            borderRadius: '3px',
            verticalAlign: 'baseline',
            lineHeight: 1.2
          }}
          title="引用参考资讯"
        >
          {token}
        </span>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length ? parts : text;
}

function FormattedMorningReport({ content }) {
  if (!content) return null;
  const lines = content.split('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: '100%', lineHeight: 1.85, fontSize: 14 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} style={{ height: 6 }} />;
        }

        // 一级大标题
        if (/^#\s+/.test(trimmed)) {
          return (
            <div
              key={idx}
              style={{
                marginTop: idx === 0 ? 0 : 20,
                marginBottom: 10,
                paddingBottom: 10,
                borderBottom: '2px solid var(--color-border)'
              }}
            >
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
                {trimmed.replace(/^#\s+/, '')}
              </h1>
            </div>
          );
        }

        // 二级结构化板块标题
        const isHeader = /^(#{2,4}\s+|[一二三四五六七八九十]、)/.test(trimmed);
        if (isHeader) {
          const cleanTitle = trimmed.replace(/^#{2,4}\s+/, '');
          const isSummary = cleanTitle.includes('晨报') || cleanTitle.includes('速览') || cleanTitle.includes('Executive');
          const isBlogger = cleanTitle.includes('博主') || cleanTitle.includes('领袖') || cleanTitle.includes('专家') || cleanTitle.includes('Influencer');
          const isLegislation = cleanTitle.includes('法案') || cleanTitle.includes('监管') || cleanTitle.includes('标准') || cleanTitle.includes('Legislation');
          const isProduct = cleanTitle.includes('产品') || cleanTitle.includes('突破') || cleanTitle.includes('技术') || cleanTitle.includes('Security');
          const isAction = cleanTitle.includes('建议') || cleanTitle.includes('自查') || cleanTitle.includes('行动') || cleanTitle.includes('Checklist');
          const isQuotes = cleanTitle.includes('引用素材') || cleanTitle.includes('信源');

          const borderColor = isSummary ? '#0284c7' :
                              isBlogger ? '#6366f1' :
                              isLegislation ? '#9333ea' :
                              isProduct ? '#86bc25' :
                              isAction ? '#d97706' :
                              isQuotes ? '#64748b' : 'var(--color-brand)';

          const bg = isSummary ? 'rgba(2,132,199,0.06)' :
                     isBlogger ? 'rgba(99,102,241,0.06)' :
                     isLegislation ? 'rgba(147,51,234,0.06)' :
                     isProduct ? 'rgba(134,188,37,0.08)' :
                     isAction ? 'rgba(217,119,6,0.06)' :
                     isQuotes ? 'rgba(100,116,139,0.06)' : 'var(--color-surface-strong)';

          return (
            <div
              key={idx}
              style={{
                marginTop: idx === 0 ? 0 : 18,
                marginBottom: 6,
                padding: '10px 14px',
                background: bg,
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: '0 6px 6px 0'
              }}
            >
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.01em' }}>
                {cleanTitle}
              </h2>
            </div>
          );
        }

        // 列表要点（包括博主动态单独成行列表）
        const isBullet = /^[-*•]\s+|^\d+\.\s+/.test(trimmed);
        if (isBullet) {
          const bulletText = trimmed.replace(/^[-*•]\s+|^\d+\.\s+/, '');
          return (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingLeft: 4, color: 'var(--color-text)' }}>
              <span style={{ color: 'var(--color-brand-strong, #86bc25)', lineHeight: 1.8, fontSize: 12 }}>●</span>
              <div style={{ flex: 1 }}>{parseRichInline(bulletText)}</div>
            </div>
          );
        }

        // 无动态说明特殊提示单行（仅在非列表且独立成行时展示为提示条）
        if (trimmed.includes('暂无公开新动态') || trimmed.includes('暂无新发布') || trimmed.includes('暂无新增')) {
          return (
            <div
              key={idx}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: 4,
                fontSize: 12.5,
                color: '#64748b',
                fontStyle: 'italic',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#94a3b8' }} />
              <span>{trimmed}</span>
            </div>
          );
        }

        // 普通正文段落
        return (
          <p key={idx} style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.85 }}>
            {parseRichInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

const PRESET_LEGISLATION = [
  'EU AI Act', 'TC260', '生成式人工智能暂行办法', 'ISO 42001',
  'NIST AI RMF', '加州SB 1047', '网络安全法', '数据安全法', '算法备案'
];

// 每日AI早报独立工作台与面板
export function MorningCockpitSection({
  articles = [],
  sources = [],
  initialReports = [],
  initialPreferences = null,
  mode = 'auto'
}) {
  const [savedReports, setSavedReports] = useState(() => {
    if (Array.isArray(initialReports) && initialReports.length) return initialReports;
    return getStoredHistory();
  });
  const [prefs, setPrefs] = useState(() => ({
    ...DEFAULT_MORNING_PREFERENCES,
    ...(initialPreferences || {}),
    ...readStorage(STORAGE_PREFS, {})
  }));
  const [allSources, setAllSources] = useState(sources || []);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // 抽屉内部编辑状态
  const [drawerPrefs, setDrawerPrefs] = useState(prefs);
  const [newLegislationInput, setNewLegislationInput] = useState('');
  const [drawerNotice, setDrawerNotice] = useState('');

  const controller = useRef(null);
  const dateDropdownRef = useRef(null);

  // 获取北京时间当前日期 YYYY-MM-DD
  const todayStr = useMemo(() => getShanghaiDateStr(new Date()), []);

  // 同步历史记录与偏好
  const sync = () => {
    const local = getStoredHistory();
    if (local.length) {
      setSavedReports(local);
    }
    const localPrefs = readStorage(STORAGE_PREFS, null);
    if (localPrefs) {
      setPrefs(p => ({ ...p, ...localPrefs }));
    }
  };

  useEffect(() => {
    sync();
    fetch('/api/reports')
      .then(r => r.json())
      .then(c => {
        if (Array.isArray(c.reports) && c.reports.length) {
          setSavedReports(c.reports);
          saveStorage(STORAGE_HISTORY, c.reports);
        }
        if (c.preferences) {
          setPrefs(p => ({ ...p, ...c.preferences, ...readStorage(STORAGE_PREFS, {}) }));
        }
      })
      .catch(() => {});

    fetch('/api/sources')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.sources)) {
          setAllSources(data.sources);
        }
      })
      .catch(() => {});

    window.addEventListener('storage', sync);
    window.addEventListener('morning-reports-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('morning-reports-change', sync);
      controller.current?.abort();
    };
  }, []);

  // 提取当前已订阅的博主列表
  const subscribedBloggers = useMemo(() => {
    const list = [];
    const seen = new Set();
    const sourcePool = [...(allSources || []), ...(sources || [])];

    for (const s of sourcePool) {
      if (!s) continue;
      const name = (s.name || '').trim();
      const url = (s.url || '').trim();
      const desc = (s.description || s.notes || '').trim();
      const type = (s.type || s.sourceType || '').trim();

      const isBlogger =
        url.includes('/twitter/user/') ||
        url.includes('/x/user/') ||
        url.includes('twstalker.com') ||
        url.includes('twitter.com') ||
        url.includes('x.com') ||
        type === 'X博主' ||
        type === '博主/社交媒体' ||
        desc.includes('博主') ||
        desc.includes('推文') ||
        desc.includes('个人 X') ||
        desc.includes('个人X') ||
        name.startsWith('@') ||
        name.includes('(@');

      if (isBlogger && name && !seen.has(name)) {
        seen.add(name);
        const handleMatch = name.match(/@([\w_]+)/) || url.match(/twitter\/user\/([\w_]+)/);
        list.push({
          id: s.id,
          name,
          handle: handleMatch ? handleMatch[1] : '',
          url,
          description: desc
        });
      }
    }
    return list;
  }, [allSources, sources]);

  const isBloggerSelected = (bName) => {
    const list = drawerPrefs.trackedBloggers || [];
    const cleanB = bName.replace(/\s*\(@[\w_]+\)/, '').trim().toLowerCase();
    return list.some(tb => {
      if (tb === bName) return true;
      const cleanTb = tb.replace(/\s*\(@[\w_]+\)/, '').trim().toLowerCase();
      return cleanTb === cleanB || bName.toLowerCase().includes(cleanTb) || tb.toLowerCase().includes(cleanB);
    });
  };

  const toggleBloggerSelection = (bName) => {
    setDrawerPrefs(p => {
      const current = p.trackedBloggers || [];
      const isSelected = isBloggerSelected(bName);
      if (isSelected) {
        const cleanB = bName.replace(/\s*\(@[\w_]+\)/, '').trim().toLowerCase();
        return {
          ...p,
          trackedBloggers: current.filter(tb => {
            if (tb === bName) return false;
            const cleanTb = tb.replace(/\s*\(@[\w_]+\)/, '').trim().toLowerCase();
            return cleanTb !== cleanB && !bName.toLowerCase().includes(cleanTb) && !tb.toLowerCase().includes(cleanB);
          })
        };
      } else {
        return {
          ...p,
          trackedBloggers: [...current, bName]
        };
      }
    });
  };

  // 当打开偏好配置抽屉时，将当前 prefs 拷贝入 drawerPrefs
  useEffect(() => {
    if (isConfigDrawerOpen) {
      setDrawerPrefs(prefs);
      setDrawerNotice('');
      setNewLegislationInput('');
    }
  }, [isConfigDrawerOpen, prefs]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(e) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target)) {
        setIsDateDropdownOpen(false);
      }
    }
    if (isDateDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDateDropdownOpen]);

  // ESC 键关闭抽屉与下拉
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsDateDropdownOpen(false);
        setIsConfigDrawerOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 查找当天的早报（北京时间）
  const todayReport = useMemo(() => {
    return savedReports.find(r => r?.createdAt && getShanghaiDateStr(new Date(r.createdAt)) === todayStr);
  }, [savedReports, todayStr]);

  // 当前激活展示的早报：若用户显式选择了历史早报则展示该历史早报，否则默认仅展示当天早报
  const activeReport = useMemo(() => {
    if (selectedReportId) {
      const found = savedReports.find(r => String(r.id) === String(selectedReportId));
      if (found) return found;
    }
    return todayReport || null;
  }, [selectedReportId, savedReports, todayReport]);

  const activeReportDate = activeReport ? getShanghaiDateStr(new Date(activeReport.createdAt)) : '';
  const isShowingToday = !selectedReportId || (activeReport && activeReportDate === todayStr);

  // 匹配资讯
  const matchedArticles = useMemo(() => filterReportArticles(articles, prefs), [articles, prefs]);

  // 复制早报全文
  function handleCopy() {
    if (!activeReport?.content) return;
    navigator.clipboard.writeText(activeReport.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // 导出早报 Markdown
  function handleDownload() {
    if (!activeReport?.content) return;
    const blob = new Blob([activeReport.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI安全与合规早报_${activeReportDate || todayStr}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 调用生成早报（带指定偏好）
  async function generateWithPreferences(targetPrefs) {
    if (generating) return;
    const matches = filterReportArticles(articles, targetPrefs).slice(0, targetPrefs.limit || 20);
    if (!matches.length) {
      setError('当前偏好下暂无匹配资讯，请在偏好设置中放宽时间范围或关注标签。');
      return;
    }

    setGenerating(true);
    setError('');
    setStatus('大模型正在根据偏好加权研判最新情报并生成结构化早报…');
    setDraft('');
    controller.current?.abort();
    controller.current = new AbortController();

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleIds: matches.map(a => a.id),
          mode: mode || 'auto',
          preferences: targetPrefs
        }),
        signal: controller.current.signal
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || '生成失败，请检查大模型配置与网络连接');
      }

      let content = '';
      for await (const line of readSSE(res.body)) {
        if (!line) continue;
        const chunk = JSON.parse(line);
        if (chunk.type === 'delta') {
          content += chunk.text || '';
          setDraft(content);
          continue;
        }
        if (chunk.type === 'complete') {
          const record = {
            id: chunk.id || Date.now(),
            createdAt: chunk.createdAt || new Date().toISOString(),
            title: `每日AI安全与合规早报 (${todayStr})`,
            content,
            sources: chunk.sources || [],
            mode: chunk.mode || 'auto',
            model: chunk.model,
            preferences: targetPrefs
          };
          const all = getStoredHistory().filter(r => String(r.id) !== String(record.id));
          const updated = [record, ...all].slice(0, 50);
          saveStorage(STORAGE_HISTORY, updated);
          setSavedReports(updated);
          setSelectedReportId(record.id);
          setDraft('');
          setStatus('今日AI早报已成功生成并持久化。');
          setTimeout(() => setStatus(''), 4000);
        }
        if (chunk.type === 'error') throw new Error(chunk.error);
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        setStatus('已取消生成');
      } else {
        setError(e.message);
      }
    } finally {
      setGenerating(false);
      controller.current = null;
    }
  }

  // 保存抽屉中的偏好
  async function handleSaveDrawerPrefs() {
    setPrefs(drawerPrefs);
    saveStorage(STORAGE_PREFS, drawerPrefs);
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_preferences', preferences: drawerPrefs })
      });
      setDrawerNotice('早报偏好已成功保存至服务器与本地。');
      setTimeout(() => {
        setDrawerNotice('');
        setIsConfigDrawerOpen(false);
      }, 700);
    } catch {
      setDrawerNotice('早报偏好已保存在本地。');
      setTimeout(() => {
        setDrawerNotice('');
        setIsConfigDrawerOpen(false);
      }, 700);
    }
  }

  // 保存并立即生成今日早报
  async function handleSaveAndGenerate() {
    setPrefs(drawerPrefs);
    saveStorage(STORAGE_PREFS, drawerPrefs);
    fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_preferences', preferences: drawerPrefs })
    }).catch(() => {});
    setIsConfigDrawerOpen(false);
    generateWithPreferences(drawerPrefs);
  }

  const bloggersCount = prefs.trackedBloggers?.length || 0;
  const legislationCount = prefs.trackedLegislation?.length || 0;

  return (
    <section id="morning-report" className="panel morning-cockpit-panel" style={{ width: '100%', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 顶部工具栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          paddingBottom: 16,
          borderBottom: '1px solid var(--color-border)'
        }}
      >
        {/* 左侧：标题与状态徽章 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: 'var(--color-brand-strong, #86bc25)',
                display: 'inline-block'
              }}
            />
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
              每日AI早报
            </h2>
          </div>

          {/* 日期状态标签 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeReport ? (
              <span className={isShowingToday ? 'badge badge--success' : 'badge badge--neutral'} style={{ fontSize: 12 }}>
                {isShowingToday ? `今日早报 · ${activeReportDate}` : `历史早报 · ${activeReportDate}`}
              </span>
            ) : (
              <span className="badge badge--warning" style={{ fontSize: 12 }}>
                今日早报待生成 · {todayStr}
              </span>
            )}

            {!isShowingToday && todayReport && (
              <button
                type="button"
                className="button button--secondary button--sm"
                onClick={() => setSelectedReportId(null)}
                style={{ fontSize: 11, padding: '2px 8px', height: 24 }}
              >
                返回今日早报
              </button>
            )}
          </div>

          {/* 偏好追踪概览 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
            <span>已配置:</span>
            <span className="badge badge--neutral" style={{ fontSize: 11 }}>
              博主 {bloggersCount} 位
            </span>
            <span className="badge badge--neutral" style={{ fontSize: 11 }}>
              法规 {legislationCount} 项
            </span>
          </div>
        </div>

        {/* 右侧：动作按钮组 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* 筛选不同时间早报按钮 */}
          <div style={{ position: 'relative' }} ref={dateDropdownRef}>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setIsDateDropdownOpen(prev => !prev)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>筛选早报时间</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
            </button>

            {/* 日期下拉选择面板 */}
            {isDateDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  minWidth: 260,
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: 6,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                  zIndex: 1100,
                  padding: '6px 0',
                  maxHeight: 320,
                  overflowY: 'auto'
                }}
              >
                <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                  往期早报记录 ({savedReports.length} 份)
                </div>

                {savedReports.length === 0 ? (
                  <div style={{ padding: '12px', fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                    暂无保存的早报记录
                  </div>
                ) : (
                  savedReports.map((r) => {
                    const rDate = getShanghaiDateStr(new Date(r.createdAt));
                    const isToday = rDate === todayStr;
                    const isCurrent = (activeReport && activeReport.id === r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedReportId(r.id);
                          setIsDateDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          background: isCurrent ? 'rgba(134,188,37,0.1)' : 'transparent',
                          color: isCurrent ? 'var(--color-brand-strong)' : 'var(--color-text)',
                          fontSize: 12.5,
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = '#f1f5f9'; }}
                        onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ fontWeight: isCurrent ? 700 : 500 }}>
                            {rDate} {isToday ? '(今日早报)' : '历史早报'}
                          </div>
                        </div>
                        {isCurrent && <span style={{ fontSize: 12, fontWeight: 700 }}>✓</span>}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* 配置按钮（点击弹出侧边栏抽屉） */}
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setIsConfigDrawerOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span>早报偏好配置</span>
          </button>

          {/* 复制 & 导出（仅在有早报时可见） */}
          {activeReport && (
            <>
              <button
                type="button"
                className="button button--secondary button--sm"
                onClick={handleCopy}
                style={{ fontSize: 12 }}
              >
                {copied ? '已复制' : '复制全文'}
              </button>
              <button
                type="button"
                className="button button--secondary button--sm"
                onClick={handleDownload}
                style={{ fontSize: 12 }}
              >
                导出 Markdown
              </button>
            </>
          )}

          {/* 一键生成今日AI早报 */}
          <button
            className="button button--primary"
            type="button"
            disabled={generating}
            onClick={() => generateWithPreferences(prefs)}
            style={{ fontSize: 13 }}
          >
            {generating ? '正在生成今日AI早报…' : (todayReport ? '重新生成今日早报' : '一键生成今日AI早报')}
          </button>
        </div>
      </div>

      {/* 提示或报错条 */}
      {status && <p role="status" style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: 0 }}>{status}</p>}
      {error && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #f87171', borderRadius: 4, color: '#b91c1c', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} style={{ border: 'none', background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* 早报主体展示区：流式生成中 | 结构化正文 | 未生成提示 */}
      {generating || draft ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="badge badge--info">流式研判中…</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>大模型正在逐行撰写今日AI早报结构化板块</span>
          </div>
          <FormattedMorningReport content={draft || '已聚合最新合规情报素材，正在等待模型首字输出…'} />
        </div>
      ) : activeReport ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 结构化早报正文 */}
          <FormattedMorningReport content={activeReport.content} />
        </div>
      ) : (
        /* 当天未生成早报时的引导卡片 */
        <div
          style={{
            textAlign: 'center',
            padding: '48px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            alignItems: 'center',
            backgroundColor: '#fafaf9',
            border: '1px dashed var(--color-border)',
            borderRadius: 6
          }}
        >
          <h3 style={{ fontSize: 18, margin: 0, color: 'var(--color-text)', fontWeight: 700 }}>
            今日 AI 早报尚未生成
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13.5, margin: 0, maxWidth: 580, lineHeight: 1.7 }}>
            系统已监控 24 小时内全球主要法域 AI 监管态势、前沿专家观点与安全技术突破。基于您设定的博主与法案偏好，一键调用大模型提炼今日深度早报。
          </p>

          {/* 偏好就绪指标卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, width: '100%', maxWidth: 620, margin: '8px 0' }}>
            <div style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 6, textAlign: 'left' }}>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>待研判合规情报</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginTop: 2 }}>
                {matchedArticles.length} 篇
              </div>
            </div>
            <div style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 6, textAlign: 'left' }}>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>重点监控博主</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#4338ca', marginTop: 2 }}>
                {bloggersCount} 位 ({prefs.trackedBloggers?.slice(0, 2).join('、') || '未设定'}…)
              </div>
            </div>
            <div style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 6, textAlign: 'left' }}>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>重点追踪法规</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#7e22ce', marginTop: 2 }}>
                {legislationCount} 项 ({prefs.trackedLegislation?.slice(0, 2).join('、') || '未设定'}…)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              className="button button--primary"
              type="button"
              onClick={() => generateWithPreferences(prefs)}
              disabled={generating}
            >
              {generating ? '正在生成今日早报…' : '一键生成今日AI早报'}
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setIsConfigDrawerOpen(true)}
            >
              配置关注偏好
            </button>
            {savedReports.length > 0 && (
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setSelectedReportId(savedReports[0].id)}
              >
                查看最近一期历史早报 ({getShanghaiDateStr(new Date(savedReports[0].createdAt))})
              </button>
            )}
          </div>
        </div>
      )}

      {/* 偏好配置侧边栏抽屉 (Slide-over Drawer) */}
      {isConfigDrawerOpen && (
        <>
          <div
            className="atomic-intel-drawer-overlay"
            onClick={() => setIsConfigDrawerOpen(false)}
          />
          <aside className="atomic-intel-drawer" style={{ width: 560, maxWidth: '92vw', display: 'flex', flexDirection: 'column' }}>
            {/* 抽屉头部 */}
            <div className="atomic-intel-drawer__header">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 16, color: 'var(--color-text)', fontWeight: 700 }}>
                    早报偏好配置
                  </strong>
                  <span className="badge badge--info" style={{ fontSize: 11 }}>个人定制</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  配置重点关注博主、追踪法规与情报标签，系统将依此定制每日AI早报
                </span>
              </div>
              <button
                className="button button--secondary button--sm"
                type="button"
                onClick={() => setIsConfigDrawerOpen(false)}
                style={{ minWidth: 32, padding: '4px 8px', fontSize: 16, lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* 抽屉表单主体 */}
            <div className="atomic-intel-drawer__body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {drawerNotice && (
                <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 4, color: '#166534', fontSize: 12.5 }}>
                  {drawerNotice}
                </div>
              )}

              {/* 1. 重点关注博主 (仅显示已订阅博主，支持勾选) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>
                    重点关注博主 (已订阅博主列表)
                  </strong>
                  <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                    已勾选 {drawerPrefs.trackedBloggers?.length || 0} 位
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  早报将专属列出勾选博主的最新动态；即使今日新增资讯为 0，也会明确显示为 0 条。仅支持勾选已订阅的博主。
                </p>

                {/* 订阅博主列表（多选框） */}
                {subscribedBloggers.length === 0 ? (
                  <div style={{ padding: '14px', background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    暂无已订阅的 Twitter/X 博主。请前往「资讯源配置」添加博主订阅后再来勾选。
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                    {subscribedBloggers.map(b => {
                      const checked = isBloggerSelected(b.name);
                      return (
                        <label
                          key={b.id || b.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '8px 12px',
                            background: checked ? 'rgba(134,188,37,0.08)' : 'var(--color-surface)',
                            border: `1px solid ${checked ? 'var(--color-brand-strong)' : 'var(--color-border)'}`,
                            borderRadius: 6,
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBloggerSelection(b.name)}
                            style={{ accentColor: 'var(--color-brand-strong)', width: 16, height: 16, cursor: 'pointer', margin: 0 }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: 'var(--color-text)' }}>
                                {b.name}
                              </span>
                              {b.handle && (
                                <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                                  @{b.handle}
                                </span>
                              )}
                            </div>
                            {b.description && (
                              <span style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {b.description}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. 重点追踪立法/规范与法案 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>
                    重点追踪法案 / 规范标准 (Tracked Legislation & Standards)
                  </strong>
                  <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                    已选 {drawerPrefs.trackedLegislation?.length || 0} 项
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  大模型将优先梳理下列法案或标准的落地动态、执法通报与合规细则。
                </p>

                {/* 已选法规标签 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 32, padding: 8, background: '#f8fafc', border: '1px solid var(--color-border)', borderRadius: 4 }}>
                  {(drawerPrefs.trackedLegislation || []).length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>未添加关注法规</span>
                  ) : (
                    drawerPrefs.trackedLegislation.map(l => (
                      <span
                        key={l}
                        className="badge"
                        style={{
                          background: 'rgba(147,51,234,0.12)',
                          color: '#7e22ce',
                          border: '1px solid rgba(147,51,234,0.25)',
                          fontSize: 12,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 8px'
                        }}
                      >
                        {l}
                        <button
                          type="button"
                          onClick={() => setDrawerPrefs(p => ({ ...p, trackedLegislation: (p.trackedLegislation || []).filter(x => x !== l) }))}
                          style={{ border: 'none', background: 'transparent', color: '#9333ea', cursor: 'pointer', padding: 0, fontWeight: 700, fontSize: 13, lineHeight: 1 }}
                          title="移除"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* 输入框添加 */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    type="text"
                    placeholder="输入法规或标准名称（如 ISO 42001、TC260）"
                    value={newLegislationInput}
                    onChange={(e) => setNewLegislationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = newLegislationInput.trim();
                        if (val && !drawerPrefs.trackedLegislation?.includes(val)) {
                          setDrawerPrefs(p => ({ ...p, trackedLegislation: [...(p.trackedLegislation || []), val] }));
                          setNewLegislationInput('');
                        }
                      }
                    }}
                    style={{ flex: 1, fontSize: 12.5 }}
                  />
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => {
                      const val = newLegislationInput.trim();
                      if (val && !drawerPrefs.trackedLegislation?.includes(val)) {
                        setDrawerPrefs(p => ({ ...p, trackedLegislation: [...(p.trackedLegislation || []), val] }));
                        setNewLegislationInput('');
                      }
                    }}
                    style={{ fontSize: 12 }}
                  >
                    添加
                  </button>
                </div>

                {/* 推荐预置法规快捷点击 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>快速添加:</span>
                  {PRESET_LEGISLATION.map(law => {
                    const exists = drawerPrefs.trackedLegislation?.includes(law);
                    return (
                      <button
                        key={law}
                        type="button"
                        onClick={() => {
                          if (!exists) {
                            setDrawerPrefs(p => ({ ...p, trackedLegislation: [...(p.trackedLegislation || []), law] }));
                          }
                        }}
                        style={{
                          fontSize: 11,
                          padding: '2px 6px',
                          border: '1px dashed var(--color-border)',
                          borderRadius: 3,
                          background: exists ? '#e2e8f0' : '#ffffff',
                          color: exists ? '#94a3b8' : 'var(--color-text)',
                          cursor: exists ? 'default' : 'pointer'
                        }}
                        disabled={exists}
                      >
                        {exists ? `✓ ${law}` : `+ ${law}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. 关注情报分类标签 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>
                  关注情报细分领域 (Focus Tags)
                </strong>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                  点击切换希望优先关注的情报分类（高亮为已选）
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CANONICAL_TAGS.map(tag => {
                    const isSelected = (drawerPrefs.tags || []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const curr = drawerPrefs.tags || [];
                          const updated = curr.includes(tag) ? curr.filter(t => t !== tag) : [...curr, tag];
                          setDrawerPrefs(p => ({ ...p, tags: updated }));
                        }}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          borderRadius: 4,
                          border: isSelected ? '1px solid var(--color-brand-strong)' : '1px solid var(--color-border)',
                          backgroundColor: isSelected ? 'rgba(134,188,37,0.12)' : '#ffffff',
                          color: isSelected ? 'var(--color-brand-strong)' : 'var(--color-text)',
                          fontWeight: isSelected ? 600 : 400,
                          cursor: 'pointer'
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. 时间跨度与篇数限制 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>素材时间范围</strong>
                  <select
                    className="input"
                    value={drawerPrefs.period || '24h'}
                    onChange={(e) => setDrawerPrefs(p => ({ ...p, period: e.target.value }))}
                    style={{ fontSize: 12.5 }}
                  >
                    <option value="24h">过去 24 小时 (推荐)</option>
                    <option value="48h">过去 48 小时</option>
                    <option value="3d">过去 3 天</option>
                    <option value="7d">过去 7 天</option>
                    <option value="all">全部时间跨度</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>核心素材篇数</strong>
                  <select
                    className="input"
                    value={drawerPrefs.limit || 20}
                    onChange={(e) => setDrawerPrefs(p => ({ ...p, limit: Number(e.target.value) }))}
                    style={{ fontSize: 12.5 }}
                  >
                    <option value={10}>10 篇 (精简速读)</option>
                    <option value={15}>15 篇 (均衡研判)</option>
                    <option value={20}>20 篇 (全面覆盖)</option>
                    <option value={30}>30 篇 (深度长文)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 抽屉底部操作栏 */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setIsConfigDrawerOpen(false)}
              >
                关闭
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={handleSaveDrawerPrefs}
                >
                  保存配置
                </button>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={generating}
                  onClick={handleSaveAndGenerate}
                >
                  {generating ? '生成中…' : '保存并生成今日早报'}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </section>
  );
}

// 保持向后兼容别名导出
export const LatestMorningBrief = MorningCockpitSection;
// 默认导出：每日AI早报统一使用全新结构化面板
export default function MorningReport(props) {
  return <MorningCockpitSection {...props} />;
}
