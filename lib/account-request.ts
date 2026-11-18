import { NextRequest } from 'next/server'

const identities = new WeakMap<NextRequest, string>()

/** 身份由服务端写入请求对象，客户端同名 Header 不具有授权效力 */
export function getBoundUser(request: NextRequest): string {
	const user = identities.get(request)
	if (!user) throw new Error('Account identity is required')
	return user
}

/** 覆盖所有客户端身份入口，保留应用输入和二进制附件 */
export async function bindAccountRequest(request: NextRequest, user: string): Promise<NextRequest> {
	const url = new URL(request.url)
	url.searchParams.set('user', user)
	const headers = new Headers(request.headers)
	headers.delete('x-user-id')
	headers.delete('content-length')
	let body: BodyInit | undefined
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		const contentType = headers.get('content-type') || ''
		if (contentType.includes('multipart/form-data')) {
			const form = await request.formData()
			form.set('user', user)
			headers.delete('content-type')
			body = form
		} else {
			const text = await request.text()
			const data = text ? JSON.parse(text) : {}
			if (!data || typeof data !== 'object' || Array.isArray(data)) {
				throw new SyntaxError('Request body must be an object')
			}
			body = JSON.stringify({ ...data, user })
			headers.set('content-type', 'application/json')
		}
	}
	const bound = new NextRequest(url, {
		method: request.method,
		headers,
		body,
		signal: request.signal,
	})
	identities.set(bound, user)
	return bound
}
