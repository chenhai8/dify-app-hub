import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { count } from 'drizzle-orm'
import { getDb } from '@/db'
import { users } from '@/db/schema'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
	try {
		const db = getDb()
		const result = await db.select({ count: count() }).from(users)
		if ((result[0]?.count ?? 0) > 0) {
			return NextResponse.json({ message: '已经初始化过了' }, { status: 400 })
		}
		const { name, email, password } = await request.json()
		if (
			typeof name !== 'string' ||
			name.length > 255 ||
			typeof email !== 'string' ||
			email.length > 255 ||
			!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
			typeof password !== 'string' ||
			password.length < 8 ||
			new TextEncoder().encode(password).length > 72
		) {
			return NextResponse.json(
				{ message: '账号信息无效，密码须为8位以上且不超过72字节' },
				{ status: 400 },
			)
		}
		if (!name || !email || !password) {
			return NextResponse.json({ message: '姓名、邮箱和密码都是必填项' }, { status: 400 })
		}
		const hashedPassword = await bcrypt.hash(password, 12)
		await db.insert(users).values({ name, email, password: hashedPassword, role: 'admin' })
		return NextResponse.json({ message: '初始化成功' }, { status: 201 })
	} catch (error) {
		console.error('初始化失败:', error)
		return NextResponse.json({ message: '服务器错误' }, { status: 500 })
	}
}
