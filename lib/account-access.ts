import { getServerSession } from 'next-auth/next'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { ADMIN_ROLE } from '@/lib/account-policy'
import { bindAccountRequest } from '@/lib/account-request'

export class AccountAccessError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message)
	}
}

/** 每次请求重新验证数据库会话版本，停用和改密后拒绝旧会话 */
export async function requireAccount(admin = false) {
	const session = await getServerSession(authOptions)
	if (!session?.user?.id || !session.user.difyUserId) {
		throw new AccountAccessError(401, '请重新登录')
	}
	if (admin && session.user.role !== ADMIN_ROLE) {
		throw new AccountAccessError(403, '仅管理员可执行此操作')
	}
	return session.user
}

/** Cookie 鉴权的写请求仅接受同源浏览器请求 */
export function assertSameOrigin(request: NextRequest) {
	if (request.method === 'GET' || request.method === 'HEAD') return
	const origin = request.headers.get('origin')
	const expectedOrigin = new URL(process.env.NEXTAUTH_URL || request.url).origin
	if (
		request.headers.get('sec-fetch-site') === 'cross-site' ||
		(origin && origin !== expectedOrigin)
	) {
		throw new AccountAccessError(403, '请求来源不被允许')
	}
}

/** 每个路由直接执行账号校验，不依赖页面跳转或中间件 Header */
export function withAccount<Args extends unknown[]>(
	handler: (request: NextRequest, ...args: Args) => Promise<Response>,
	admin = false,
) {
	return async (request: NextRequest, ...args: Args): Promise<Response> => {
		try {
			assertSameOrigin(request)
			const account = await requireAccount(admin)
			const bound = await bindAccountRequest(request, account.difyUserId)
			const response = await handler(bound, ...args)
			response.headers.set('Cache-Control', 'no-store, private')
			return response
		} catch (error) {
			if (error instanceof AccountAccessError) {
				return NextResponse.json({ message: error.message }, { status: error.status })
			}
			if (error instanceof SyntaxError) {
				return NextResponse.json({ message: '请求格式错误' }, { status: 400 })
			}
			console.error('Account request failed')
			return NextResponse.json({ message: '请求失败，请稍后重试' }, { status: 500 })
		}
	}
}
