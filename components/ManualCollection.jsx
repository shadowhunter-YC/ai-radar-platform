"use client";
import { useEffect, useRef, useState } from 'react';



export default function ManualCollection() {
  const [url, setUrl] = useState('');
  const [drafts, setDrafts] = useState([]), [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState(''), [errors, setErrors] = useState([]), [configured, setConfigured] = useState(false);
  const lock = useRef(false), aborter = useRef(null);
  async function refresh() { try { const r = await fetch('/api/collection'); if (r.ok) { const d = await r.json(); setConfigured(d.configured); } } catch {} }
  useEffect(() => {
    refresh();
    const choose = event => { if (lock.current) return; setUrl(event.detail.url || ''); document.getElementById('manual-collection')?.scrollIntoView({ behavior: 'smooth' }); setStatus('已填入RSS订阅地址。请确认是订阅地址，再手动读取。'); };
    window.addEventListener('choose-collection-source', choose);
    return () => { window.removeEventListener('choose-collection-source', choose); aborter.current?.abort(); };
  }, []);
  async function call(input) {
    const r = await fetch('/api/collection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: aborter.current?.signal });
    const data = await r.json(); if (!r.ok) throw new Error(data.error || '请求失败。'); return data;
  }
  async function run(task) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); aborter.current = new AbortController();
    try { await task(); } catch (e) { setError(e.name === 'AbortError' ? '已取消本次请求。已完成的分析仍保留。' : e.message); setStatus('本次操作未完成，可调整后重试。'); }
    finally { lock.current = false; setBusy(false); refresh(); }
  }
  const replace = d => setDrafts(previous => previous.map(old => old.id === d.id ? d : old));
  return <section id="manual-collection" className="panel manual-collection">
    <div className="panel-header"><h2>RSS 采集</h2><span className="badge badge--neutral">仅点击时运行 · 无后台采集</span></div>
    <p style={{color:'var(--color-text-secondary)',fontSize:13,margin:0}}>① 输入RSS/Atom订阅地址 → ② 读取并选择文章，用 DeepSeek 分析 → ③ 确认入库</p>
    <p style={{color:'var(--color-text-muted)',fontSize:12,margin:'0 0 4px'}}>填写RSS/Atom订阅地址，一次最多读取3篇文章，每来源冷却10分钟，最多8次网页请求。AI分析会使用现有硅基流动额度。</p>
    <fieldset className="collection-input" disabled={busy}>
      <label>RSS / Atom订阅地址<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://blogs.microsoft.com/feed/"/></label>
      <button type="button" onClick={()=>setUrl('https://blogs.microsoft.com/feed/')}>填入微软官方博客订阅</button>
      <button className="button button--primary" type="button" onClick={()=>run(async()=>{ setDrafts([]); setSelected([]); setErrors([]); setStatus('正在检查站点规则并读取RSS内容，请等待…'); const d=await call({action:'rss',url}); setDrafts(d.drafts); setSelected(d.drafts.map(x=>x.id)); setErrors(d.errors || []); setStatus(`读取结束：${d.drafts.length}篇可预览，${d.requests}次网页请求${d.cached?'，已复用缓存':''}。尚未调用AI、尚未入库。`); })}>读取RSS（暂不调用AI）</button>
    </fieldset>
    <p role="status">{status}</p>{error&&<p style={{color:'#ffadb3',fontSize:12}} role="alert">{error}</p>}{errors.map((e,i)=><p style={{color:'#ffadb3',fontSize:12}} key={i}>{e.title}：{e.error}</p>)}
    {drafts.length>0 && <>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginTop:4}}><button className="button button--primary" disabled={busy||!configured||!selected.length} type="button" onClick={()=>run(async()=>{let count=0; for(const d of drafts.filter(x=>selected.includes(x.id))){setStatus(`DeepSeek正在分析第${++count} / ${selected.length}篇：${d.title}`); const result=await call({action:'analyze',id:d.id});replace(result.draft);}setStatus('分析完成。请对照原文检查结果，再点击每篇的“确认入库”。');})}>分析所选 {selected.length} 篇</button>{!configured&&<span style={{color:'var(--color-text-muted)',fontSize:12}}>请先配置服务端API Key。</span>}</div>
      <div className="collection-previews">{drafts.map(d=><article className="collection-preview" key={d.id}>
        <label className="collection-select"><input type="checkbox" disabled={busy} checked={selected.includes(d.id)} onChange={()=>setSelected(selected.includes(d.id)?selected.filter(id=>id!==d.id):[...selected,d.id])}/><strong>{d.title}</strong></label>
        <p style={{color:'var(--color-text-muted)',fontSize:12,margin:0}}>{d.kind==='paste'?'用户提供正文':'真实网页提取'} · {d.source} · {d.publishedAt?`发布时间：${new Date(d.publishedAt).toLocaleString('zh-CN')}`:'原文发布时间未识别，将单独标注采集时间'} · 未独立核验</p>
        <div className="collection-compare"><section><h3>原文摘录</h3><div className="collection-original">{d.text}</div>{d.kind!=='paste'&&<a href={d.url} target="_blank" rel="noopener noreferrer">打开原文</a>}</section><section><h3>DeepSeek分析</h3>{d.analysis?<><p>{d.analysis.summary}</p><p>{d.analysis.category} · {d.analysis.tags.join(' / ')}</p><h4>业务影响 · AI分析</h4><p>{d.analysis.impact}</p><h4>关注建议</h4><p>{d.analysis.action}</p><small>{d.analysis.model}</small></>:<p style={{color:'var(--color-text-muted)',fontSize:12}}>尚未分析。勾选文章后点击“分析所选”。</p>}</section></div>
        {d.articleId?<div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginTop:4}}><span className="badge badge--success">已入库</span><a href={`/analysis?article=${d.articleId}`}>查看资讯库</a><a href="/reports">去生成日报</a></div>:<button className="button button--primary" type="button" disabled={busy||!d.analysis} onClick={()=>run(async()=>{setStatus('正在保存到本地资讯库…');const result=await call({action:'save',id:d.id});replace({...d,articleId:result.articleId});setStatus('已入库。点击“加入日报”，再前往报告中心。');})}>确认入库</button>}
      </article>)}</div>
    </>}
    {busy&&<button className="button button--secondary" type="button" onClick={()=>aborter.current?.abort()}>取消当前操作</button>}
    
  </section>;
}
