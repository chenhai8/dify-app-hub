import { withAccount } from '@/lib/account-access'
import { NextResponse } from 'next/server'

import { createSafeApp, handleApiError } from '@/lib/api-utils'
import { getAppList } from '@/repository/app'

export const dynamic = 'force-dynamic'

/**
 * 获取应用列表 (供客户端使用)
 *
 * @returns 应用列表，但不包含敏感的 API Key
 */
async function accountGET() {
	try {
		const apps = await getAppList()

		// 过滤敏感信息，不返回 API Key 到客户端
		const safeApps = apps.map(createSafeApp)

		return NextResponse.json(safeApps)
	} catch (error) {
		return handleApiError(error, 'Error fetching apps for client')
	}
}

export const GET = withAccount(accountGET)
