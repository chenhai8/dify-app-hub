import { mysqlTable, varchar, primaryKey } from 'drizzle-orm/mysql-core'

/** 记录上传归属，文件预览接口不得仅凭 fileId 授权 */
export const userFiles = mysqlTable(
	'user_files',
	{
		appId: varchar('app_id', { length: 36 }).notNull(),
		fileId: varchar('file_id', { length: 36 }).notNull(),
		userId: varchar('user_id', { length: 128 }).notNull(),
	},
	table => [primaryKey({ columns: [table.appId, table.fileId] })],
)
