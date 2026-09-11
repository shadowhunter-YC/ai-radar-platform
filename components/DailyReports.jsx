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

export function LatestDailyBrief({ articles = [] }) {
  const [report, setReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const controller = useRef(null);
  const prefs = read(PREFS, DEFAULT_PREFERENCES);
  const prefLabel = [ prefs.tags?.join(' / ') || '全部标签', prefs.period === '24h' ? '最近24小时' : prefs.period === 'date' ? (prefs.date || '指定日期') : '全部日期'].filter(Boolean).join(' · ');

  useEffect(() => {
    const sync = () => setReport(history()[0] || null); sync();
    window.addEventListener('storage', sync); window.addEventListener('daily-reports-change', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('daily-reports-change', sync); controller.current?.abort(); };
  }, []);

  async function quickGenerate() {
    if (generating) return;
    const matches = filterReportArticles(articles, prefs).slice(0, prefs.limit || 20);
    if (!matches.length) { setStatus('当前偏好下没有匹配的新闻。请前往报告中心调整标签。'); return; }
    setGenerating(true); setStatus('正在提交匹配新闻到 DeepSeek…');
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
        <p className="panel-eyebrow">日报速览</p>
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
    fetch('/api/reports').then(r => r.json()).then(c => { setConfig(c); setReady(true); }).catch(() => setConfig({ configured: false }));
  }, []);
  useEffect(() => { save(PREFS, prefs); }, [prefs]);
  const availableTags = useMemo(
    () => CANONICAL_TAGS,
    []
  );

  useEffect(() => {
    const stored = history(); setSaved(stored); setReport(stored[0] || null);
    const sync = () => { const list = history(); setSaved(list); if (list.length && !report) setReport(list[0]); };
    window.addEventListener('storage', sync); window.addEventListener('daily-reports-change', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('daily-reports-change', sync); };
  }, [report]);
  useEffect(() => { return () => controller.current?.abort(); }, []);

  const matches = useMemo(() => filterReportArticles(articles, prefs), [articles, prefs]);
  const autoIds = useMemo(() => matches.slice(0, prefs.limit || 20).map(a => a.id), [matches, prefs.limit]);

  async function generate() {
    if (!ready || busy || config?.configured !== true) return;
    if (!autoIds.length) { setError('当前偏好下没有匹配的新闻，请调整标签范围。'); return; }
    setBusy(true); setError(''); setStatus(`正在提交 ${autoIds.length} 条匹配新闻到 DeepSeek…`); setDraft('');
    controller.current?.abort(); controller.current = new AbortController();
    try {
      const res = await fetch('/api/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleIds: autoIds, mode }),
        signal: controller.current.signal
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || '生成失败，请确认模型 API Key 已设置。'); }
      let content = '';
      for await (const line of readSSE(res.body)) {
        if (!line) continue;
        const chunk = JSON.parse(line);
        if (chunk.type === 'delta') { content += chunk.text || ''; setDraft(content); continue; }
        if (chunk.type === 'complete') {
          const record = { id: Date.now(), createdAt: chunk.createdAt, content, sources: chunk.sources || [], mode: chunk.mode || mode, model: chunk.model, preferences: prefs };
          const all = history(); save(HISTORY, [record, ...all].slice(0, 20));
          setDraft(''); setReport(record); setStatus('日报已生成并保存。');
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
        <div>
          <p className="panel-eyebrow">日报偏好</p>
          <h2>配置与生成</h2>
        </div>
        <span className={`badge ${ready ? 'badge--info' : 'badge--neutral'}`}>{ready ? '已就绪' : '加载中…'}</span>
      </div>
      <p style={{color:'var(--color-text-secondary)',fontSize:13,margin:0}}>偏好保存在当前浏览器，决定日报自动选取哪些新闻。</p>
      {config && !config.configured && <div className="source-feature-config__note" style={{borderLeftColor:'var(--color-danger)',background:'rgba(255,93,103,.08)',color:'#ffadb3'}}>模型尚未配置，请按项目《日报配置说明》设置服务端 API Key 后重启。</div>}
      <fieldset disabled={busy} style={{border:0,padding:0,margin:0,display:'flex',flexDirection:'column',gap:16}}>
        <div>
          <span style={{display:'block',marginBottom:8,color:'var(--color-text-secondary)',fontSize:13,fontWeight:800}}>标签（可多选）</span>
          <div className="feature-tags">{availableTags.map(t => <button key={t} type="button" style={prefs.tags?.includes(t)?{borderColor:'rgba(45,156,255,.68)',background:'rgba(35,136,255,.18)',color:'#fff'}:{}} onClick={() => setPrefs(p => ({ ...p, tags: p.tags?.includes(t) ? p.tags.filter(x => x !== t) : [...(p.tags || []), t] }))}>{t}</button>)}{!availableTags.length && <span style={{color:'var(--color-text-muted)',fontSize:12,padding:'4px 0'}}>暂无可用标签</span>}</div>
        </div>
        <div className="analysis-search-card__filters" style={{margin:0}}>
          <label>时间范围<select value={prefs.period} onChange={e => setPrefs(p => ({ ...p, period: e.target.value }))} style={{width:'100%',minHeight:42,padding:'8px 10px',border:'1px solid rgba(35,136,255,.18)',borderRadius:2,background:'rgba(5,13,23,.62)',color:'var(--color-text)',colorScheme:'dark',fontSize:13}}><option value="all">全部日期</option><option value="24h">最近24小时</option><option value="date">指定日期</option></select></label>
          {prefs.period === 'date' && <label>指定日期<input type="date" value={prefs.date || ''} onChange={e => setPrefs(p => ({ ...p, date: e.target.value }))} style={{width:'100%',minHeight:42,padding:'8px 10px',border:'1px solid rgba(35,136,255,.18)',borderRadius:2,background:'rgba(5,13,23,.62)',color:'var(--color-text)',colorScheme:'dark'}} /></label>}
          <label>最多选取<input type="number" min={3} max={30} value={prefs.limit || 20} onChange={e => setPrefs(p => ({ ...p, limit: Number(e.target.value) || 20 }))} style={{width:'100%',minHeight:42,padding:'8px 10px',border:'1px solid rgba(35,136,255,.18)',borderRadius:2,background:'rgba(5,13,23,.62)',color:'var(--color-text)',colorScheme:'dark'}} /></label>
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
      <p style={{color:'var(--color-text-secondary)',fontSize:13,margin:0}}>调整上方偏好可改变匹配范围；点击「生成日报」自动选取。</p>
      <div style={{maxHeight:360,overflow:'auto',margin:'4px 0'}}>
        {matches.slice(0, prefs.limit || 20).map(a => <div key={a.id} style={{display:'flex',flexDirection:'column',gap:4,padding:'12px 0',borderBottom:'1px solid var(--color-border)'}}><strong style={{fontSize:13,fontWeight:500,lineHeight:1.7}}>{a.title}</strong><small style={{color:'var(--color-text-secondary)',fontSize:12}}>{a.intelligenceType} · {dateLabel(a.publishedAt)}</small></div>)}
        {!matches.length && <p style={{color:'var(--color-text-secondary)',fontSize:13}}>没有匹配新闻。请调整日期或标签；示例新闻可选择全部日期查看。</p>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <button className="button button--primary" type="button" disabled={!ready || busy || !autoIds.length || !config?.configured} onClick={generate}>{busy ? '正在生成…' : '生成日报'}</button>
        {busy && <button className="button button--secondary" type="button" onClick={() => controller.current?.abort()}>取消生成</button>}
      </div>
      <small style={{color:'var(--color-text-muted)',fontSize:12}}>{config ? `硅基流动 · ${config.model}` : '正在读取模型配置…'}</small>
    </div>
      <div className="panel" style={{display:'flex',flexDirection:'column',gap:20}}>
      <div className="panel-header">
        <h2>{busy ? '正在生成的日报' : '日报全文'}</h2>
        {report && !busy && <button className="button button--secondary" type="button" onClick={async () => { try { await navigator.clipboard.writeText(`${report.content}\n\n来源\n${report.sources.map(s => `[${s.number}] ${s.title} ${safeSourceUrl(s.url) || ''}`).join('\n')}`); setNotice('日报已复制。'); } catch { setError('复制失败，请选中正文手动复制。'); } }}>复制日报</button>}
      </div>
      <p role="status" style={{color:'var(--color-text-secondary)',fontSize:13,margin:0}}>{status}</p>
      {busy || draft ? <>
        <span className="badge badge--neutral">{reportModeLabel(mode)} · 未完成内容不保存</span>
        <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:15,lineHeight:1.95,maxWidth:'76ch'}}>{draft || '已提交匹配新闻，等待模型返回正文…'}</div>
        {!busy && <button className="button button--secondary" type="button" onClick={() => { setDraft(''); setStatus(''); }}>返回上次成功日报</button>}
      </> : report ? <>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span className="badge badge--neutral">{dateLabel(report.createdAt)}</span>
          <span className="badge badge--neutral">{report.sources.length} 条</span>
        </div>
        <span className="badge badge--info">{reportModeLabel(report.mode) + ' · AI生成'} · {report.model}</span>
        <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:15,lineHeight:1.95,maxWidth:'76ch'}}>{report.content}</div>
      </> : <div style={{textAlign:'center',padding:'40px 20px'}}>
        <p className="panel-eyebrow" style={{marginBottom:12}}>你的第一份日报</p>
        <h3 style={{fontSize:18,margin:'0 0 8px'}}>从配置偏好开始</h3>
        <p style={{color:'var(--color-text-secondary)',fontSize:14,margin:0}}>配置关注标签后，系统自动匹配相关新闻并生成AI日报。</p>
      </div>}
      <div style={{borderTop:'1px solid var(--color-border)',paddingTop:18}}>
        <div className="panel-header" style={{marginBottom:10}}>
          <h3 style={{fontSize:15}}>历史日报</h3>
          <span className="badge badge--neutral">{saved.length} 份</span>
        </div>
        <p style={{color:'var(--color-text-muted)',fontSize:12,margin:'0 0 12px'}}>仅当前浏览器可见，最多保留20份；清除浏览器数据会移除记录。</p>
        <div style={{display:'grid',gap:6}}>{saved.map(r => <button key={r.id} type="button" disabled={busy} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,width:'100%',minHeight:42,padding:'8px 12px',border:'1px solid',borderRadius:2,borderColor:report?.id===r.id?'var(--color-brand-strong)':'var(--color-border)',background:report?.id===r.id?'rgba(35,136,255,.16)':'rgba(5,13,23,.42)',color:report?.id===r.id?'#fff':'var(--color-text-secondary)',cursor:busy?'not-allowed':'pointer',textAlign:'left',fontSize:13,transition:'background .16s ease'}} onClick={() => { setReport(r); setDraft(''); setError(''); setStatus(''); }}><span>{dateLabel(r.createdAt)}</span><span style={{fontSize:12,color:'var(--color-text-muted)'}}>{r.sources.length} 条 · {reportModeLabel(r.mode)}</span></button>)}</div>
        {!saved.length && <p style={{color:'var(--color-text-muted)',fontSize:13}}>还没有已完成的日报。</p>}
      </div>
    </div>
  </section>;
}
