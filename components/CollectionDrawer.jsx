"use client";
import { useEffect, useRef, useState } from 'react';

export default function CollectionDrawer({ isOpen, onClose, source }) {
  const [drafts, setDrafts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState([]);
  const [configured, setConfigured] = useState(false);
  const [activeFeedId, setActiveFeedId] = useState(null);

  const lock = useRef(false);
  const aborter = useRef(null);

  async function checkConfig() {
    try {
      const r = await fetch('/api/collection');
      if (r.ok) {
        const d = await r.json();
        setConfigured(d.configured);
      }
    } catch {}
  }

  useEffect(() => {
    checkConfig();
  }, []);

  useEffect(() => {
    if (isOpen && source && source.id && source.id !== activeFeedId) {
      setActiveFeedId(source.id);
      startCollection(source);
    }
  }, [isOpen, source]);

  async function call(input) {
    const r = await fetch('/api/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: aborter.current?.signal
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || '操作失败');
    return data;
  }

  async function run(task) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    aborter.current = new AbortController();
    try {
      await task();
    } catch (e) {
      setError(e.name === 'AbortError' ? '已取消本次操作。' : e.message);
      setStatus('操作未完成或已被中断。');
    } finally {
      lock.current = false;
      setBusy(false);
      checkConfig();
    }
  }

  function startCollection(targetSource, force = false) {
    run(async () => {
      setDrafts([]);
      setSelected([]);
      setErrors([]);
      setStatus(`正在连接【${targetSource.name || '订阅源'}】抓取最新文章…`);

      const d = await call({ action: 'crawl_feed', feedId: targetSource.id, force });
      const newDrafts = d.drafts || [];
      setDrafts(newDrafts);
      setSelected(newDrafts.map(x => x.id));
      setErrors(d.errors || []);

      if (newDrafts.length > 0) {
        setStatus(`【${targetSource.name}】采集完成：获取到 ${newDrafts.length} 篇通过门禁的文章。`);
      } else {
        const isWechat = targetSource?.category === '微信公众号' || targetSource?.url?.includes('wewe') || targetSource?.url?.includes('/feed/MP_WXS_');
        if (isWechat) {
          setStatus(`【${targetSource.name}】暂无文章。若刚添加或登录，微信官方有 15~30 分钟防刷频率保护，WeRSS 后台服务正在自动排队同步中。`);
        } else {
          setStatus(`【${targetSource.name}】采集完成：获取到 0 篇通过门禁的文章（可能因内容未命中关键词门禁）。`);
        }
      }
    });
  }

  const replace = d => setDrafts(prev => prev.map(old => (old.id === d.id ? d : old)));

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩背景 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(3px)',
          zIndex: 1190,
          transition: 'opacity 0.2s ease'
        }}
      />

      {/* 右侧边栏抽屉 */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 580,
          maxWidth: '92vw',
          background: 'var(--color-surface, #ffffff)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
          zIndex: 1200,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* 抽屉头部 */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--color-surface)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--color-text)', fontWeight: 600 }}>
                {source?.name ? `实时采集：${source.name}` : '信源实时采集'}
              </h3>
              {source?.category && (
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 7px',
                    borderRadius: 3,
                    background: '#f0fdf4',
                    color: '#15803d',
                    border: '1px solid #bbf7d0'
                  }}
                >
                  {source.category}
                </span>
              )}
            </div>
            {source?.url && (
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 440
                }}
              >
                {source.url}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--color-text-muted)',
              fontSize: 22,
              lineHeight: 1,
              padding: '4px 8px',
              cursor: 'pointer',
              borderRadius: 4
            }}
            title="关闭侧边栏"
          >
            &times;
          </button>
        </div>

        {/* 状态监控与指示器 */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-page)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {busy ? (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: '2px solid rgba(134,188,37,.3)',
                    borderTopColor: 'var(--color-brand)',
                    animation: 'spin 0.8s linear infinite',
                    flexShrink: 0
                  }}
                />
              ) : (
                <span style={{ color: 'var(--color-brand)', fontSize: 13, flexShrink: 0 }}>●</span>
              )}
              <span style={{ fontSize: 12, color: busy ? 'var(--color-brand-strong)' : 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {status || '就绪'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {source && !busy && (
                <button
                  type="button"
                  onClick={() => startCollection(source, true)}
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#15803d',
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                  title="强制刷新（绕过冷却限制）"
                >
                  重新抓取
                </button>
              )}
              {busy && (
                <button
                  type="button"
                  onClick={() => aborter.current?.abort()}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  中断操作
                </button>
              )}
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: 4,
                background: error.includes('200013') || error.includes('微信') ? '#fefce8' : '#fef2f2',
                borderLeft: `3px solid ${error.includes('200013') || error.includes('微信') ? '#eab308' : '#ef4444'}`,
                border: `1px solid ${error.includes('200013') || error.includes('微信') ? '#fef08a' : '#fecaca'}`,
                color: error.includes('200013') || error.includes('微信') ? '#854d0e' : '#991b1b',
                fontSize: 12,
                lineHeight: 1.5
              }}
            >
              {error.includes('200013') || error.includes('微信') ? (
                <div>
                  <strong style={{ display: 'block', marginBottom: 2 }}>微信公众号限频保护提示：</strong>
                  <span>{error}</span>
                </div>
              ) : (
                error
              )}
            </div>
          )}

          {errors.map((e, idx) => (
            <div key={idx} style={{ marginTop: 6, padding: '4px 8px', borderRadius: 4, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontSize: 11 }}>
              {e.title}：{e.error}
            </div>
          ))}
        </div>

        {/* 批量操作工具栏 */}
        {drafts.length > 0 && (
          <div
            style={{
              padding: '10px 20px',
              background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--color-text)' }}>
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={selected.length === drafts.length && drafts.length > 0}
                  onChange={e => {
                    if (e.target.checked) setSelected(drafts.map(x => x.id));
                    else setSelected([]);
                  }}
                />
                全选 ({selected.length}/{drafts.length})
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="button button--primary"
                type="button"
                disabled={busy || !configured || selected.length === 0}
                onClick={() =>
                  run(async () => {
                    let count = 0;
                    for (const d of drafts.filter(x => selected.includes(x.id))) {
                      setStatus(`DeepSeek 正在研判第 ${++count}/${selected.length} 篇：${d.title}`);
                      const result = await call({ action: 'analyze', id: d.id });
                      replace(result.draft);
                    }
                    setStatus(`研判完成！共完成 ${selected.length} 篇内容安全分析，请核对后入库。`);
                  })
                }
                style={{ padding: '5px 12px', fontSize: 12 }}
              >
                分析所选 ({selected.length})
              </button>

              {drafts.some(d => d.analysis && !d.articleId) && (
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      setStatus('正在批量入库已研判的文章…');
                      let savedCount = 0;
                      for (const d of drafts.filter(x => x.analysis && !x.articleId && x.analysis.isRelevant !== false)) {
                        const res = await call({ action: 'save', id: d.id });
                        replace({ ...d, articleId: res.articleId });
                        savedCount++;
                      }
                      setStatus(`入库完成！已将 ${savedCount} 篇合规情报持久化至本地库。`);
                    })
                  }
                  style={{ padding: '5px 12px', fontSize: 12, background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}
                >
                  批量入库
                </button>
              )}
            </div>
          </div>
        )}

        {/* 内容列表可滚动区域 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {drafts.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              {busy ? (
                <div>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      margin: '0 auto 14px',
                      borderRadius: '50%',
                      border: '3px solid rgba(134,188,37,.2)',
                      borderTopColor: 'var(--color-brand)',
                      animation: 'spin 0.8s linear infinite'
                    }}
                  />
                  <p style={{ fontSize: 13, margin: 0, color: 'var(--color-text-secondary)' }}>正在抓取并比对关键词门禁…</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 600, margin: '0 0 6px' }}>暂无待审阅文章</p>
                  <p style={{ fontSize: 12, margin: 0, lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
                    {source?.category === '微信公众号' || source?.url?.includes('wewe') || source?.url?.includes('/feed/MP_WXS_')
                      ? '若该公众号刚添加或扫码登录，微信公众平台会临时启动防刷限频（200013），WeRSS 后台服务已接管并在定时队列中排队同步，约需15~30分钟后自动就绪，届时点击即可读取。'
                      : '该信源近期没有匹配安全关键词的新推文，或订阅源尚未更新。可点击右上角「重新抓取」强制刷新。'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            drafts.map(d => {
              const isSelected = selected.includes(d.id);
              const isAnalyzed = Boolean(d.analysis);
              const isImported = Boolean(d.articleId);
              const isRelevant = d.analysis ? d.analysis.isRelevant !== false : null;

              return (
                <div
                  key={d.id}
                  style={{
                    background: 'var(--color-surface)',
                    border: `1px solid ${isImported ? '#bbf7d0' : 'var(--color-border)'}`,
                    borderRadius: 6,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  {/* 标题与勾选 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={isSelected}
                      onChange={() => setSelected(isSelected ? selected.filter(id => id !== d.id) : [...selected, d.id])}
                      style={{ marginTop: 3 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.4, display: 'block' }}>
                        {d.title}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11, color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                        <span>{d.source || '来源未标注'}</span>
                        <span>·</span>
                        <span>{d.publishedAt ? new Date(d.publishedAt).toLocaleDateString('zh-CN') : '未识别真实日期'}</span>
                        {d.url && (
                          <>
                            <span>·</span>
                            <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-brand-strong)', textDecoration: 'none' }}>
                              原文 ↗
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 原文摘录预览 */}
                  {d.text && (
                    <div
                      style={{
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: 'var(--color-text-secondary)',
                        background: 'var(--color-page)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        padding: '8px 10px',
                        maxHeight: 90,
                        overflowY: 'auto'
                      }}
                    >
                      {d.text}
                    </div>
                  )}

                  {/* AI 研判结果卡片 */}
                  {d.analysis && (
                    <div
                      style={{
                        background: isRelevant ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${isRelevant ? '#bbf7d0' : '#fecaca'}`,
                        borderRadius: 4,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        fontSize: 12
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                        <span
                          style={{
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 3,
                            background: isRelevant ? '#dcfce7' : '#fee2e2',
                            color: isRelevant ? '#15803d' : '#991b1b',
                            border: `1px solid ${isRelevant ? '#bbf7d0' : '#fecaca'}`
                          }}
                        >
                          {isRelevant ? '命中 AI 安全合规' : '研判与 AI 无关'}
                        </span>
                        {d.analysis.category && (
                          <span style={{ fontSize: 11, color: 'var(--color-brand-strong)', fontWeight: 600 }}>
                            【{d.analysis.category}】{d.analysis.tags?.slice(0, 3).join(' · ')}
                          </span>
                        )}
                      </div>

                      {d.analysis.summary && (
                        <p style={{ margin: 0, color: 'var(--color-text)', lineHeight: 1.4 }}>
                          {d.analysis.summary}
                        </p>
                      )}

                      {d.analysis.impact && (
                        <div style={{ fontSize: 11, color: 'var(--color-brand-strong)' }}>
                          <strong>业务影响：</strong>{d.analysis.impact}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 底部动作卡条 */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                    {isImported ? (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 3,
                          background: '#f0fdf4',
                          color: '#15803d',
                          border: '1px solid #bbf7d0'
                        }}
                      >
                        已持久化入库
                      </span>
                    ) : (
                      <button
                        className="button button--primary"
                        type="button"
                        disabled={busy || !isAnalyzed || isRelevant === false}
                        onClick={() =>
                          run(async () => {
                            setStatus(`正在将【${d.title}】保存至本地资讯库…`);
                            const result = await call({ action: 'save', id: d.id });
                            replace({ ...d, articleId: result.articleId });
                            setStatus('已成功入库！');
                          })
                        }
                        style={{ padding: '4px 10px', fontSize: 11 }}
                      >
                        确认入库
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
