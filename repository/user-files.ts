import 'server-only'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { userFiles } from '@/db/schema'

export async function recordUserFile(appId: string, fileId: string, userId: string) {
	await getDb().insert(userFiles).values({ appId, fileId, userId })
}

export async function ownsUserFile(
	appId: string,
	fileId: string,
	userId: string,
): Promise<boolean> {
	const rows = await getDb()
		.select({ fileId: userFiles.fileId })
		.from(userFiles)
		.where(
			and(eq(userFiles.appId, appId), eq(userFiles.fileId, fileId), eq(userFiles.userId, userId)),
		)
		.limit(1)
	return rows.length === 1
}
