import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
	const { pathname, origin } = request.nextUrl

	// 跳过 API 和静态资源
	if (pathname.startsWith('/api')) return NextResponse.next()
	if (pathname.startsWith('/_next') || pathname === '/favicon.ico') return NextResponse.next()

	// 允许访问初始化页面本身
	if (pathname.startsWith('/init')) return NextResponse.next()

	// 助手页面也要求真实登录，不能仅依赖浏览器本地身份
	if (
		pathname.startsWith('/app-management') ||
		pathname.startsWith('/user-management') ||
		pathname.startsWith('/apps') ||
		pathname.startsWith('/chat')
	) {
		const token = await getToken({ req: request })
		if (!token) {
			return NextResponse.redirect(new URL('/login', request.url))
		}
		if (
			(pathname.startsWith('/app-management') || pathname.startsWith('/user-management')) &&
			token.role !== 'admin'
		) {
			return NextResponse.redirect(new URL('/apps', request.url))
		}
	}

	try {
		const res = await fetch(`${origin}/api/init/status`, { cache: 'no-store' })
		const data = await res.json()
		const isInitialized = !!data.initialized

		if (!isInitialized) {
			const url = new URL('/init', request.url)
			return NextResponse.redirect(url)
		}
	} catch (error) {
		console.error('初始化状态检查失败:', error)
		// 状态检查失败时不阻断访问，允许后续页面处理
	}

	return NextResponse.next()
}

export const config = {
	matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
