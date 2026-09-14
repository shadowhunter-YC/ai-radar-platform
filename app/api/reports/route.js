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

  const rawIds = Array.isArray(input?.articleIds) ? input.articleIds : [];
  const articleIds = rawIds.map(id => typeof id === 'number' ? id : parseInt(id, 10)).filter(id => Number.isInteger(id) && id > 0);
  if (!articleIds.length || articleIds.length > 30) return fail('请选择 1–30 条新闻。');
  const llm = getLlmConfig();
  if (!llm.configured) return fail('尚未配置大模型 API Key，请登录系统后在大模型配置中设置。', 503);
  const { data, mode } = await getArticles();
  if (input.mode && input.mode !== 'auto' && input.mode !== mode) return fail('新闻数据来源已变化，请刷新后重新选择。', 409);
  const articles = [...new Set(articleIds)].map(id => data.find(a => String(a.id) === String(id)));
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

  const bloggerDynamicStats = trackedBloggers.map(blogger => {
    const bLower = String(blogger).toLowerCase();
    const cleanB = blogger.replace(/\s*\(@[\w_]+\)/, '').trim().toLowerCase();
    const handleMatch = blogger.match(/@([\w_]+)/);
    const handle = handleMatch ? handleMatch[1].toLowerCase() : null;

    const matchedArticles = materials.filter(m => {
      if (m.matchedBlogger === blogger) return true;
      const text = [
        m.title,
        m.summary,
        m.source,
        m.affectedEntity
      ].filter(Boolean).join(' ').toLowerCase();

      return text.includes(bLower) || (cleanB && text.includes(cleanB)) || (handle && text.includes(handle));
    });

    return {
      blogger,
      count: matchedArticles.length,
      sampleQuotes: matchedArticles.map(m => `[${m.number}] ${m.title}`).slice(0, 3)
    };
  });

  const bloggerFactsText = trackedBloggers.length > 0
    ? bloggerDynamicStats.map(s =>
        `- **${s.blogger}**: 今日新增资讯 ${s.count} 条${s.count > 0 ? ` (涉及素材: ${s.sampleQuotes.join('、')})` : ' (今日素材库中暂无新增公开动态与言论)'}`
      ).join('\n')
    : '未指定';
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
              (trackedBloggers.length > 0
                ? `【用户指定重点关注博主及系统核验事实（必须严格据此逐一列出）】：\n${bloggerFactsText}\n\n` +
                  '【写作硬性规则】：\n' +
                  '1. 必须对上述关注的每一位博主【逐一单独列点成行】，严禁遗漏任何一位关注的博主！\n' +
                  '2. 格式统一为：“- **博主名**: 今日新增资讯 X 条。……”；\n' +
                  '3. 如果某位博主今日新增资讯是 0，也【必须明确显示为 0 条】（格式必须如：“- **博主名**: 今日新增资讯 0 条。暂无公开新动态与言论”），绝不能省略该博主；\n' +
                  '4. 如果某位博主今日新增资讯大于 0，提炼其核心论点、技术洞察或研判并标注[引用编号]；\n' +
                  '5. 严禁编造任何虚假言论。\n' +
                  '6. 【X 平台焦点争鸣与共振】：若素材库中有多位博主或推文围绕同一争议议题（如：AI减速论、加州SB 1047法案、开源权重安全护栏等）发生观点交锋或互动共振，请在本节末尾增加【X 平台焦点争鸣】子板块，并排提炼不同阵营（如：安全紧迫派 vs 发展乐观派）的核心论点与论战交锋，标注[引用编号]。\n\n'
                : '（检查素材中是否有行业关键专家或意见领袖的前沿观点，如有请提炼并标注[引用编号]；若有多位博主围绕同一争议展开交锋，请在子板块【X 平台焦点争鸣】提炼阵营对抗；若无则简要陈述行业声音态势）\n\n'
              ) +
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
