"use client";

import { useEffect, useState, useMemo } from 'react';
import ManualCollection from './ManualCollection';

const DEFAULT_AI_KEYWORDS = 'AI, Artificial Intelligence, Machine Learning, LLM, Generative AI, Deepfake, 算法, 人工智能, 大模型';
const DEFAULT_WECHAT_KEYWORDS = 'AI, 大模型, 模型, 安全, 治理, 合规, 漏洞, 算法, 深度伪造, 备案, 风险, 幻觉, 注入, 数据安全';

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
    category: '微信公众号',
    description: '',
    filterKeywords: DEFAULT_WECHAT_KEYWORDS,
    cadence: '每天',
    enabled: 1
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // 微信公众号 WeRSS 相关状态
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrStatusText, setQrStatusText] = useState('');
  const [qrStatusType, setQrStatusType] = useState('idle'); // idle | waiting | scanned | success | error

  const [wechatModalOpen, setWechatModalOpen] = useState(false);
  const [wechatSearchKw, setWechatSearchKw] = useState('');
  const [wechatSearching, setWechatSearching] = useState(false);
  const [wechatResults, setWechatResults] = useState([]);
  const [wechatKeywords, setWechatKeywords] = useState(DEFAULT_WECHAT_KEYWORDS);
  const [subscribingId, setSubscribingId] = useState(null);
  const [wechatSubSuccess, setWechatSubSuccess] = useState('');
  const [wechatManualMode, setWechatManualMode] = useState(false);
  const [wechatManualFeed, setWechatManualFeed] = useState({
    name: '',
    url: '',
    description: '',
    filterKeywords: DEFAULT_WECHAT_KEYWORDS
  });

  const categories = ['全部', '微信公众号', '监管政策', 'AI安全', '头部厂商', '行业资讯'];

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

  async function handleDelete(id, name, isWechat = false) {
    const confirmMsg = isWechat ? `确定取消订阅公众号【${name}】吗？` : `确定要删除订阅源【${name}】吗？`;
    if (!confirm(confirmMsg)) return;
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sources?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('操作失败');
      setSources(prev => prev.filter(s => s.id !== id));
      setMessage(isWechat ? `已成功取消订阅公众号【${name}】` : `已成功删除【${name}】`);
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

  // 微信公众平台扫码相关
  async function fetchQrCode() {
    setQrLoading(true);
    setQrStatusType('waiting');
    setQrStatusText('正在生成微信公众平台授权二维码…');
    try {
      const res = await fetch('/api/wechat?action=qr');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '获取二维码失败，请确认 WeRSS 运行状态');
      }
      if (data.qrDataUrl) {
        setQrDataUrl(data.qrDataUrl);
        setQrStatusText('请使用微信扫码授权（需开通过微信公众平台的账号）');
      } else {
        throw new Error('未获取到有效二维码图片');
      }
    } catch (e) {
      setQrStatusType('error');
      setQrStatusText(e.message || '获取二维码失败');
    } finally {
      setQrLoading(false);
    }
  }

  function openQrModal() {
    setQrModalOpen(true);
    setQrDataUrl('');
    fetchQrCode();
  }

  // 微信扫码状态轮询
  useEffect(() => {
    let timer = null;
    if (qrModalOpen && qrStatusType !== 'success') {
      timer = setInterval(async () => {
        try {
          const res = await fetch('/api/wechat?action=status');
          if (res.ok) {
            const data = await res.json();
            const s = data.data;
            if (s) {
              if (s.is_login || s.status === 'success' || s.status === 'ok') {
                setQrStatusType('success');
                setQrStatusText('✅ 微信公众平台授权成功！账号已就绪。');
                clearInterval(timer);
              } else if (s.status === 'scanned' || (s.msg && s.msg.includes('扫码'))) {
                setQrStatusType('scanned');
                setQrStatusText('📲 已扫描二维码，请在手机微信端点击【确认登录】');
              } else if (s.status === 'expired') {
                setQrStatusType('error');
                setQrStatusText('⏰ 二维码已失效，请点击刷新');
              }
            }
          }
        } catch {
          // ignore network hiccups
        }
      }, 2500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [qrModalOpen, qrStatusType]);

  // 微信公众号订阅 Modal 控制
  function openWechatModal() {
    setWechatSearchKw('');
    setWechatResults([]);
    setWechatSubSuccess('');
    setWechatManualMode(false);
    setWechatKeywords(DEFAULT_WECHAT_KEYWORDS);
    setWechatManualFeed({
      name: '',
      url: '',
      description: '',
      filterKeywords: DEFAULT_WECHAT_KEYWORDS
    });
    setWechatModalOpen(true);
  }

  async function handleSearchWechat(e) {
    if (e) e.preventDefault();
    const kw = wechatSearchKw.trim();
    if (!kw) return;
    setWechatSearching(true);
    setWechatSubSuccess('');
    try {
      const res = await fetch('/api/wechat?action=search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kw })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '检索公众号失败');
      }
      setWechatResults(data.data || []);
      if (!data.data || data.data.length === 0) {
        setMessage('未搜索到公众号，请检查名称或切换至下方手动添加');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setWechatSearching(false);
    }
  }

  async function handleSubscribeMp(mp) {
    const mpId = mp.mp_id || mp.fakeid || mp.id || mp.nickname || mp.name;
    const mpName = mp.mp_name || mp.nickname || mp.name;
    const mpCover = mp.mp_cover || mp.avatar || mp.round_head_img || '';
    const mpIntro = mp.mp_intro || mp.signature || '';

    setSubscribingId(mpId);
    try {
      const res = await fetch('/api/wechat?action=subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: mpId,
          name: mpName,
          cover: mpCover,
          intro: mpIntro,
          filterKeywords: wechatKeywords
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '订阅公众号失败');
      }
      if (data.feed) {
        setSources(prev => {
          const exists = prev.some(s => s.id === data.feed.id);
          return exists ? prev.map(s => s.id === data.feed.id ? data.feed : s) : [data.feed, ...prev];
        });
        setWechatSubSuccess(`已成功订阅【${mpName}】！已自动开启 AI 安全关键词门禁。`);
        setTimeout(() => setWechatSubSuccess(''), 4000);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubscribingId(null);
    }
  }

  async function handleSaveManualWechatFeed(e) {
    e.preventDefault();
    if (!wechatManualFeed.name.trim() || !wechatManualFeed.url.trim()) {
      alert('公众号名称与订阅地址均为必填项');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          feed: {
            ...wechatManualFeed,
            category: '微信公众号',
            cadence: '每天',
            enabled: 1
          }
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '保存订阅源失败');
      }
      const data = await res.json();
      setSources(prev => [data.feed, ...prev]);
      setMessage(`已成功订阅公众号【${data.feed.name}】`);
      setWechatModalOpen(false);
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
    <div className="source-manager-full" style={{ width: '100%', maxWidth: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 顶部订阅配置中心卡片 */}
      <div className="panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, color: '#fff' }}>
              RSS 订阅源
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="button button--secondary" type="button" onClick={handleReset} disabled={busy}>
              ⚡ 恢复官方预置
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={openQrModal}
              disabled={busy}
              style={{
                background: 'rgba(34,197,94,.12)',
                color: '#4ade80',
                border: '1px solid rgba(34,197,94,.4)',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              📱 微信扫码绑定
            </button>
            <button
              className="button"
              type="button"
              onClick={openWechatModal}
              disabled={busy}
              style={{
                background: 'rgba(34,197,94,.22)',
                color: '#86efac',
                border: '1px solid rgba(34,197,94,.55)',
                fontWeight: 600
              }}
            >
              ＋ 订阅微信公众号
            </button>
            <button className="button button--primary" type="button" onClick={openAddModal} disabled={busy}>
              ＋ 新增 RSS 订阅
            </button>
          </div>
        </div>

        {/* WeRSS 微信公众号服务状态条 */}
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: 'rgba(34,197,94,.06)',
          border: '1px solid rgba(34,197,94,.22)',
          borderRadius: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#e2e8f0' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }}></span>
            <strong>微信公众号转换服务 (WeRSS)</strong>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>已在 NAS 运行 ｜ 支持免跳出微信扫码与公众号搜索订阅</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={openQrModal}
              style={{
                fontSize: 12,
                color: '#4ade80',
                border: '1px solid rgba(34,197,94,.4)',
                padding: '4px 10px',
                borderRadius: 4,
                background: 'rgba(34,197,94,.12)',
                cursor: 'pointer'
              }}
            >
              📱 微信扫码授权
            </button>
            <a
              href="https://wewe.wilsongo.top"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: 'var(--color-text-muted)',
                textDecoration: 'none',
                border: '1px solid var(--color-border)',
                padding: '4px 10px',
                borderRadius: 4,
                background: 'rgba(255,255,255,.05)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              打开 WeRSS 后台 ↗
            </a>
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
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>当前分类下暂无订阅源，可点击上方「＋ 订阅微信公众号」或「恢复官方预置」。</div>
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
                      <span
                        className="badge badge--neutral"
                        style={{
                          fontSize: 11,
                          background: source.category === '微信公众号' ? 'rgba(34,197,94,.15)' : undefined,
                          color: source.category === '微信公众号' ? '#4ade80' : undefined,
                          borderColor: source.category === '微信公众号' ? 'rgba(34,197,94,.35)' : undefined
                        }}
                      >
                        {source.category}
                      </span>
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
                    <span style={{ color: 'var(--color-brand)' }}>关键词筛选：</span>
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
                        style={{
                          padding: '6px 10px',
                          fontSize: 12,
                          color: '#ff6b72',
                          background: 'transparent',
                          border: '1px solid rgba(255,93,103,.3)',
                          borderRadius: 3,
                          cursor: 'pointer'
                        }}
                        onClick={() => handleDelete(source.id, source.name, source.category === '微信公众号')}
                      >
                        {source.category === '微信公众号' ? '取消订阅' : '删除'}
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

      {/* 微信公众平台扫码授权绑定 Modal */}
      {qrModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 10, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 16px 40px rgba(0,0,0,.7)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ fontSize: 17, color: '#fff' }}>微信公众平台授权绑定</strong>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>扫码后 WeRSS 将通过公众平台接口检索并转换文章</p>
              </div>
              <button type="button" onClick={() => setQrModalOpen(false)} style={{ background: 'transparent', border: 0, color: 'var(--color-text-muted)', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>

            {/* 二维码展示区域 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 230, padding: '16px 0' }}>
              {qrLoading ? (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>正在加载二维码…</div>
              ) : qrDataUrl ? (
                <div style={{ background: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.3)' }}>
                  <img src={qrDataUrl} alt="WeRSS 微信授权二维码" style={{ width: 200, height: 200, display: 'block' }} />
                </div>
              ) : (
                <div style={{ color: '#ff6b72', fontSize: 14 }}>{qrStatusText || '暂无二维码'}</div>
              )}

              {/* 实时状态提示 */}
              <div style={{
                marginTop: 16,
                fontSize: 13,
                padding: '6px 14px',
                borderRadius: 4,
                background: qrStatusType === 'success' ? 'rgba(34,197,94,.15)' : qrStatusType === 'error' ? 'rgba(255,93,103,.15)' : 'rgba(35,136,255,.15)',
                color: qrStatusType === 'success' ? '#4ade80' : qrStatusType === 'error' ? '#ff858d' : '#8ec5fc',
                border: '1px solid',
                borderColor: qrStatusType === 'success' ? 'rgba(34,197,94,.3)' : qrStatusType === 'error' ? 'rgba(255,93,103,.3)' : 'rgba(35,136,255,.3)'
              }}>
                {qrStatusText || '等待微信扫码…'}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'left', lineHeight: 1.5, marginTop: 8 }}>
              💡 <strong>提示：</strong> 请使用已在微信公众平台注册（个人订阅号即可，微信官方免费秒开通）的微信号扫码确认。
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
              <button className="button button--secondary" type="button" onClick={fetchQrCode} disabled={qrLoading} style={{ fontSize: 13 }}>
                🔄 刷新二维码
              </button>
              <button className="button button--primary" type="button" onClick={() => setQrModalOpen(false)} style={{ fontSize: 13 }}>
                {qrStatusType === 'success' ? '完成' : '关闭'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 订阅微信公众号 Modal (带搜索 + 关键词门禁) */}
      {wechatModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 8, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 16px 40px rgba(0,0,0,.65)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
              <div>
                <strong style={{ fontSize: 18, color: '#fff' }}>订阅微信公众号</strong>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>检索公众号一键订阅并配置 AI 安全合规关键词门禁</p>
              </div>
              <button type="button" onClick={() => setWechatModalOpen(false)} style={{ background: 'transparent', border: 0, color: 'var(--color-text-muted)', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>

            {wechatSubSuccess && (
              <div style={{ background: 'rgba(34,197,94,.15)', borderLeft: '3px solid #22c55e', padding: '10px 14px', borderRadius: 4, marginTop: 14, fontSize: 13, color: '#86efac' }}>
                {wechatSubSuccess}
              </div>
            )}

            {!wechatManualMode ? (
              <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
                {/* 搜索框 */}
                <form onSubmit={handleSearchWechat} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    required
                    placeholder="输入微信公众号名称（例如：量子位、网信中国、机器之心）"
                    value={wechatSearchKw}
                    onChange={e => setWechatSearchKw(e.target.value)}
                    style={{ flex: 1, minHeight: 38, padding: '8px 12px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#fff', fontSize: 14 }}
                  />
                  <button className="button button--primary" type="submit" disabled={wechatSearching} style={{ whiteSpace: 'nowrap', padding: '0 18px' }}>
                    {wechatSearching ? '搜索中…' : '🔍 搜索公众号'}
                  </button>
                </form>

                {/* AI 安全合规门禁设置 */}
                <div style={{ background: 'rgba(35,136,255,.05)', border: '1px solid rgba(35,136,255,.2)', borderRadius: 6, padding: '12px 14px', display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#93c5fd' }}>🎯 关键词筛选门禁（仅同步符合以下特征的推文）：</span>
                    <button
                      type="button"
                      onClick={() => setWechatKeywords(DEFAULT_WECHAT_KEYWORDS)}
                      style={{ background: 'transparent', border: 0, color: 'var(--color-brand)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                    >
                      填入推荐词
                    </button>
                  </div>
                  <input
                    type="text"
                    value={wechatKeywords}
                    onChange={e => setWechatKeywords(e.target.value)}
                    placeholder="留空全量接收，输入关键词以逗号分隔"
                    style={{ minHeight: 34, padding: '6px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#fff', fontSize: 12 }}
                  />
                  <small style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                    微信公众号推文通常涵盖科技、硬件或日常动态，配置关键词筛选后，未提及 AI/大模型/安全/合规 的推文将被自动剔除。
                  </small>
                </div>

                {/* 搜索结果列表 */}
                {wechatSearching ? (
                  <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>正在微信公众平台检索…</div>
                ) : wechatResults.length > 0 ? (
                  <div style={{ display: 'grid', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                    {wechatResults.map(mp => {
                      const id = mp.mp_id || mp.fakeid || mp.id || mp.nickname || mp.name;
                      const name = mp.mp_name || mp.nickname || mp.name;
                      const cover = mp.mp_cover || mp.avatar || mp.round_head_img;
                      const intro = mp.mp_intro || mp.signature || '';
                      const isSubscribing = subscribingId === id;

                      return (
                        <div
                          key={id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 14px',
                            background: 'var(--color-surface-strong)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 6
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            {cover ? (
                              <img src={cover} alt={name} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', background: '#333' }} />
                            ) : (
                              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(34,197,94,.2)', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {name.slice(0, 1)}
                              </div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ fontSize: 14, color: '#fff', display: 'block' }}>{name}</strong>
                              {intro && <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{intro}</span>}
                            </div>
                          </div>
                          <button
                            className="button button--primary"
                            type="button"
                            onClick={() => handleSubscribeMp(mp)}
                            disabled={isSubscribing}
                            style={{
                              padding: '6px 14px',
                              fontSize: 12,
                              whiteSpace: 'nowrap',
                              background: 'rgba(34,197,94,.2)',
                              color: '#86efac',
                              borderColor: 'rgba(34,197,94,.5)'
                            }}
                          >
                            {isSubscribing ? '正在订阅…' : '＋ 一键订阅'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                    输入公众号名称并点击「搜索」，直接一键加入雷达监控。
                  </div>
                )}

                {/* 切换到手动添加 */}
                <div style={{ textAlign: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setWechatManualMode(true)}
                    style={{ background: 'transparent', border: 0, color: '#86beff', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}
                  >
                    找不到公众号？切换为手动输入微信 RSS 链接添加 ↗
                  </button>
                </div>
              </div>
            ) : (
              /* 手动输入公众号 RSS 模式 */
              <form onSubmit={handleSaveManualWechatFeed} style={{ display: 'grid', gap: 14, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#93c5fd' }}>手动配置微信公众号 Feed</span>
                  <button
                    type="button"
                    onClick={() => setWechatManualMode(false)}
                    style={{ background: 'transparent', border: 0, color: 'var(--color-brand)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}
                  >
                    ← 返回搜索公众号
                  </button>
                </div>

                <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  <span>公众号名称 <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
                  <input
                    type="text"
                    required
                    placeholder="例如：网信中国、量子位"
                    value={wechatManualFeed.name}
                    onChange={e => setWechatManualFeed({ ...wechatManualFeed, name: e.target.value })}
                    style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#fff' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  <span>微信公众号 RSS 地址 <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
                  <input
                    type="url"
                    required
                    placeholder="https://wewe.wilsongo.top/feed/xxxxxx.xml"
                    value={wechatManualFeed.url}
                    onChange={e => setWechatManualFeed({ ...wechatManualFeed, url: e.target.value })}
                    style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#fff' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  <span>关键词筛选（逗号分隔）</span>
                  <input
                    type="text"
                    value={wechatManualFeed.filterKeywords}
                    onChange={e => setWechatManualFeed({ ...wechatManualFeed, filterKeywords: e.target.value })}
                    style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#fff' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  <span>说明备注</span>
                  <input
                    type="text"
                    placeholder="例如：行业合规资讯"
                    value={wechatManualFeed.description}
                    onChange={e => setWechatManualFeed({ ...wechatManualFeed, description: e.target.value })}
                    style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#fff' }}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
                  <button className="button button--secondary" type="button" onClick={() => setWechatModalOpen(false)}>
                    取消
                  </button>
                  <button className="button button--primary" type="submit" disabled={busy}>
                    {busy ? '正在保存…' : '保存订阅'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 常规新增 / 编辑订阅源 Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 8, maxWidth: 580, width: '100%', padding: 24, boxShadow: '0 12px 36px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
              <strong style={{ fontSize: 18, color: '#fff' }}>
                {editingFeed ? '编辑 RSS 订阅源' : '新增 RSS 订阅源'}
              </strong>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 0, color: 'var(--color-text-muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSaveFeed} style={{ display: 'grid', gap: 14, marginTop: 16 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                <span>来源名称 <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
                <input
                  type="text"
                  required
                  placeholder="例如：NIST AI 风险框架动态、OpenAI 安全博客"
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
                    onChange={e => setFormData({
                      ...formData,
                      category: e.target.value,
                      filterKeywords: e.target.value === '微信公众号' ? DEFAULT_WECHAT_KEYWORDS : formData.filterKeywords
                    })}
                    style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#fff' }}
                  >
                    <option value="微信公众号">微信公众号</option>
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
                  <span>关键词筛选（逗号分隔）</span>
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      filterKeywords: formData.category === '微信公众号' ? DEFAULT_WECHAT_KEYWORDS : DEFAULT_AI_KEYWORDS
                    })}
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
                  配置关键词筛选后，仅抓取命中关键词的推文或文章，避免产生无关噪音。
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
