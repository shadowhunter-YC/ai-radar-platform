import { getSchedulerStatus, runAutoCollection, runGithubScan, saveSchedulerConfig } from '../../../lib/scheduler.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  return Response.json({ data: getSchedulerStatus() });
}

export async function POST(request) {
  const origin = request.headers.get('origin');
  const u = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') || u.protocol.replace(':', '');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || u.host;

  if (origin) {
    const allowedOrigins = [
      `${u.protocol}//${u.host}`,
      `${proto}://${host}`,
      'https://radar.wilsongo.top',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    if (!allowedOrigins.includes(origin)) {
      return Response.json({ error: '请求来源不允许。' }, { status: 403 });
    }
  }

  let body = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return Response.json({ error: '无效的 JSON 请求体' }, { status: 400 });
  }

  const { action } = body;

  if (action === 'run') {
    const current = getSchedulerStatus();
    if (current.isCollecting) {
      return Response.json(
        { success: false, message: '后台自动采集任务正在执行中，请稍候。', status: current },
        { status: 409 }
      );
    }

    if (body.sync) {
      const result = await runAutoCollection({ force: true, source: 'manual' });
      return Response.json({ success: true, ...result, status: getSchedulerStatus() });
    }

    // 默认后台异步执行，前端轮询进度
    runAutoCollection({ force: true, source: 'manual' }).catch(err => {
      console.error('[Scheduler Route] Manual run error:', err);
    });

    return Response.json({
      success: true,
      message: '全源自动采集与AI研判任务已在后台启动。',
      status: getSchedulerStatus()
    });
  }

  if (action === 'scan_github') {
    const current = getSchedulerStatus();
    if (current.isCollecting) {
      return Response.json(
        { success: false, message: '后台采集任务正在执行中，请稍候。', status: current },
        { status: 409 }
      );
    }

    if (body.sync) {
      const result = await runGithubScan({ source: 'manual' });
      return Response.json({ success: true, ...result, status: getSchedulerStatus() });
    }

    // 默认后台异步执行
    runGithubScan({ source: 'manual' }).catch(err => {
      console.error('[Scheduler Route] GitHub scan error:', err);
    });

    return Response.json({
      success: true,
      message: 'GitHub AI 安全开源趋势扫描与研判任务已在后台启动。',
      status: getSchedulerStatus()
    });
  }

  if (action === 'update_config') {
    const updates = body.config || {};
    const updated = saveSchedulerConfig(updates);
    return Response.json({
      success: true,
      message: '定时调度配置已更新',
      config: updated,
      status: getSchedulerStatus()
    });
  }

  return Response.json({ error: `不支持的操作: ${action}` }, { status: 400 });
}
