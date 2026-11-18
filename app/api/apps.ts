import { requireAccount } from '@/lib/account-access'
import { getAppList } from '@/repository/app'

export const dynamic = 'force-dynamic'

export const GET = async () => {
	await requireAccount(true)
	const apps = await getAppList()
	return new Response(JSON.stringify(apps), {
		headers: {
			'Content-Type': 'application/json',
		},
	})
}
