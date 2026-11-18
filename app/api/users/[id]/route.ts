import bcrypt from 'bcryptjs'
import { requireAccount, withAccount } from '@/lib/account-access'
import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { users } from '@/db/schema'

export const dynamic = 'force-dynamic'

async function adminPUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const db = getDb()
		const session = await requireAccount(true)
		if (!session) return NextResponse.json({ message: '未授权' }, { status: 401 })
		const { id } = await params
		const { name, email, password, role, enabled } = await request.json()
		if (
			typeof name !== 'string' ||
			name.length > 255 ||
			typeof email !== 'string' ||
			email.length > 255 ||
			!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
			(role !== undefined && !['admin', 'user'].includes(role)) ||
			(enabled !== undefined && typeof enabled !== 'boolean') ||
			(password !== undefined &&
				(typeof password !== 'string' ||
					(password.length > 0 &&
						(password.length < 8 || new TextEncoder().encode(password).length > 72))))
		) {
			return NextResponse.json({ message: '账号信息或密码无效' }, { status: 400 })
		}
		if (id === session.id && (role === 'user' || enabled === false)) {
			return NextResponse.json({ message: '不能停用自己或移除自己的管理员权限' }, { status: 400 })
		}
		if (!name || !email)
			return NextResponse.json({ message: '姓名和邮箱都是必填项' }, { status: 400 })
		const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
		if (!rows[0]) return NextResponse.json({ message: '用户不存在' }, { status: 404 })
		const emailRows = await db.select().from(users).where(eq(users.email, email)).limit(1)
		if (emailRows[0] && emailRows[0].id !== id)
			return NextResponse.json({ message: '该邮箱已被其他用户使用' }, { status: 400 })
		const updateData: Record<string, unknown> = { name, email, updatedAt: new Date() }
		if (role !== undefined) updateData.role = role
		if (enabled !== undefined) updateData.enabled = enabled
		if (password || role !== undefined || enabled !== undefined || email !== rows[0].email) {
			updateData.sessionVersion = sql`${users.sessionVersion} + 1`
		}
		if (password) updateData.password = await bcrypt.hash(password, 12)
		await db.update(users).set(updateData).where(eq(users.id, id))
		const updated = await db
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
			.where(eq(users.id, id))
			.limit(1)
		return NextResponse.json(updated[0])
	} catch (error) {
		console.error('更新用户失败:', error)
		return NextResponse.json({ message: '服务器错误' }, { status: 500 })
	}
}

async function adminDELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const db = getDb()
		const session = await requireAccount(true)
		if (!session) return NextResponse.json({ message: '未授权' }, { status: 401 })
		const { id } = await params
		if (session.id === id)
			return NextResponse.json({ message: '不能删除自己的账户' }, { status: 400 })
		const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
		if (!rows[0]) return NextResponse.json({ message: '用户不存在' }, { status: 404 })
		await db.delete(users).where(eq(users.id, id))
		return NextResponse.json({ message: '删除成功' })
	} catch (error) {
		console.error('删除用户失败:', error)
		return NextResponse.json({ message: '服务器错误' }, { status: 500 })
	}
}

export const PUT = withAccount(adminPUT, true)

export const DELETE = withAccount(adminDELETE, true)
