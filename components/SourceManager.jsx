"use client";

import { useEffect, useState, useMemo } from 'react';
import ManualCollection from './ManualCollection';

const DEFAULT_AI_KEYWORDS = 'AI, Artificial Intelligence, Machine Learning, LLM, Generative AI, Deepfake, 算法, 人工智能, 大模型';

export default function SourceManager() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFeed, setEditingFeed] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    category: '监管政策',
    description: '',
    filterKeywords: DEFAULT_AI_KEYWORDS,
    cadence: '每天',
    enabled: 1
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const categories = ['全部', '监管政策', 'AI安全', '头部厂商', '行业资讯'];

  async function loadSources() {
    setLoading(true);
    try {
      const res = await fetch('/api/sources');
      if (!res.ok) throw new Error('拉取订阅列表失败');
      const data = await res.json();
      setSources(data.sources || []);
    } catch (e) {
      setError(e.message || '加载订阅列表失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  const filteredSources = useMemo(() => {
    if (activeCategory === '全部') return sources;
    return sources.filter(s => s.category === activeCategory);
  }, [sources, activeCategory]);

  const enabledCount = useMemo(() => sources.filter(s => s.enabled === 1).length, [sources]);

  async function handleToggle(id, currentEnabled) {
    if (busy) return;
    setBusy(true);
    try {
      const next = currentEnabled === 1 ? 0 : 1;
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id, enabled: next })
      });
      if (!res.ok) throw new Error('切换状态失败');
      const data = await res.json();
      setSources(prev => prev.map(s => s.id === id ? data.feed : s));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`确定要删除订阅源【${name}】吗？`)) return;
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sources?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      setSources(prev => prev.filter(s => s.id !== id));
      setMessage(`已成功删除【${name}】`);
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!confirm('确定要恢复官方精选预置源吗？这将重置所有默认订阅源。')) return;
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      if (!res.ok) throw new Error('重置预置源失败');
      const data = await res.json();
      setSources(data.sources || []);
      setMessage('已成功恢复官方预置订阅源！');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function openAddModal() {
    setEditingFeed(null);
    setFormData({
      name: '',
      url: '',
      category: '监管政策',
      description: '',
      filterKeywords: DEFAULT_AI_KEYWORDS,
      cadence: '每天',
      enabled: 1
    });
    setModalOpen(true);
  }

  function openEditModal(feed) {
    setEditingFeed(feed);
    setFormData({
      id: feed.id,
      name: feed.name || '',
      url: feed.url || '',
      category: feed.category || '监管政策',
      description: feed.description || '',
      filterKeywords: feed.filterKeywords || '',
      cadence: feed.cadence || '每天',
      enabled: feed.enabled ?? 1
    });
    setModalOpen(true);
  }

  async function handleSaveFeed(e) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.url.trim()) {
      alert('来源名称与订阅地址均为必填项');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', feed: formData })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '保存订阅源失败');
      }
      const data = await res.json();
      if (editingFeed) {
        setSources(prev => prev.map(s => s.id === data.feed.id ? data.feed : s));
        setMessage(`已更新【${data.feed.name}】`);
      } else {
        setSources(prev => [data.feed, ...prev]);
        setMessage(`已新增订阅【${data.feed.name}】`);
      }
      setModalOpen(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  function triggerCollect(source) {
    window.dispatchEvent(new CustomEvent('trigger-feed-collection', {
      detail: {
        feedId: source.id,
        url: source.url,
        name: source.name,
        filterKeywords: source.filterKeywords
      }
    }));
  }

  return (
    <div className="source-config-page" style={{ display: 'grid', gap: 20 }}>
      {/* 顶部订阅配置中心卡片 */}
      <div className="panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-brand)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              情报信源中心 · NAS 持久化
            </div>
            <h2 style={{ margin: '6px 0 0', fontSize: 22, color: '#fff' }}>
              官方权威与自定义 RSS 订阅
            </h2>
            <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              支持国内外监管合规、AI安全攻防与大模型实验室订阅管理，内置双层 AI 安全过滤，剔除非 AI 干扰。
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="button button--secondary" type="button" onClick={handleReset} disabled={busy}>
              ⚡ 恢复官方预置
            </button>
            <button className="button button--primary" type="button" onClick={openAddModal} disabled={busy}>
              ＋ 新增 RSS 订阅
            </button>
          </div>
        </div>

        {message && <div style={{ background: 'rgba(35,136,255,.15)', borderLeft: '3px solid var(--color-brand)', padding: '10px 14px', borderRadius: 4, marginTop: 14, fontSize: 13, color: '#eaf3ff' }}>{message}</div>}
        {error && <div style={{ background: 'rgba(255,93,103,.15)', borderLeft: '3px solid var(--color-danger)', padding: '10px 14px', borderRadius: 4, marginTop: 14, fontSize: 13, color: '#ffadb3' }}>{error}</div>}

        {/* 统计概览 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, margin: '20px 0 16px' }}>
          <div style={{ background: 'var(--color-surface-strong)', padding: '12px 16px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>已配置信源</span>
            <strong style={{ display: 'block', fontSize: 20, marginTop: 4 }}>{sources.length} 个</strong>
          </div>
          <div style={{ background: 'var(--color-surface-strong)', padding: '12px 16px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>正常启用中</span>
            <strong style={{ display: 'block', fontSize: 20, marginTop: 4, color: '#6be6a8' }}>{enabledCount} 个</strong>
          </div>
          <div style={{ background: 'var(--color-surface-strong)', padding: '12px 16px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>已暂停源</span>
            <strong style={{ display: 'block', fontSize: 20, marginTop: 4, color: 'var(--color-text-muted)' }}>{sources.length - enabledCount} 个</strong>
          </div>
        </div>

        {/* 分类筛选 Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {categories.map(cat => {
            const count = cat === '全部' ? sources.length : sources.filter(s => s.category === cat).length;
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 4,
                  fontSize: 13,
                  border: '1px solid',
                  borderColor: active ? 'var(--color-brand)' : 'var(--color-border)',
                  background: active ? 'var(--color-brand-soft)' : 'var(--color-surface-strong)',
                  color: active ? '#a6d2ff' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>{cat}</span>
                <span style={{ fontSize: 11, padding: '1px 5px', borderRadius: 10, background: active ? 'rgba(35,136,255,.3)' : 'rgba(255,255,255,.08)' }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 订阅源列表 */}
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>正在加载 NAS 订阅源…</div>
        ) : filteredSources.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>当前分类下暂无订阅源，可点击上方「＋ 新增」或「恢复官方预置」。</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filteredSources.map(source => {
              const keywords = source.filterKeywords
                ? source.filterKeywords.split(/[,，\n|]/).map(k => k.trim()).filter(Boolean)
                : [];
              const isEnabled = source.enabled === 1;

              return (
                <div
                  key={source.id}
                  style={{
                    background: isEnabled ? 'rgba(10, 34, 55, 0.45)' : 'rgba(5, 13, 23, 0.3)',
                    border: '1px solid',
                    borderColor: isEnabled ? 'var(--color-border)' : 'rgba(20, 48, 74, 0.4)',
                    borderRadius: 6,
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    opacity: isEnabled ? 1 : 0.65,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* 标题行 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 16, color: '#fff' }}>{source.name}</strong>
                      <span className="badge badge--neutral" style={{ fontSize: 11 }}>{source.category}</span>
                      {source.cadence && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>频率: {source.cadence}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleToggle(source.id, source.enabled)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 3,
                          fontSize: 12,
                          border: '1px solid',
                          borderColor: isEnabled ? '#409aff' : 'var(--color-border)',
                          background: isEnabled ? 'rgba(35,136,255,.2)' : 'rgba(255,255,255,.05)',
                          color: isEnabled ? '#a6d2ff' : 'var(--color-text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        {isEnabled ? '● 已启用' : '○ 已暂停'}
                      </button>
                    </div>
                  </div>

                  {/* 简介与链接 */}
                  {source.description && (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {source.description}
                    </p>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6, overflowWrap: 'anywhere' }}>
                    <span>订阅地址:</span>
                    <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: '#86beff', textDecoration: 'underline' }}>
                      {source.url}
                    </a>
                  </div>

                  {/* 过滤关键词标签 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
                    <span style={{ color: 'var(--color-brand)' }}>🎯 AI去噪门禁:</span>
                    {keywords.length > 0 ? (
                      keywords.map(kw => (
                        <span key={kw} style={{ background: 'rgba(35,136,255,.12)', color: '#8ec5fc', padding: '1px 6px', borderRadius: 3, fontSize: 11, border: '1px solid rgba(35,136,255,.25)' }}>
                          {kw}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>全量接收（无关键词限制）</span>
                    )}
                  </div>

                  {/* 底部操作行 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderTop: '1px solid rgba(20,48,74,.5)', paddingTop: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {source.lastFetchedAt ? `上次采集: ${new Date(source.lastFetchedAt).toLocaleString('zh-CN')}` : '尚未开始采集'}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="button button--primary"
                        type="button"
                        style={{ padding: '6px 14px', fontSize: 12 }}
                        onClick={() => triggerCollect(source)}
                        disabled={!isEnabled}
                      >
                        ⚡ 立即采集最新
                      </button>
                      <button
                        className="button button--secondary"
                        type="button"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => openEditModal(source)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        style={{ padding: '6px 10px', fontSize: 12, color: '#ff6b72', background: 'transparent', border: '1px solid rgba(255,93,103,.3)', borderRadius: 3, cursor: 'pointer' }}
                        onClick={() => handleDelete(source.id, source.name)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 下方嵌入智能采集与审阅工作区 */}
      <ManualCollection />

      {/* 新增 / 编辑订阅源 Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 8, maxWidth: 580, width: '100%', padding: 24, boxShadow: '0 12px 36px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
              <strong style={{ fontSize: 18, color: '#fff' }}>{editingFeed ? '编辑 RSS 订阅源' : '新增 RSS 订阅源'}</strong>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 0, color: 'var(--color-text-muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSaveFeed} style={{ display: 'grid', gap: 14, marginTop: 16 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                <span>来源名称 <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
                <input
                  type="text"
                  required
                  placeholder="例如：NIST AI 风险框架动态"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#fff' }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                <span>RSS / Atom 订阅地址 <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/feed.xml"
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#fff' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  <span>分类</span>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#fff' }}
                  >
                    <option value="监管政策">监管政策</option>
                    <option value="AI安全">AI安全</option>
                    <option value="头部厂商">头部厂商</option>
                    <option value="行业资讯">行业资讯</option>
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  <span>采集频率</span>
                  <select
                    value={formData.cadence}
                    onChange={e => setFormData({ ...formData, cadence: e.target.value })}
                    style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#fff' }}
                  >
                    <option value="每天">每天</option>
                    <option value="每周">每周</option>
                    <option value="手动">手动</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🎯 AI安全去噪关键词（逗号分隔）</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, filterKeywords: DEFAULT_AI_KEYWORDS })}
                    style={{ background: 'transparent', border: 0, color: 'var(--color-brand)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                  >
                    填入推荐词
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="留空则全量接收；填写后仅抓取匹配标题/摘要的文章"
                  value={formData.filterKeywords}
                  onChange={e => setFormData({ ...formData, filterKeywords: e.target.value })}
                  style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#fff' }}
                />
                <small style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                  如 CISA 等大型综合通报，配置此项可自动阻断非 AI 漏洞，节约流量与 DeepSeek 额度。
                </small>
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                <span>信源说明</span>
                <input
                  type="text"
                  placeholder="如：官方指南、合规动态"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#fff' }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.enabled === 1}
                  onChange={e => setFormData({ ...formData, enabled: e.target.checked ? 1 : 0 })}
                />
                <span>立即启用该订阅源</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
                <button className="button button--secondary" type="button" onClick={() => setModalOpen(false)}>
                  取消
                </button>
                <button className="button button--primary" type="submit" disabled={busy}>
                  {busy ? '正在保存…' : '保存订阅源'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
