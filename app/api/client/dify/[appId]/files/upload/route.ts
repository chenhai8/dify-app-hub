import { withAccount } from '@/lib/account-access'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'

import { createDifyApiResponse, createFormDataProxy, handleApiError } from '@/lib/api-utils'
import { getBoundUser } from '@/lib/account-request'
import { recordUserFile } from '@/repository/user-files'
import { getAppItem } from '@/repository/app'

/**
 * 上传文件到 Dify
 */
async function accountPOST(
	request: NextRequest,
	{ params }: { params: Promise<{ appId: string }> },
) {
	try {
		const { appId } = await params

		// 获取应用配置
		const app = await getAppItem(appId)
		if (!app) {
			return createDifyApiResponse({ error: 'App not found' }, 404)
		}

		// 构建代理 FormData
		const proxyFormData = await createFormDataProxy(request)

		// 代理请求到 Dify API
		const response = await fetch(`${app.requestConfig.apiBase}/files/upload`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${app.requestConfig.apiKey}`,
			},
			body: proxyFormData,
		})
		const data = await response.json()
		if (response.ok && typeof data.id === 'string') {
			await recordUserFile(appId, data.id, getBoundUser(request))
		}
		return createDifyApiResponse(data, response.status)
	} catch (error) {
		const resolvedParams = await params
		return handleApiError(error, `Error uploading file for ${resolvedParams.appId}`)
	}
}

export const POST = withAccount(accountPOST)
