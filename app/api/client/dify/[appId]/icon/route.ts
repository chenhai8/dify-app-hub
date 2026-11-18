import { NextRequest } from 'next/server'

import { withAccount } from '@/lib/account-access'
import { proxyDifyRequest } from '@/lib/api-utils'
import { getAppItem } from '@/repository/app'

export const dynamic = 'force-dynamic'

const SIGNED_PREVIEW_PATH = /^\/files\/[a-f0-9-]{36}\/file-preview$/i
const ALLOWED_IMAGE_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
	'image/bmp',
	'image/x-icon',
])

export const GET = withAccount(
	async (_request: NextRequest, { params }: { params: Promise<{ appId: string }> }) => {
		const { appId } = await params
		const app = await getAppItem(appId)
		if (!app) return new Response(null, { status: 404 })

		const { apiBase, apiKey } = app.requestConfig
		const requestOptions = { redirect: 'error', signal: AbortSignal.timeout(8000) } as const
		const settings = await proxyDifyRequest(apiBase, apiKey, '/site', requestOptions)
		if (!settings.ok) return new Response(null, { status: 502 })
		const { icon_type, icon_url } = await settings.json()
		if (icon_type !== 'image' || typeof icon_url !== 'string') {
			return new Response(null, { status: 404 })
		}
		const origin = new URL(apiBase).origin
		const signed = URL.parse(icon_url, origin)
		if (!signed || !SIGNED_PREVIEW_PATH.test(signed.pathname)) {
			return new Response(null, { status: 404 })
		}

		// 仅使用 Dify 返回的当前应用图标路径和签名，连接应用已配置的 API 服务
		const target = new URL(signed.pathname + signed.search, origin)
		const image = await fetch(target, requestOptions)
		const type = image.headers.get('content-type')?.split(';')[0].trim() ?? ''
		if (!image.ok || !ALLOWED_IMAGE_TYPES.has(type)) {
			await image.body?.cancel()
			return new Response(null, { status: 502 })
		}

		return new Response(image.body, {
			headers: { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' },
		})
	},
)
