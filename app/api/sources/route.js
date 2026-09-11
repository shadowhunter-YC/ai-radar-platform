import { listRssFeeds, getRssFeed, saveRssFeed, toggleRssFeed, deleteRssFeed, resetRssFeeds } from '../../../lib/collection-store.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sources = listRssFeeds();
    return Response.json({ sources });
  } catch (e) {
    return Response.json({ error: e.message || '获取订阅列表失败' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body || !body.action) {
      return Response.json({ error: '缺少操作指令 action' }, { status: 400 });
    }

    if (body.action === 'save') {
      const feed = body.feed;
      if (!feed || !feed.name || !feed.url) {
        return Response.json({ error: '名称与订阅地址均为必填项' }, { status: 400 });
      }
      try {
        const u = new URL(feed.url);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
      } catch {
        return Response.json({ error: '请输入有效的公开网络链接 (HTTP/HTTPS)' }, { status: 400 });
      }

      const saved = saveRssFeed(feed);
      return Response.json({ feed: saved });
    }

    if (body.action === 'toggle') {
      if (!body.id) return Response.json({ error: '缺少订阅源 ID' }, { status: 400 });
      const toggled = toggleRssFeed(body.id, body.enabled);
      return Response.json({ feed: toggled });
    }

    if (body.action === 'reset') {
      const sources = resetRssFeeds();
      return Response.json({ sources });
    }

    return Response.json({ error: `不支持的指令: ${body.action}` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message || '操作失败' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const u = new URL(request.url);
    const id = u.searchParams.get('id');
    if (!id) return Response.json({ error: '缺少订阅源 ID' }, { status: 400 });

    const success = deleteRssFeed(id);
    return Response.json({ success });
  } catch (e) {
    return Response.json({ error: e.message || '删除失败' }, { status: 500 });
  }
}
