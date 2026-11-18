import bcrypt from 'bcryptjs'
import { requireAccount, withAccount } from '@/lib/account-access'
import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '@/db'
import { users } from '@/db/schema'

export const dynamic = 'force-dynamic'

async function adminGET() {
	try {
		const db = getDb()
		const session = await requireAccount(true)
		if (!session) return NextResponse.json({ message: '未授权' }, { status: 401 })
		const allUsers = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				role: users.role,
				enabled: users.enabled,
				createdAt: users.createdAt,
				updatedAt: users.updatedAt,
			})
			.from(users)
			.orderBy(desc(users.createdAt))
		return NextResponse.json(allUsers)
	} catch (error) {
		console.error('获取用户列表失败:', error)
		return NextResponse.json({ message: '服务器错误' }, { status: 500 })
	}
}

async function adminPOST(request: NextRequest) {
	try {
		const db = getDb()
		const session = await requireAccount(true)
		if (!session) return NextResponse.json({ message: '未授权' }, { status: 401 })
		const { name, email, password, role = 'user', enabled = true } = await request.json()
		if (
			typeof name !== 'string' ||
			name.length > 255 ||
			typeof email !== 'string' ||
			email.length > 255 ||
			!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
			typeof password !== 'string' ||
			password.length < 8 ||
			new TextEncoder().encode(password).length > 72 ||
			!['admin', 'user'].includes(role) ||
			typeof enabled !== 'boolean'
		) {
			return NextResponse.json(
				{ message: '账号信息无效，密码须为8位以上且不超过72字节' },
				{ status: 400 },
			)
		}
		if (!name || !email || !password)
			return NextResponse.json({ message: '姓名、邮箱和密码都是必填项' }, { status: 400 })
		const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
		if (rows[0]) return NextResponse.json({ message: '该邮箱已被使用' }, { status: 400 })
		const hashedPassword = await bcrypt.hash(password, 12)
		await db.insert(users).values({ name, email, password: hashedPassword, role, enabled })
		const newRows = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				role: users.role,
				enabled: users.enabled,
				createdAt: users.createdAt,
				updatedAt: users.updatedAt,
			})
			.from(users)
			.where(eq(users.email, email))
			.limit(1)
		return NextResponse.json(newRows[0], { status: 201 })
	} catch (error) {
		console.error('创建用户失败:', error)
		return NextResponse.json({ message: '服务器错误' }, { status: 500 })
	}
}

export const GET = withAccount(adminGET, true)

export const POST = withAccount(adminPOST, true)
