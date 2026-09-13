"use client";

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_PREFERENCES, filterReportArticles, readSSE, safeSourceUrl, reportModeLabel } from '@/lib/daily-report.mjs';
import { CANONICAL_TAGS } from '@/lib/tag-taxonomy.mjs';

const HISTORY = 'radar.daily.history.v1', PREFS = 'radar.daily.preferences.v1';
function read(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; }
}
function history() { const value = read(HISTORY, []); return Array.isArray(value) ? value.filter(r => typeof r?.content === 'string' && Array.isArray(r.sources) && r.createdAt).slice(0, 20) : []; }
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event('daily-reports-change')); }
function dateLabel(value) { return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }); }

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
        <strong key={key++} style={{ color: '#fff', fontWeight: 600 }}>
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
            color: '#86bc25',
            background: 'rgba(134, 188, 37, 0.14)',
            border: '1px solid rgba(134, 188, 37, 0.35)',
            borderRadius: '4px',
            verticalAlign: 'baseline',
            lineHeight: 1.2
          }}
          title="引用新闻素材"
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

function FormattedReport({ content }) {
  if (!content) return null;
  const lines = content.split('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: '80ch', lineHeight: 1.85, fontSize: 14 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} style={{ height: 6 }} />;
        }

        const isHeader = /^(#{1,4}\s+|[一二三四五六七八九十]、)/.test(trimmed);
        if (isHeader) {
          const cleanTitle = trimmed.replace(/^#{1,4}\s+/, '');
          const isReg = cleanTitle.includes('法规') || cleanTitle.includes('监管') || cleanTitle.includes('标准');
          const isProd = cleanTitle.includes('产品') || cleanTitle.includes('突破') || cleanTitle.includes('工具');
          const isIncident = cleanTitle.includes('事件') || cleanTitle.includes('处罚') || cleanTitle.includes('警示');
          const isAction = cleanTitle.includes('自查') || cleanTitle.includes('建议') || cleanTitle.includes('行动');
          const isQuotes = cleanTitle.includes('引用素材');

          const borderColor = isReg ? '#a855f7' : isProd ? '#86bc25' : isIncident ? '#ef4444' : isAction ? '#f59e0b' : isQuotes ? '#38bdf8' : 'var(--color-brand)';
          const bg = isReg ? 'rgba(168,85,247,0.08)' : isProd ? 'rgba(134,188,37,0.1)' : isIncident ? 'rgba(239,68,68,0.08)' : isAction ? 'rgba(245,158,11,0.08)' : isQuotes ? 'rgba(56,189,248,0.08)' : 'var(--color-surface-strong)';

          return (
            <div
              key={idx}
              style={{
                marginTop: idx === 0 ? 0 : 14,
                marginBottom: 6,
                padding: '10px 14px',
                background: bg,
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: '0 6px 6px 0'
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.02em' }}>
                {cleanTitle}
              </h3>
            </div>
          );
        }

        const isBullet = /^[-*•]\s+|^\d+\.\s+/.test(trimmed);
        if (isBullet) {
          const bulletText = trimmed.replace(/^[-*•]\s+|^\d+\.\s+/, '');
          return (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingLeft: 4, color: 'var(--color-text)' }}>
              <span style={{ color: 'var(--color-brand-strong, #629113)', lineHeight: 1.8, fontSize: 12 }}>●</span>
              <div style={{ flex: 1 }}>{parseRichInline(bulletText)}</div>
            </div>
          );
        }

        return (
          <p key={idx} style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.85 }}>
            {parseRichInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export function LatestDailyBrief({ articles = [] }) {
  const [report, setReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const controller = useRef(null);
  const prefs = read(PREFS, DEFAULT_PREFERENCES);
  const prefLabel = [ prefs.tags?.join(' / ') || '全部标签', prefs.period === '24h' ? '最近24小时' : prefs.period === 'date' ? (prefs.date || '指定日期') : '全部日期'].filter(Boolean).join(' · ');

  useEffect(() => {
    const sync = () => {
      const local = history();
      if (local.length) {
        setReport(local[0]);
      } else {
        fetch('/api/reports')
          .then(r => r.json())
          .then(c => {
            if (Array.isArray(c.reports) && c.reports.length) {
              setReport(c.reports[0]);
              save(HISTORY, c.reports);
            }
          })
          .catch(() => {});
      }
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('daily-reports-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('daily-reports-change', sync);
      controller.current?.abort();
    };
  }, []);

  async function quickGenerate() {
    if (generating) return;
    const matches = filterReportArticles(articles, prefs).slice(0, prefs.limit || 20);
    if (!matches.length) { setStatus('当前偏好下没有匹配的新闻。请前往报告中心调整标签。'); return; }
    setGenerating(true); setStatus('正在提交匹配新闻生成日报…');
    controller.current = new AbortController();
    try {
      const res = await fetch('/api/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleIds: matches.map(a => a.id), mode: 'auto' }),
        signal: controller.current.signal
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || '生成失败'); }
      let content = '';
      for await (const line of readSSE(res.body)) {
        if (!line) continue;
        const chunk = JSON.parse(line);
        if (chunk.type === 'delta') { content += chunk.text || ''; continue; }
        if (chunk.type === 'complete') {
          const record = { id: Date.now(), createdAt: chunk.createdAt, content, sources: chunk.sources || [], mode: chunk.mode || 'auto', model: chunk.model, preferences: prefs };
          const all = history(); save(HISTORY, [record, ...all].slice(0, 20));
          setReport(record); setStatus('日报已生成并保存。');
        }
        if (chunk.type === 'error') throw new Error(chunk.error);
      }
    } catch (e) { setStatus(e.name === 'AbortError' ? '已取消' : e.message); }
    finally { setGenerating(false); controller.current = null; }
  }

  return <aside className="panel" style={{display:'flex',flexDirection:'column',gap:14}}>
    <div className="panel-header">
      <div>
        <h2>我的日报</h2>
      </div>
      <Link className="button button--secondary" href="/reports" style={{fontSize:12,minHeight:32,padding:'0 12px'}}>定制日报</Link>
    </div>
    {report ? <>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <span className="badge badge--neutral">{dateLabel(report.createdAt)}</span>
        <span className="badge badge--neutral">{report.sources?.length || 0} 条新闻</span>
      </div>
      <span className="badge badge--info">{reportModeLabel(report.mode) + ' · AI生成'}</span>
      <p style={{color:'var(--color-text-secondary)',fontSize:13,lineHeight:1.8,margin:0}}>{report.content?.slice(0, 420)}{report.content?.length > 420 ? '…' : ''}</p>
      <Link href="/reports" style={{color:'var(--color-brand-strong)',fontSize:13,fontWeight:700,textDecoration:'none',alignSelf:'flex-start'}}>查看全文 →</Link>
    </> : <div style={{textAlign:'center',padding:'24px 0',display:'flex',flexDirection:'column',gap:10}}>
      <p style={{color:'var(--color-text-secondary)',fontSize:13,margin:0}}>还没有生成日报。设置偏好后一键生成。</p>
      <Link className="button button--secondary" href="/reports">配置偏好并生成日报</Link>
    </div>}
    <div style={{borderTop:'1px solid var(--color-border)',paddingTop:14,display:'flex',flexDirection:'column',gap:10}}>
      <div className="panel-header" style={{marginBottom:0}}><h3 style={{fontSize:14}}>当前偏好</h3></div>
      <p style={{color:'var(--color-text-secondary)',fontSize:12,margin:0}}>{prefLabel || '使用默认偏好（全部标签）'}</p>
      <p role="status" style={{color:'var(--color-text-secondary)',fontSize:12,margin:0}}>{status}</p>
      <button className="button button--primary" type="button" disabled={generating} onClick={quickGenerate}>
        {generating ? '正在生成日报…' : '一键生成日报'}
      </button>
    </div>
    <small style={{color:'var(--color-text-muted)',fontSize:11}}>偏好与最近20份日报保存在当前浏览器。</small>
  </aside>;
}

export default function DailyReports({ articles, mode }) {
  const [prefs, setPrefs] = useState(DEFAULT_PREFERENCES), [saved, setSaved] = useState([]);
  const [ready, setReady] = useState(false), [config, setConfig] = useState(null);
  const [report, setReport] = useState(null), [draft, setDraft] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState(''), [notice, setNotice] = useState('');
  const controller = useRef(null);
  useEffect(() => {
    setPrefs(prev => ({ ...DEFAULT_PREFERENCES, ...read(PREFS, DEFAULT_PREFERENCES), ...(prev.tags?.length && prev !== DEFAULT_PREFERENCES ? prev : {}) }));
    fetch('/api/reports').then(r => r.json()).then(c => {
      setConfig(c); setReady(true);
      if (Array.isArray(c.reports) && c.reports.length) {
        setSaved(c.reports);
        setReport(prev => prev || c.reports[0]);
        save(HISTORY, c.reports);
      }
    }).catch(() => setConfig({ configured: false }));

    const onLlmChange = () => {
      fetch('/api/reports').then(r => r.json()).then(c => setConfig(c)).catch(() => {});
    };
    window.addEventListener('llm-config-change', onLlmChange);
    return () => window.removeEventListener('llm-config-change', onLlmChange);
  }, []);
  useEffect(() => { save(PREFS, prefs); }, [prefs]);
  const availableTags = useMemo(
    () => CANONICAL_TAGS,
    []
  );

  useEffect(() => {
    const stored = history();
    if (!saved.length && stored.length) {
      setSaved(stored);
      if (!report) setReport(stored[0]);
    }
    const sync = () => {
      const list = history();
      if (list.length) { setSaved(list); if (!report) setReport(list[0]); }
    };
    window.addEventListener('storage', sync); window.addEventListener('daily-reports-change', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('daily-reports-change', sync); };
  }, [report, saved.length]);
  useEffect(() => { return () => controller.current?.abort(); }, []);

  const matches = useMemo(() => filterReportArticles(articles, prefs), [articles, prefs]);
  const autoIds = useMemo(() => matches.slice(0, prefs.limit || 20).map(a => a.id), [matches, prefs.limit]);

  function exportObsidian(targetReport) {
    const r = targetReport || report;
    if (!r) return;
    const d = new Date(r.createdAt || Date.now());
    const dateStr = Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : '未知日期';
    const timeStr = Number.isFinite(d.getTime()) ? d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '';
    const md = `---
title: "AI安全与合规情报日报 - ${dateStr}"
date: ${d.toISOString()}
tags:
  - AI安全
  - AI合规治理
  - 定制日报
model: "${r.model || config?.model || 'AI模型'}"
source_count: ${r.sources?.length || 0}
mode: "${r.mode || 'auto'}"
---

# AI安全与合规情报日报 (${dateStr})

> **生成时间**：${timeStr}  
> **模型**：${r.model || config?.model || 'AI模型'} | **模式**：${reportModeLabel(r.mode)}

${r.content}

## 引用素材与信源清单
${(r.sources || []).map(s => `- [${s.number}] **${s.title}**\n  - 来源: \`${s.source || '未知'}\`\n  - 链接: ${s.url || '未提供'}`).join('\n')}
`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI安全合规日报-${dateStr}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice('已导出 Obsidian 格式 Markdown 笔记！');
  }

  async function removeReport(e, id) {
    e.stopPropagation();
    if (!confirm('确定要删除这份历史日报吗？')) return;
    try {
      await fetch(`/api/reports?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const next = saved.filter(r => String(r.id) !== String(id));
      setSaved(next);
      save(HISTORY, next);
      if (String(report?.id) === String(id)) setReport(next[0] || null);
      setNotice('已删除该份历史日报。');
    } catch { setError('删除失败，请稍后重试。'); }
  }

  async function generate() {
    if (!ready || busy) return;
    if (config && config.configured === false) {
      setError('尚未配置大模型 API Key，请点击左下角「大模型配置」完成设置后生成。');
      return;
    }
    if (!autoIds.length) { setError('当前偏好下没有匹配的新闻，请调整标签范围。'); return; }
    const providerLabel = config?.provider === 'deepseek' ? 'DeepSeek' :
                          config?.provider === 'openai' ? 'OpenAI' :
                          config?.provider === 'custom' ? '自定义大模型' : '硅基流动';
    setBusy(true); setError(''); setStatus(`正在提交 ${autoIds.length} 条匹配新闻到 ${providerLabel}…`); setDraft('');
    controller.current?.abort(); controller.current = new AbortController();
    try {
      const res = await fetch('/api/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleIds: autoIds, mode, preferences: prefs }),
        signal: controller.current.signal
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || '生成失败，请确认模型 API Key 已设置。'); }
      let content = '';
      for await (const line of readSSE(res.body)) {
        if (!line) continue;
        const chunk = JSON.parse(line);
        if (chunk.type === 'delta') { content += chunk.text || ''; setDraft(content); continue; }
        if (chunk.type === 'complete') {
          const record = { id: chunk.id || Date.now(), createdAt: chunk.createdAt, content, sources: chunk.sources || [], mode: chunk.mode || mode, model: chunk.model, preferences: prefs };
          const all = saved.filter(r => String(r.id) !== String(record.id));
          const updated = [record, ...all].slice(0, 50);
          save(HISTORY, updated);
          setSaved(updated);
          setDraft(''); setReport(record); setStatus('日报已生成并持久化保存至 NAS。');
        }
        if (chunk.type === 'error') throw new Error(chunk.error);
      }
    } catch (e) { setError(e.name === 'AbortError' ? '已取消' : e.message); setDraft(''); }
    finally { setBusy(false); controller.current = null; }
  }

  const historyList = saved.filter(r => r.id !== report?.id);
  return <section className="dashboard-grid content-grid--wide">
    <div className="panel" style={{display:'flex',flexDirection:'column',gap:18}}>
      <div className="panel-header">
        <h2>配置与生成</h2>
        <span className={`badge ${ready ? 'badge--info' : 'badge--neutral'}`}>{ready ? '已就绪' : '加载中…'}</span>
      </div>
      <fieldset disabled={busy} style={{border:0,padding:0,margin:0,display:'flex',flexDirection:'column',gap:16}}>
        <div>
          <span style={{display:'block',marginBottom:8,color:'var(--color-text)',fontSize:13,fontWeight:700}}>关注标签（可多选）</span>
          <div className="feature-tags">{availableTags.map(t => <button key={t} type="button" style={prefs.tags?.includes(t)?{borderColor:'var(--color-brand)',background:'rgba(134,188,37,.18)',color:'var(--color-text)'}:{}} onClick={() => setPrefs(p => ({ ...p, tags: p.tags?.includes(t) ? p.tags.filter(x => x !== t) : [...(p.tags || []), t] }))}>{t}</button>)}{!availableTags.length && <span style={{color:'var(--color-text-muted)',fontSize:12,padding:'4px 0'}}>暂无可用标签</span>}</div>
        </div>
        <div className="analysis-search-card__filters" style={{margin:0}}>
          <label>时间范围<select value={prefs.period} onChange={e => setPrefs(p => ({ ...p, period: e.target.value }))} style={{width:'100%',minHeight:42,padding:'8px 10px',border:'1px solid var(--color-border)',borderRadius:4,background:'var(--color-surface)',color:'var(--color-text)',colorScheme:'light',fontSize:13}}><option value="all">全部日期</option><option value="24h">最近24小时</option><option value="date">指定日期</option></select></label>
          {prefs.period === 'date' && <label>指定日期<input type="date" value={prefs.date || ''} onChange={e => setPrefs(p => ({ ...p, date: e.target.value }))} style={{width:'100%',minHeight:42,padding:'8px 10px',border:'1px solid var(--color-border)',borderRadius:4,background:'var(--color-surface)',color:'var(--color-text)',colorScheme:'light'}} /></label>}
          <label>最多选取<input type="number" min={3} max={30} value={prefs.limit || 20} onChange={e => setPrefs(p => ({ ...p, limit: Number(e.target.value) || 20 }))} style={{width:'100%',minHeight:42,padding:'8px 10px',border:'1px solid var(--color-border)',borderRadius:4,background:'var(--color-surface)',color:'var(--color-text)',colorScheme:'light'}} /></label>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <button className="button button--secondary" type="button" onClick={() => { try { save(PREFS, { ...prefs, tags: prefs.tags?.length ? prefs.tags : DEFAULT_PREFERENCES.tags }); setReady(true); setNotice('偏好已保存。'); } catch { setError('浏览器无法保存偏好。'); } }}>保存为我的偏好</button>
          {notice && <span className="badge badge--success">{notice}</span>}
          {error && <span className="badge badge--danger">{error}</span>}
        </div>
      </fieldset>
      <div className="panel-header" style={{marginTop:4}}>
        <h3 style={{fontSize:15}}>匹配新闻</h3>
        <span className="badge badge--neutral">共 {matches.length} 条 · 选取前 {Math.min(prefs.limit || 20, matches.length)} 条</span>
      </div>
      <div style={{maxHeight:360,overflow:'auto',margin:'4px 0'}}>
        {matches.slice(0, prefs.limit || 20).map(a => <div key={a.id} style={{display:'flex',flexDirection:'column',gap:4,padding:'12px 0',borderBottom:'1px solid var(--color-border)'}}><strong style={{fontSize:13,fontWeight:600,lineHeight:1.7}}>{a.title}</strong><small style={{color:'var(--color-text-secondary)',fontSize:12}}>{a.intelligenceType} · {dateLabel(a.publishedAt)}</small></div>)}
        {!matches.length && <p style={{color:'var(--color-text-secondary)',fontSize:13}}>没有匹配新闻。请调整日期或标签。</p>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <button className="button button--primary" type="button" disabled={!ready || busy || !autoIds.length} onClick={generate}>{busy ? '正在生成…' : '生成日报'}</button>
        {busy && <button className="button button--secondary" type="button" onClick={() => controller.current?.abort()}>取消生成</button>}
      </div>
      <small style={{color:'var(--color-text-muted)',fontSize:12}}>{config?.model ? `${config.provider === 'deepseek' ? 'DeepSeek' : config.provider === 'openai' ? 'OpenAI' : config.provider === 'custom' ? '自定义大模型' : '硅基流动'} · ${config.model}` : (config ? '大模型在线配置就绪' : '正在读取模型配置…')}</small>
    </div>
      <div className="panel" style={{display:'flex',flexDirection:'column',gap:20}}>
      <div className="panel-header">
        <h2>{busy ? '正在生成的日报' : '日报全文'}</h2>
        {report && !busy && <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <button className="button button--secondary" type="button" onClick={async () => { try { await navigator.clipboard.writeText(`${report.content}\n\n来源\n${report.sources.map(s => `[${s.number}] ${s.title} ${safeSourceUrl(s.url) || ''}`).join('\n')}`); setNotice('日报已复制到剪贴板。'); } catch { setError('复制失败，请选中正文手动复制。'); } }}>复制日报</button>
          <button className="button button--secondary" type="button" onClick={() => exportObsidian(report)}>导出 Obsidian 笔记</button>
        </div>}
      </div>
      <p role="status" style={{color:'var(--color-text-secondary)',fontSize:13,margin:0}}>{status}</p>
      {busy || draft ? <>
        <span className="badge badge--neutral">{reportModeLabel(mode)} · 未完成内容不保存</span>
        <FormattedReport content={draft || '已提交匹配新闻，等待模型返回正文…'} />
        {!busy && <button className="button button--secondary" type="button" onClick={() => { setDraft(''); setStatus(''); }}>返回上次成功日报</button>}
      </> : report ? <>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span className="badge badge--neutral">{dateLabel(report.createdAt)}</span>
          <span className="badge badge--neutral">{report.sources.length} 条</span>
        </div>
        <span className="badge badge--info">{reportModeLabel(report.mode) + ' · AI生成'} · {report.model}</span>
        <FormattedReport content={report.content} />
      </> : <div style={{textAlign:'center',padding:'40px 20px'}}>
        <h3 style={{fontSize:18,margin:'0 0 8px'}}>从配置偏好开始</h3>
        <p style={{color:'var(--color-text-secondary)',fontSize:14,margin:0}}>配置关注标签后，系统自动匹配相关新闻并生成AI日报。</p>
      </div>}
      <div style={{borderTop:'1px solid var(--color-border)',paddingTop:18}}>
        <div className="panel-header" style={{marginBottom:10}}>
          <h3 style={{fontSize:15}}>历史日报</h3>
          <span className="badge badge--neutral">{saved.length} 份</span>
        </div>
        <div style={{display:'grid',gap:6}}>{saved.map(r => <div key={r.id} style={{display:'flex',gap:6,alignItems:'center'}}><button type="button" disabled={busy} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flex:1,minHeight:42,padding:'8px 12px',border:'1px solid',borderRadius:4,borderColor:report?.id===r.id?'var(--color-brand-strong)':'var(--color-border)',background:report?.id===r.id?'rgba(134,188,37,.14)':'#ffffff',color:'var(--color-text)',cursor:busy?'not-allowed':'pointer',textAlign:'left',fontSize:13,transition:'background .16s ease'}} onClick={() => { setReport(r); setDraft(''); setError(''); setStatus(''); }}><span>{dateLabel(r.createdAt)}</span><span style={{fontSize:12,color:'var(--color-text-muted)'}}>{r.sources?.length || 0} 条 · {reportModeLabel(r.mode)}</span></button><button type="button" title="导出 Obsidian 格式" className="button button--secondary" style={{padding:'6px 10px',minHeight:42,fontSize:12}} onClick={() => exportObsidian(r)}>MD</button><button type="button" title="删除该份历史日报" className="button button--secondary" style={{padding:'6px 10px',minHeight:42,fontSize:12,color:'#ff6b72'}} onClick={e => removeReport(e, r.id)}>&times;</button></div>)}</div>
        {!saved.length && <p style={{color:'var(--color-text-muted)',fontSize:13}}>还没有已完成的日报。</p>}
      </div>
    </div>
  </section>;
}
