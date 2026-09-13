"use client";

import { useEffect, useState, useMemo } from 'react';
import CollectionDrawer from './CollectionDrawer';

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
  const [justSubscribed, setJustSubscribed] = useState(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSource, setDrawerSource] = useState(null);
  const [wechatManualMode, setWechatManualMode] = useState(false);
  const [wechatManualFeed, setWechatManualFeed] = useState({
    name: '',
    url: '',
    description: '',
    filterKeywords: DEFAULT_WECHAT_KEYWORDS
  });

  // X / Twitter 专属快速订阅状态
  const [twitterModalOpen, setTwitterModalOpen] = useState(false);
  const [twitterInput, setTwitterInput] = useState('');
  const [twitterName, setTwitterName] = useState('');
  const [twitterDescription, setTwitterDescription] = useState('');
  const [twitterKeywords, setTwitterKeywords] = useState('');
  const [twitterType, setTwitterType] = useState('user'); // 'user' | 'list'

  // 全自动采集调度状态
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [schedulerModalOpen, setSchedulerModalOpen] = useState(false);
  const [schedulerConfigForm, setSchedulerConfigForm] = useState({
    enabled: true,
    intervalHours: 4,
    autoAiAnalyze: true,
    autoImportRelevant: true,
    scanGithubTrending: true
  });

  const categories = ['全部', '法规政策', '安全产品突破', '违规处罚与事件', '行业动态', '微信公众号', 'X/Twitter'];

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

  async function fetchSchedulerStatus() {
    try {
      const res = await fetch('/api/scheduler');
      if (res.ok) {
        const data = await res.json();
        const info = data.data;
        setSchedulerStatus(info);
        if (info?.config) {
          setSchedulerConfigForm({
            enabled: info.config.enabled !== false,
            intervalHours: info.config.intervalHours || 4,
            autoAiAnalyze: info.config.autoAiAnalyze !== false,
            autoImportRelevant: info.config.autoImportRelevant !== false,
            scanGithubTrending: info.config.scanGithubTrending !== false
          });
        }
      }
    } catch {}
  }

  async function handleTriggerScheduler() {
    if (schedulerLoading || schedulerStatus?.isCollecting) return;
    setSchedulerLoading(true);
    try {
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || '触发失败');
      setMessage('全源自动采集与AI研判任务已在后台启动！');
      fetchSchedulerStatus();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSchedulerLoading(false);
    }
  }

  async function handleTriggerGithubScan() {
    if (schedulerLoading || schedulerStatus?.isCollecting) return;
    setSchedulerLoading(true);
    try {
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_github' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || '触发失败');
      setMessage('GitHub AI 安全开源趋势扫描与研判任务已在后台启动！');
      fetchSchedulerStatus();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSchedulerLoading(false);
    }
  }

  async function handleSaveSchedulerConfig(e) {
    e.preventDefault();
    setSchedulerLoading(true);
    try {
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_config',
          config: schedulerConfigForm
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || '保存失败');
      setSchedulerStatus(data.status);
      setSchedulerModalOpen(false);
      setMessage('定时采集调度配置已成功更新！');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSchedulerLoading(false);
    }
  }

  useEffect(() => {
    loadSources();
    fetchSchedulerStatus();
  }, []);

  // 当处于采集中时，自动每 2.5 秒轮询进度
  useEffect(() => {
    let timer = null;
    if (schedulerStatus?.isCollecting) {
      timer = setInterval(() => {
        fetchSchedulerStatus();
      }, 2500);
    } else {
      // 采集结束时刷新一下信源列表，更新最新采集时间
      loadSources();
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [schedulerStatus?.isCollecting]);

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
    setQrDataUrl('');
    setQrStatusType('waiting');
    setQrStatusText('正在生成微信公众平台授权二维码（约 2-3 秒）…');
    try {
      const res = await fetch('/api/wechat?action=qr');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '获取二维码失败，请确认 WeRSS 运行状态');
      }
      if (data.qrDataUrl) {
        setQrDataUrl(data.qrDataUrl);
        setQrStatusType('waiting');
        setQrStatusText('请使用微信扫一扫确认授权（需开通过微信公众平台）');
      } else {
        throw new Error('未获取到有效二维码图片');
      }
    } catch (e) {
      setQrStatusType('error');
      setQrStatusText(e.message || '获取二维码失败，请点击下方刷新');
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
                setQrStatusText('微信公众平台授权成功！账号已就绪。');
                clearInterval(timer);
              } else if (s.status === 'scanned' || (s.msg && s.msg.includes('扫码'))) {
                setQrStatusType('scanned');
                setQrStatusText('已扫描二维码，请在手机微信端点击【确认登录】');
              } else if (s.status === 'expired') {
                setQrStatusType('error');
                setQrStatusText('二维码已失效，请点击刷新');
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
        setJustSubscribed(prev => {
          const next = new Set(prev);
          next.add(mpId);
          next.add(mpName);
          if (mp.fakeid) next.add(mp.fakeid);
          return next;
        });
        setWechatSubSuccess(`已成功订阅【${mpName}】！已加入雷达情报库并开启 AI 关键词门禁。`);
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
    setDrawerSource(source);
    setDrawerOpen(true);
  }

  function openTwitterModal() {
    setTwitterInput('');
    setTwitterName('');
    setTwitterDescription('');
    setTwitterKeywords('');
    setTwitterType('user');
    setTwitterModalOpen(true);
  }

  // 自动根据输入计算 RSSHub 订阅地址
  const generatedTwitterRss = useMemo(() => {
    const raw = twitterInput.trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      if (raw.includes('rss.wilsongo.top')) return raw;
      const listMatch = raw.match(/lists\/(\d+)/i);
      if (listMatch) return `https://rss.wilsongo.top/twitter/list/${listMatch[1]}`;
      const userMatch = raw.match(/(?:x|twitter)\.com\/([a-zA-Z0-9_]+)/i);
      if (userMatch) return `https://rss.wilsongo.top/twitter/user/${userMatch[1]}`;
    }
    if (twitterType === 'list') {
      const cleanListId = raw.replace(/\D/g, '');
      return cleanListId ? `https://rss.wilsongo.top/twitter/list/${cleanListId}` : '';
    }
    const cleanUser = raw.replace(/^@/, '').trim();
    return cleanUser ? `https://rss.wilsongo.top/twitter/user/${cleanUser}` : '';
  }, [twitterInput, twitterType]);

  async function handleSaveTwitterFeed(e) {
    e.preventDefault();
    if (!generatedTwitterRss) {
      alert('请输入有效的 Twitter 用户名或链接');
      return;
    }
    const raw = twitterInput.trim().replace(/^@/, '');
    const cleanUser = raw.replace(/^https?:\/\/(?:x|twitter)\.com\//i, '').split('/')[0].split('?')[0];
    const finalName = twitterName.trim() || (twitterType === 'list' ? `X 列表 #${cleanUser}` : `@${cleanUser}`);

    setBusy(true);
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          feed: {
            name: finalName,
            url: generatedTwitterRss,
            category: 'X/Twitter',
            description: twitterDescription.trim() || `X/Twitter 博主 ${finalName} 的推文动态`,
            filterKeywords: twitterKeywords.trim(),
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
      setMessage(`已成功订阅 X 博主【${data.feed.name}】！`);
      setTwitterModalOpen(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="source-manager-full" style={{ width: '100%', maxWidth: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 顶部订阅配置中心卡片 */}
      <div className="panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, color: 'var(--color-text)' }}>
              RSS 订阅源
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="button button--secondary" type="button" onClick={handleReset} disabled={busy}>
              恢复官方预置
            </button>
            <button
              className="button"
              type="button"
              onClick={openWechatModal}
              disabled={busy}
              style={{
                background: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #86efac',
                fontWeight: 600
              }}
            >
              ＋ 订阅微信公众号
            </button>
            <button
              className="button"
              type="button"
              onClick={openTwitterModal}
              disabled={busy}
              style={{
                background: '#f0f9ff',
                color: '#0284c7',
                border: '1px solid #7dd3fc',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              𝕏 订阅 X/Twitter
            </button>
            <button className="button button--primary" type="button" onClick={openAddModal} disabled={busy}>
              ＋ 新增通用 RSS
            </button>
          </div>
        </div>

        {/* WeRSS 微信公众号服务状态条 */}
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#166534' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }}></span>
            <strong>微信公众号转换服务 (WeRSS)</strong>
            <span style={{ color: '#4b5563', fontSize: 12 }}>已在 NAS 运行 ｜ 支持免跳出微信扫码与公众号搜索订阅</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={openQrModal}
              style={{
                fontSize: 12,
                color: '#15803d',
                border: '1px solid #86efac',
                padding: '4px 10px',
                borderRadius: 4,
                background: '#ffffff',
                cursor: 'pointer'
              }}
            >
              微信扫码授权
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

        {/* 全自动定时采集与 AI 研判调度面板 */}
        {/* 全自动定时采集与 AI 研判调度面板 */}
        <div style={{
          marginTop: 14,
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(134,188,37,.08) 0%, #f8fafc 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14, color: 'var(--color-text)' }}>全自动定时采集与 AI 研判调度</strong>
              {schedulerStatus?.config?.enabled ? (
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#f0fdf4',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                  运行中（每 {schedulerStatus?.config?.intervalHours || 4} 小时自动巡检）
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: '1px solid #cbd5e1'
                  }}
                >
                  自动调度已暂停
                </span>
              )}
              {schedulerStatus?.config?.autoAiAnalyze && (
                <span style={{ fontSize: 11, color: 'var(--color-brand-strong)', background: 'rgba(134,188,37,.12)', padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(134,188,37,.25)' }}>
                  自动AI研判
                </span>
              )}
              {schedulerStatus?.config?.autoImportRelevant && (
                <span style={{ fontSize: 11, color: '#15803d', background: '#f0fdf4', padding: '2px 6px', borderRadius: 3, border: '1px solid #bbf7d0' }}>
                  合规情报自动入库
                </span>
              )}
              {schedulerStatus?.config?.scanGithubTrending && (
                <span style={{ fontSize: 11, color: '#4338ca', background: '#eef2ff', padding: '2px 6px', borderRadius: 3, border: '1px solid #c7d2fe' }}>
                  GitHub趋势扫描
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button button--primary"
                onClick={handleTriggerScheduler}
                disabled={schedulerLoading || schedulerStatus?.isCollecting}
                style={{
                  fontSize: 12,
                  padding: '6px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {schedulerStatus?.isCollecting ? (
                  <>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                    正在采集中 ({schedulerStatus.progress?.processedFeeds || 0}/{schedulerStatus.progress?.totalFeeds || 0})
                  </>
                ) : (
                  <>立即执行全源自动采集</>
                )}
              </button>

              <button
                type="button"
                className="button button--secondary"
                onClick={handleTriggerGithubScan}
                disabled={schedulerLoading || schedulerStatus?.isCollecting}
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
                title="立即发起 GitHub AI 安全开源趋势扫描与研判"
              >
                扫描 GitHub 趋势
              </button>

              <button
                type="button"
                className="button button--secondary"
                onClick={() => setSchedulerModalOpen(true)}
                style={{ fontSize: 12, padding: '6px 12px' }}
              >
                调度设置
              </button>
            </div>
          </div>

          {/* 实时状态与进度展示 */}
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            {schedulerStatus?.isCollecting ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-brand-strong)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--color-brand-strong)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                <span>
                  正在巡检信源【<strong>{schedulerStatus?.progress?.currentFeedName || '准备中'}</strong>】…
                  已发现 <strong>{schedulerStatus?.progress?.articlesFound || 0}</strong> 篇候选文章，自动入库 <strong>{schedulerStatus?.progress?.articlesImported || 0}</strong> 篇
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span>
                  上次执行: {schedulerStatus?.config?.lastRunAt ? new Date(schedulerStatus.config.lastRunAt).toLocaleString('zh-CN') : '尚未开始'}
                  {schedulerStatus?.config?.lastRunStats && (
                    <span style={{ color: 'var(--color-text-secondary)', marginLeft: 6 }}>
                      (巡检 {schedulerStatus.config.lastRunStats.feedsTotal || 0} 个源，
                      发现 {schedulerStatus.config.lastRunStats.articlesFound || 0} 篇，
                      AI入库 {schedulerStatus.config.lastRunStats.articlesImported || 0} 篇，
                      去重跳过 {schedulerStatus.config.lastRunStats.skippedDuplicates || 0} 篇)
                    </span>
                  )}
                </span>
                {schedulerStatus?.config?.enabled && schedulerStatus?.config?.nextRunAt && (
                  <span>
                    下次预计: <strong style={{ color: 'var(--color-brand-strong)' }}>{new Date(schedulerStatus.config.nextRunAt).toLocaleString('zh-CN')}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {message && <div style={{ background: '#f0fdf4', borderLeft: '3px solid var(--color-brand)', padding: '10px 14px', borderRadius: 4, marginTop: 14, fontSize: 13, color: '#166534', border: '1px solid #bbf7d0' }}>{message}</div>}
        {error && <div style={{ background: '#fef2f2', borderLeft: '3px solid var(--color-danger)', padding: '10px 14px', borderRadius: 4, marginTop: 14, fontSize: 13, color: '#991b1b', border: '1px solid #fecaca' }}>{error}</div>}

        {/* 统计概览 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, margin: '20px 0 16px' }}>
          <div style={{ background: 'var(--color-surface-strong)', padding: '12px 16px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>已配置信源</span>
            <strong style={{ display: 'block', fontSize: 20, marginTop: 4, color: 'var(--color-text)' }}>{sources.length} 个</strong>
          </div>
          <div style={{ background: 'var(--color-surface-strong)', padding: '12px 16px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>正常启用中</span>
            <strong style={{ display: 'block', fontSize: 20, marginTop: 4, color: '#16a34a' }}>{enabledCount} 个</strong>
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
                  background: active ? '#86bc25' : '#ffffff',
                  color: active ? '#000000' : 'var(--color-text-secondary)',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>{cat}</span>
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: active ? 'rgba(0,0,0,.15)' : 'var(--color-surface-strong)', color: active ? '#000000' : 'var(--color-text-muted)' }}>
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
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>当前分类下暂无订阅源，可点击上方「𝕏 订阅 X/Twitter」、「＋ 订阅微信公众号」或「＋ 新增通用 RSS」。</div>
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
                    background: isEnabled ? 'var(--color-surface)' : '#f9fafb',
                    border: '1px solid',
                    borderColor: isEnabled ? 'var(--color-border)' : '#e5e7eb',
                    borderRadius: 6,
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    opacity: isEnabled ? 1 : 0.7,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* 标题行 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 16, color: 'var(--color-text)' }}>{source.name}</strong>
                      <span
                        className="badge badge--neutral"
                        style={{
                          fontSize: 11,
                          background: source.category === '微信公众号' ? '#f0fdf4' : source.category === 'X/Twitter' ? '#f0f9ff' : undefined,
                          color: source.category === '微信公众号' ? '#15803d' : source.category === 'X/Twitter' ? '#0284c7' : undefined,
                          borderColor: source.category === '微信公众号' ? '#86efac' : source.category === 'X/Twitter' ? '#7dd3fc' : undefined
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
                          borderColor: isEnabled ? '#86efac' : 'var(--color-border)',
                          background: isEnabled ? '#f0fdf4' : '#f9fafb',
                          color: isEnabled ? '#15803d' : 'var(--color-text-muted)',
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
                    <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-brand)', textDecoration: 'underline' }}>
                      {source.url}
                    </a>
                  </div>

                  {/* 过滤关键词标签 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
                    <span style={{ color: 'var(--color-brand)' }}>关键词筛选：</span>
                    {keywords.length > 0 ? (
                      keywords.map(kw => (
                        <span key={kw} style={{ background: 'rgba(134,188,37,.12)', color: 'var(--color-brand-strong)', padding: '1px 6px', borderRadius: 3, fontSize: 11, border: '1px solid rgba(134,188,37,.25)' }}>
                          {kw}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>全量接收（无关键词限制）</span>
                    )}
                  </div>

                  {/* 底部操作行 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderTop: '1px solid var(--color-border)', paddingTop: 10, marginTop: 4 }}>
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
                        立即采集最新
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

      {/* 右侧边栏实时采集与审阅抽屉 */}
      <CollectionDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        source={drawerSource}
      />

      {/* 浮动标签（当抽屉收起但有选定信源时可随时点击展开） */}
      {!drawerOpen && drawerSource && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            background: '#ffffff',
            color: 'var(--color-brand-strong)',
            border: '1px solid #bbf7d0',
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            borderRadius: 24,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-brand-strong)' }} />
          <span>采集状态：【{drawerSource.name}】</span>
          <span style={{ fontSize: 11, background: '#f0fdf4', color: 'var(--color-brand-strong)', padding: '2px 8px', borderRadius: 10 }}>展开 ↗</span>
        </button>
      )}

      {/* 微信公众平台扫码授权绑定 Modal */}
      {qrModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 16px 36px rgba(0,0,0,.12)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ fontSize: 17, color: 'var(--color-text)' }}>微信公众平台授权绑定</strong>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>扫码后 WeRSS 将通过公众平台接口检索并转换文章</p>
              </div>
              <button type="button" onClick={() => setQrModalOpen(false)} style={{ background: 'transparent', border: 0, color: 'var(--color-text-muted)', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>

            {/* 二维码展示区域 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 240, padding: '16px 0' }}>
              {qrLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: 200, width: 200, background: '#f8f9fa', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.08)' }}>
                  <div style={{ width: 34, height: 34, border: '3px solid #cbd5e1', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ color: '#475569', fontSize: 12, fontWeight: 500 }}>获取授权码中…</span>
                </div>
              ) : qrDataUrl ? (
                <div style={{ background: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.08)', border: '1px solid var(--color-border)' }}>
                  <img
                    src={qrDataUrl}
                    alt="WeRSS 微信授权二维码"
                    style={{ width: 200, height: 200, display: 'block', objectFit: 'contain' }}
                    onError={(e) => {
                      // 若 Base64 偶发异常，自动回退至同源代理接口
                      if (!e.currentTarget.src.includes('action=qrimg')) {
                        e.currentTarget.src = `/api/wechat?action=qrimg&t=${Date.now()}`;
                      }
                    }}
                  />
                </div>
              ) : (
                <div style={{ color: '#dc2626', fontSize: 14, padding: '30px 0' }}>{qrStatusText || '暂无二维码'}</div>
              )}

              {/* 实时状态提示 */}
              <div style={{
                marginTop: 16,
                fontSize: 13,
                padding: '6px 14px',
                borderRadius: 4,
                background: qrStatusType === 'success' ? '#f0fdf4' : qrStatusType === 'error' ? '#fef2f2' : 'rgba(134,188,37,.12)',
                color: qrStatusType === 'success' ? '#166534' : qrStatusType === 'error' ? '#991b1b' : 'var(--color-brand-strong)',
                border: '1px solid',
                borderColor: qrStatusType === 'success' ? '#bbf7d0' : qrStatusType === 'error' ? '#fecaca' : 'rgba(134,188,37,.3)'
              }}>
                {qrStatusText || '等待微信扫码…'}
              </div>
            </div>

            <div style={{ background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'left', lineHeight: 1.5, marginTop: 8 }}>
              <strong>提示：</strong> 请使用已在微信公众平台注册（个人订阅号即可，微信官方免费秒开通）的微信号扫码确认。
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
              <button className="button button--secondary" type="button" onClick={fetchQrCode} disabled={qrLoading} style={{ fontSize: 13 }}>
                刷新二维码
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 16px 36px rgba(0,0,0,.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
              <div>
                <strong style={{ fontSize: 18, color: 'var(--color-text)' }}>订阅微信公众号</strong>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>检索公众号一键订阅并配置 AI 安全合规关键词门禁</p>
              </div>
              <button type="button" onClick={() => setWechatModalOpen(false)} style={{ background: 'transparent', border: 0, color: 'var(--color-text-muted)', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>

            {wechatSubSuccess && (
              <div style={{ background: '#f0fdf4', borderLeft: '3px solid #22c55e', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 4, marginTop: 14, fontSize: 13, color: '#15803d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{wechatSubSuccess}</span>
                <button
                  type="button"
                  onClick={() => setWechatModalOpen(false)}
                  style={{ background: 'transparent', border: '1px solid #86efac', color: '#15803d', padding: '2px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
                >
                  关闭弹窗
                </button>
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
                    style={{ flex: 1, minHeight: 38, padding: '8px 12px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)', fontSize: 14 }}
                  />
                  <button className="button button--primary" type="submit" disabled={wechatSearching} style={{ whiteSpace: 'nowrap', padding: '0 18px' }}>
                    {wechatSearching ? '搜索中…' : '搜索公众号'}
                  </button>
                </form>

                {/* AI 安全合规门禁设置 */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 14px', display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>关键词筛选门禁（仅同步符合以下特征的推文）：</span>
                    <button
                      type="button"
                      onClick={() => setWechatKeywords(DEFAULT_WECHAT_KEYWORDS)}
                      style={{ background: 'transparent', border: 0, color: 'var(--color-brand-strong)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                    >
                      填入推荐词
                    </button>
                  </div>
                  <input
                    type="text"
                    value={wechatKeywords}
                    onChange={e => setWechatKeywords(e.target.value)}
                    placeholder="留空全量接收，输入关键词以逗号分隔"
                    style={{ minHeight: 34, padding: '6px 10px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)', fontSize: 12 }}
                  />
                  <small style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                    微信公众号推文通常涵盖科技、硬件或日常动态，配置关键词筛选后，未提及 AI/大模型/安全/合规 的推文将被自动剔除。
                  </small>
                </div>

                {/* 搜索结果列表 */}
                {wechatSearching ? (
                  <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>正在微信公众平台检索…</div>
                ) : wechatResults.length > 0 ? (
                  <div style={{ display: 'grid', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
                    {wechatResults.map(mp => {
                      const id = mp.mp_id || mp.fakeid || mp.id || mp.nickname || mp.name;
                      const name = mp.mp_name || mp.nickname || mp.name;
                      const cover = mp.mp_cover || mp.avatar || mp.round_head_img;
                      const intro = mp.mp_intro || mp.signature || '';
                      const isSubscribing = subscribingId === id;
                      const isAlreadySubscribed = sources.some(s => s.name === name || (s.id && s.id.includes(id))) || justSubscribed.has(id) || justSubscribed.has(name) || (mp.fakeid && justSubscribed.has(mp.fakeid));

                      return (
                        <div
                          key={id}
                          onClick={() => {
                            if (!isSubscribing && !isAlreadySubscribed) {
                              handleSubscribeMp(mp);
                            }
                          }}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 14px',
                            background: isAlreadySubscribed ? '#f0fdf4' : 'var(--color-surface)',
                            border: `1px solid ${isAlreadySubscribed ? '#bbf7d0' : 'var(--color-border)'}`,
                            borderRadius: 6,
                            cursor: isAlreadySubscribed ? 'default' : 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                            {cover ? (
                              <img src={cover} alt={name} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', background: '#f1f5f9', border: '1px solid var(--color-border)' }} />
                            ) : (
                              <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {name.slice(0, 1)}
                              </div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <strong style={{ fontSize: 14, color: 'var(--color-text)' }}>{name}</strong>
                                {isAlreadySubscribed && (
                                  <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                                    已在监控中
                                  </span>
                                )}
                              </div>
                              {intro && <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{intro}</span>}
                            </div>
                          </div>

                          <div style={{ flexShrink: 0 }}>
                            {isAlreadySubscribed ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 14px',
                                fontSize: 12,
                                borderRadius: 4,
                                background: '#f0fdf4',
                                color: '#15803d',
                                border: '1px solid #bbf7d0'
                              }}>
                                已订阅
                              </span>
                            ) : (
                              <button
                                className="button button--primary"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSubscribeMp(mp);
                                }}
                                disabled={isSubscribing}
                                style={{
                                  padding: '6px 14px',
                                  fontSize: 12,
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer'
                                }}
                              >
                                {isSubscribing ? '正在订阅…' : '＋ 一键订阅'}
                              </button>
                            )}
                          </div>
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
                    style={{ background: 'transparent', border: 0, color: 'var(--color-brand-strong)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}
                  >
                    找不到公众号？切换为手动输入微信 RSS 链接添加 ↗
                  </button>
                </div>
              </div>
            ) : (
              /* 手动输入公众号 RSS 模式 */
              <form onSubmit={handleSaveManualWechatFeed} style={{ display: 'grid', gap: 14, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-brand-strong)', fontWeight: 600 }}>手动配置微信公众号 Feed</span>
                  <button
                    type="button"
                    onClick={() => setWechatManualMode(false)}
                    style={{ background: 'transparent', border: 0, color: 'var(--color-brand-strong)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}
                  >
                    ← 返回搜索公众号
                  </button>
                </div>

                <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                  <span>公众号名称 <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
                  <input
                    type="text"
                    required
                    placeholder="例如：网信中国、量子位"
                    value={wechatManualFeed.name}
                    onChange={e => setWechatManualFeed({ ...wechatManualFeed, name: e.target.value })}
                    style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                  <span>微信公众号 RSS 地址 <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
                  <input
                    type="url"
                    required
                    placeholder="https://wewe.wilsongo.top/feed/xxxxxx.xml"
                    value={wechatManualFeed.url}
                    onChange={e => setWechatManualFeed({ ...wechatManualFeed, url: e.target.value })}
                    style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                  <span>关键词筛选（逗号分隔）</span>
                  <input
                    type="text"
                    value={wechatManualFeed.filterKeywords}
                    onChange={e => setWechatManualFeed({ ...wechatManualFeed, filterKeywords: e.target.value })}
                    style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                  <span>说明备注</span>
                  <input
                    type="text"
                    placeholder="例如：行业合规资讯"
                    value={wechatManualFeed.description}
                    onChange={e => setWechatManualFeed({ ...wechatManualFeed, description: e.target.value })}
                    style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, maxWidth: 580, width: '100%', padding: 24, boxShadow: '0 16px 36px rgba(0,0,0,.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
              <strong style={{ fontSize: 18, color: 'var(--color-text)' }}>
                {editingFeed ? '编辑 RSS 订阅源' : '新增 RSS 订阅源'}
              </strong>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 0, color: 'var(--color-text-muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSaveFeed} style={{ display: 'grid', gap: 14, marginTop: 16 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                <span>来源名称 <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
                <input
                  type="text"
                  required
                  placeholder="例如：NIST AI 风险框架动态、OpenAI 安全博客"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                <span>RSS / Atom 订阅地址 <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/feed.xml"
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                  <span>分类</span>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({
                      ...formData,
                      category: e.target.value,
                      filterKeywords: e.target.value === '微信公众号' ? DEFAULT_WECHAT_KEYWORDS : formData.filterKeywords
                    })}
                    style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                  >
                    <option value="微信公众号">微信公众号</option>
                    <option value="X/Twitter">X/Twitter</option>
                    <option value="监管政策">监管政策</option>
                    <option value="AI安全">AI安全</option>
                    <option value="头部厂商">头部厂商</option>
                    <option value="行业资讯">行业资讯</option>
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                  <span>采集频率</span>
                  <select
                    value={formData.cadence}
                    onChange={e => setFormData({ ...formData, cadence: e.target.value })}
                    style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                  >
                    <option value="每天">每天</option>
                    <option value="每周">每周</option>
                    <option value="手动">手动</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>关键词筛选（逗号分隔）</span>
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      filterKeywords: formData.category === '微信公众号' ? DEFAULT_WECHAT_KEYWORDS : DEFAULT_AI_KEYWORDS
                    })}
                    style={{ background: 'transparent', border: 0, color: 'var(--color-brand-strong)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                  >
                    填入推荐词
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="留空则全量接收；填写后仅抓取匹配标题/摘要的文章"
                  value={formData.filterKeywords}
                  onChange={e => setFormData({ ...formData, filterKeywords: e.target.value })}
                  style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                />
                <small style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                  配置关键词筛选后，仅抓取命中关键词的推文或文章，避免产生无关噪音。
                </small>
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                <span>信源说明</span>
                <input
                  type="text"
                  placeholder="如：官方指南、合规动态"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--color-text)' }}>
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

      {/* 专属 X / Twitter 订阅 Modal */}
      {twitterModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid #7dd3fc', borderRadius: 8, maxWidth: 540, width: '100%', padding: 24, boxShadow: '0 16px 36px rgba(0,0,0,.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20, color: '#0284c7' }}>𝕏</span>
                <strong style={{ fontSize: 18, color: 'var(--color-text)' }}>订阅 X / Twitter 博主</strong>
              </div>
              <button type="button" onClick={() => setTwitterModalOpen(false)} style={{ background: 'transparent', border: 0, color: 'var(--color-text-muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleSaveTwitterFeed} style={{ display: 'grid', gap: 14, marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--color-text)' }}>
                  <input
                    type="radio"
                    name="twitterType"
                    checked={twitterType === 'user'}
                    onChange={() => setTwitterType('user')}
                  />
                  <span>个人博主 (User)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--color-text)' }}>
                  <input
                    type="radio"
                    name="twitterType"
                    checked={twitterType === 'list'}
                    onChange={() => setTwitterType('list')}
                  />
                  <span>合流列表 (List)</span>
                </label>
              </div>

              <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                <span>
                  {twitterType === 'user' ? 'Twitter 账号名或主页链接' : 'Twitter 列表 ID 或链接'}{' '}
                  <strong style={{ color: 'var(--color-danger)' }}>*</strong>
                </span>
                <input
                  type="text"
                  required
                  placeholder={twitterType === 'user' ? '例如：@elonmusk、sama 或 https://x.com/OpenAI' : '例如：12345678 或 https://x.com/i/lists/12345678'}
                  value={twitterInput}
                  onChange={e => setTwitterInput(e.target.value)}
                  style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                />
              </label>

              {/* 自动生成的 RSS 预览 */}
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 4, padding: '10px 12px', fontSize: 12 }}>
                <span style={{ color: '#0284c7', fontWeight: 500 }}>自动生成的 NAS RSSHub 地址：</span>
                <div style={{ marginTop: 4, color: generatedTwitterRss ? '#0369a1' : 'var(--color-text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {generatedTwitterRss || '（输入账号后自动生成）'}
                </div>
              </div>

              <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                <span>显示名称（可选）</span>
                <input
                  type="text"
                  placeholder={twitterInput ? (twitterType === 'list' ? `X 列表` : `@${twitterInput.replace(/^@/, '').split('/').pop()}`) : '留空则默认使用推特 Handle'}
                  value={twitterName}
                  onChange={e => setTwitterName(e.target.value)}
                  style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>关键词筛选（可选，逗号分隔）</span>
                  <button
                    type="button"
                    onClick={() => setTwitterKeywords(DEFAULT_AI_KEYWORDS)}
                    style={{ background: 'transparent', border: 0, color: 'var(--color-brand-strong)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                  >
                    填入 AI 推荐词
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="留空则抓取该博主的所有推文；填入后仅抓取含关键词的推文"
                  value={twitterKeywords}
                  onChange={e => setTwitterKeywords(e.target.value)}
                  style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
                <span>说明备注（可选）</span>
                <input
                  type="text"
                  placeholder="例如：OpenAI 创始人、AI 行业领袖"
                  value={twitterDescription}
                  onChange={e => setTwitterDescription(e.target.value)}
                  style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
                <button className="button button--secondary" type="button" onClick={() => setTwitterModalOpen(false)}>
                  取消
                </button>
                <button
                  className="button"
                  type="submit"
                  disabled={busy || !generatedTwitterRss}
                  style={{
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    padding: '8px 16px',
                    borderRadius: 4,
                    cursor: busy || !generatedTwitterRss ? 'not-allowed' : 'pointer'
                  }}
                >
                  {busy ? '正在保存…' : '保存并订阅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 调度设置模态弹窗 */}
      {schedulerModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300
          }}
          onClick={() => setSchedulerModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: 24,
              width: 520,
              maxWidth: '92vw',
              boxShadow: '0 16px 36px rgba(0,0,0,0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--color-text)' }}>定时自动采集与研判调度设置</h3>
              </div>
              <button
                type="button"
                onClick={() => setSchedulerModalOpen(false)}
                style={{ background: 'transparent', border: 0, color: 'var(--color-text-muted)', fontSize: 20, cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveSchedulerConfig} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={schedulerConfigForm.enabled}
                  onChange={e => setSchedulerConfigForm(prev => ({ ...prev, enabled: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 600 }}>开启后台定时全自动采集</span>
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>自动巡检周期</span>
                <select
                  value={schedulerConfigForm.intervalHours}
                  onChange={e => setSchedulerConfigForm(prev => ({ ...prev, intervalHours: Number(e.target.value) }))}
                  style={{ minHeight: 38, padding: '8px 10px', background: 'var(--color-page)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)' }}
                >
                  <option value={1}>每 1 小时 (高时效)</option>
                  <option value={2}>每 2 小时</option>
                  <option value={4}>每 4 小时 (推荐，时效与资源均衡)</option>
                  <option value={6}>每 6 小时</option>
                  <option value={12}>每 12 小时 (每天 2 次)</option>
                  <option value={24}>每 24 小时 (每天 1 次)</option>
                </select>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  系统后台将在 Node.js 守护线程中按设定周期循环巡检所有已启用的信源。
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={schedulerConfigForm.autoAiAnalyze}
                  onChange={e => setSchedulerConfigForm(prev => ({ ...prev, autoAiAnalyze: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontSize: 13, color: 'var(--color-text)', display: 'block' }}>自动调用大模型深度研判</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>抓取到新文章后，自动调用系统配置的 LLM 提炼中文摘要、研判 AI 相关性与业务影响</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={schedulerConfigForm.autoImportRelevant}
                  onChange={e => setSchedulerConfigForm(prev => ({ ...prev, autoImportRelevant: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontSize: 13, color: 'var(--color-text)', display: 'block' }}>合规情报自动确认入库</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>仅当大模型研判判定为与 AI 安全合规直接相关 (isRelevant: true) 时，直接存入 NAS 数据库</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={schedulerConfigForm.scanGithubTrending}
                  onChange={e => setSchedulerConfigForm(prev => ({ ...prev, scanGithubTrending: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontSize: 13, color: 'var(--color-text)', display: 'block' }}>包含 GitHub 每日开源趋势自动扫描</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>自动检索全球大模型安全护栏、红蓝对抗评测工具与漏洞扫描项目并智能研判入库</span>
                </div>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setSchedulerModalOpen(false)}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={schedulerLoading}
                >
                  {schedulerLoading ? '正在保存…' : '保存设置'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
