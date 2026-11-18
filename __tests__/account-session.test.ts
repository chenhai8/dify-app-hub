import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rows: [] as unknown[] }))
vi.mock('@/db', () => ({
	getDb: () => ({
		select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.rows }) }) }),
	}),
}))
import { authOptions } from '@/lib/auth'

beforeEach(() => {
	mocks.rows = []
})

describe('JWT session database validation', () => {
	it('copies the account identity only after password authorization', async () => {
		const user = { id: 'a', role: 'user', difyUserId: 'hub_a', sessionVersion: 2 }
		const token = await authOptions.callbacks.jwt({ token: {}, user })
		expect(token).toMatchObject(user)
	})
	it.each([
		{ rows: [] },
		{ rows: [{ enabled: false, role: 'user', difyUserId: 'hub_a', sessionVersion: 2 }] },
		{ rows: [{ enabled: true, role: 'user', difyUserId: 'hub_a', sessionVersion: 3 }] },
	])('rejects deleted, disabled and password-revoked accounts', async ({ rows }) => {
		mocks.rows = rows
		expect(await authOptions.callbacks.jwt({ token: { id: 'a', sessionVersion: 2 } })).toBeNull()
	})
	it('refreshes roles from the database and keeps the stable identity', async () => {
		mocks.rows = [{ enabled: true, role: 'user', difyUserId: 'hub_a', sessionVersion: 2 }]
		const token = await authOptions.callbacks.jwt({
			token: { id: 'a', role: 'admin', difyUserId: 'forged', sessionVersion: 2 },
		})
		expect(token).toMatchObject({ role: 'user', difyUserId: 'hub_a' })
	})
	it('does not leave a usable user on a session without a valid token', () => {
		const result = authOptions.callbacks.session({ session: { user: { id: 'old' } }, token: null })
		expect(result.user).toBeUndefined()
	})
})
