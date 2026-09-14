import { NextResponse } from 'next/server.js';
import { verifySession } from './lib/auth-token.mjs';

export async function middleware(request) {
  const pathname = request.nextUrl ? request.nextUrl.pathname : new URL(request.url).pathname;

  // 1. 放行 Next 静态资源与资产文件
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next();
  }

  // 2. 检验 radar_session Cookie
  let cookieVal = request.cookies?.get('radar_session')?.value;
  if (!cookieVal && request.headers) {
    const headerCookie = request.headers.get('cookie') || '';
    const match = headerCookie.match(/(?:^|;\s*)radar_session=([^;]+)/);
    if (match) cookieVal = match[1];
  }
  const session = cookieVal ? await verifySession(cookieVal) : null;
  const isAuthenticated = Boolean(session && session.exp > Date.now());

  // 3. 访问登录页面
  if (pathname === '/login') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // 4. 开放认证接口
  if (pathname === '/api/auth') {
    return NextResponse.next();
  }

  // 5. 拦截未登录访问
  if (!isAuthenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '未授权，请先登录系统' }, { status: 401 });
    }

    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('from', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
