import { getArticles } from '@/lib/repository';
import { readSSE, selectedReportMode, matchBlogger, matchLegislation, DEFAULT_MORNING_PREFERENCES } from '@/lib/daily-report.mjs';
import { saveReport, listReports, deleteReport, getLlmConfig, getSetting, setSetting } from '@/lib/collection-store.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function GET() {
  const reports = listReports(50);
  const llm = getLlmConfig();
  const savedPreferences = (typeof getSetting === 'function' ? getSetting('morning_report_preferences') : null) || DEFAULT_MORNING_PREFERENCES;
  return Response.json({
    configured: llm.configured,
    model: llm.model,
    preferences: savedPreferences,
    reports
  });
}

export async function POST(request) {
  const fail = (error, status = 400) => Response.json({ error }, { status });
  const origin = request.headers.get('origin');
  // Next.js may normalize the internal URL to localhost; browsers use the actual Host.
  const requestUrl = new URL(request.url);
  const host = request.headers.get('host') || requestUrl.host;
  const proto = request.headers.get('x-forwarded-proto') || requestUrl.protocol.replace(':', '');
  const expectedOrigin = `${requestUrl.protocol}//${host}`;
  const expectedProxyOrigin = `${proto}://${host}`;
  if (origin && origin !== expectedOrigin && origin !== expectedProxyOrigin) return fail('请求来源不允许。', 403);
  let input;
  try { input = await request.json(); } catch { return fail('请求格式无效。'); }

  // 1. 保存偏好操作
  if (input?.action === 'save_preferences' && input?.preferences) {
    if (typeof setSetting === 'function') {
      setSetting('morning_report_preferences', input.preferences);
    }
    return Response.json({ success: true, preferences: input.preferences });
  }

  if (!input || !Array.isArray(input.articleIds) || !input.articleIds.length || input.articleIds.length > 30 || input.articleIds.some(id => !Number.isInteger(id) || id <= 0)) return fail('请选择 1–30 条新闻。');
  const llm = getLlmConfig();
  if (!llm.configured) return fail('尚未配置大模型 API Key，请登录系统后在大模型配置中设置。', 503);
  const { data, mode } = await getArticles();
  if (input.mode !== mode) return fail('新闻数据来源已变化，请刷新后重新选择。', 409);
  const articles = [...new Set(input.articleIds)].map(id => data.find(a => a.id === id));
  if (articles.some(a => !a)) return fail('部分新闻已不可用，请刷新并重新选择。', 409);
  const reportMode = selectedReportMode(articles, mode);
  const model = llm.model, controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 170000);
  const cleanup = () => { clearTimeout(timer); request.signal.removeEventListener('abort', abort); };
  const sources = articles.map((a, i) => ({ number: i + 1, id: a.id, title: a.title, url: a.url, source: a.source, publishedAt: a.dateIsCollection ? null : a.publishedAt, collectedAt: a.collectedAt }));

  const preferences = input.preferences || DEFAULT_MORNING_PREFERENCES;
  const trackedBloggers = preferences.trackedBloggers || [];
  const trackedLegislation = preferences.trackedLegislation || [];

  const materials = articles.map((a, i) => {
    const summaryText = a.summary ? String(a.summary).slice(0, 500) : '';
    const excerptText = String(a.originalExcerpt || '').slice(0, 600);
    const matchedBlogger = matchBlogger(a, trackedBloggers);
    const matchedLegislation = matchLegislation(a, trackedLegislation);
    return {
      number: i + 1,
      title: a.title,
      isSample: a.isSample === true,
      source: a.source,
      publishedAt: a.dateIsCollection ? null : a.publishedAt,
      collectedAt: a.collectedAt,
      category: a.intelligenceType || a.category || '行业动态',
      detailTag: a.detailTag || '',
      affectedEntity: a.affectedEntity || '',
      severity: a.severity || '',
      tags: a.tags,
      matchedBlogger: matchedBlogger || undefined,
      matchedLegislation: matchedLegislation || undefined,
      summary: summaryText || excerptText
    };
  });

  const providerNames = {
    siliconflow: '硅基流动',
    deepseek: 'DeepSeek',
    openai: 'OpenAI',
    custom: '大模型服务'
  };
  const providerName = providerNames[llm.provider] || '大模型服务';

  const bloggersPrompt = trackedBloggers.length > 0 ? trackedBloggers.join('、') : '未指定';
  const legislationPrompt = trackedLegislation.length > 0 ? trackedLegislation.join('、') : '未指定';

  let upstream;
  try {
    upstream = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${llm.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: 2800,
        temperature: typeof llm.temperature === 'number' ? llm.temperature : 0.3,
        messages: [
          {
            role: 'system',
            content: '你是专注于AI安全与合规的首席战略情报顾问与总编。请根据用户设定的早报偏好及提供的素材，生成一份面向决策层与技术骨干的《每日AI安全与合规早报》（600-900字）。严格区分客观事实与AI研判，禁止编造事实或添加外部未提及的信息。\n\n' +
              '必须严格按以下结构化 Markdown 板块输出：\n' +
              '## 一、晨报核心速览 (Executive Summary)\n' +
              '（以 3 条提纲挈领的要点，提炼过去 24 小时最重要的合规、产品与风险变化要点）\n\n' +
              `## 二、重点博主与领袖动态 (Key Influencer & Expert Signals)\n` +
              `【用户重点关注博主/领袖】：${bloggersPrompt}\n` +
              '（检查素材中是否有上述博主/专家的发声、公开演讲、评测或最新立场。如有，提炼其核心论点并标注[引用编号]；若本次素材中暂无所关注博主的新发声，必须明确单列说明：“今日所关注博主暂无公开新动态”，严禁编造谎言）\n\n' +
              `## 三、重点法案与监管追踪 (Target Legislation & Compliance Watch)\n` +
              `【用户重点关注法规/标准】：${legislationPrompt}\n` +
              '（梳理上述法规、官方指南、备案或监管执法动向。如有，提炼合规红线与业务影响并标注[引用编号]；若本次素材中暂无该法案变动，必须明确单列说明：“今日所关注法案暂无新发布”）\n\n' +
              '## 四、AI安全产品与技术突破 (Security Products & Breakthroughs)\n' +
              '（梳理最新开源防御护栏Guardrails、红蓝评测工具、越狱防线、漏洞修复或脱敏水印等实用技术突破，标注[引用编号]）\n\n' +
              '## 五、今日合规行动自查建议 (Actionable Compliance Checklist)\n' +
              '（针对上述动态，提炼 2~3 条企业今天立即可落地的防御自查或策略配置行动清单）\n\n' +
              '文末必须附“引用素材”小节，逐条列出使用的[编号]、标题、来源和发布时间。'
          },
          { role: 'user', content: JSON.stringify({ notice: reportMode === 'mock' ? '示例新闻，仅供演示，必须标注示例数据。' : reportMode === 'mixed' ? '包含示例新闻与入库文章，须分别标注每条素材的类型。' : '平台入库新闻，不代表实时采集或独立核验。', preferences, materials }) }
        ]
      })
    });
  } catch { cleanup(); return fail(controller.signal.aborted ? '生成超时或已取消，请重试。' : `无法连接${providerName}，请检查网络后重试。`, 502); }
  if (!upstream.ok || !upstream.body) {
    cleanup(); await upstream.body?.cancel();
    const messages = {
      401: 'API Key 无效，请检查服务端配置。',
      402: `${providerName}账户余额不足。`,
      403: `当前账户无权调用此模型，请检查权限或余额。`,
      404: `模型或接口不存在，请核对模型名称。`,
      429: `调用过于频繁或额度不足，请稍后重试。`,
      400: `请求被拒绝，请核对模型名称和支持的参数。`
    };
    return fail(messages[upstream.status] || `${providerName}暂时不可用（${upstream.status}），请重试。`, 502);
  }
  const encoder = new TextEncoder(); let cancelled = false;
  const stream = new ReadableStream({
    async start(output) {
      const send = event => { if (!cancelled) output.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); };
      let content = '', completed = false, usage;
      try {
        send({ type: 'start', model, mode: reportMode, sources });
        for await (const line of readSSE(upstream.body)) {
          if (!line) continue;
          if (line === '[DONE]') {
            if (content.trim().length >= 150) completed = true;
            break;
          }
          const chunk = JSON.parse(line);
          if (chunk.error) throw new Error('生成服务返回错误。');
          if (chunk.usage) usage = chunk.usage;
          const choice = chunk.choices?.[0];
          if (choice?.finish_reason === 'stop') completed = true;
          else if (choice?.finish_reason === 'length') throw new Error('早报未完整生成，请减少新闻数量后重试。');
          const delta = choice?.delta?.content;
          if (typeof delta === 'string') { content += delta; if (content.length > 60000) throw new Error('生成内容过长。'); send({ type: 'delta', text: delta }); }
        }
        if (!completed || !content.trim()) throw new Error('生成连接中断或返回空内容，请重试。');
        const createdAt = new Date().toISOString();
        const dateStr = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
        const saved = saveReport({
          createdAt,
          title: `每日AI安全与合规早报 (${dateStr})`,
          content,
          sources,
          mode: reportMode,
          model,
          preferences: preferences
        });
        send({ type: 'complete', id: saved?.id || Date.now(), createdAt, usage, sources, mode: reportMode, model, preferences });
      } catch { send({ type: 'error', error: controller.signal.aborted ? '生成超时或已取消，请重试。' : '早报未完整生成，请减少新闻数量后重试。' }); }
      finally { cleanup(); if (!cancelled) output.close(); }
    },
    cancel() { cancelled = true; abort(); cleanup(); }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}

export async function DELETE(request) {
  const u = new URL(request.url);
  const id = u.searchParams.get('id');
  if (!id) return Response.json({ error: '缺少报告 id' }, { status: 400 });
  const success = deleteReport(id);
  return Response.json({ success });
}
