import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({
	session: vi.fn(),
	getDb: vi.fn(),
	update: vi.fn(),
	rows: [] as unknown[][],
}))
vi.mock('next-auth/next', () => ({ getServerSession: mocks.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/db', () => ({ getDb: mocks.getDb }))
import { GET, POST } from '@/app/api/users/route'
import { PUT, DELETE } from '@/app/api/users/[id]/route'

const params = { params: Promise.resolve({ id: 'bob' }) }
const request = (method: string, body?: unknown) =>
	new NextRequest('http://hub.test/api/users', {
		method,
		...(body
			? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }
			: {}),
	})
beforeEach(() => {
	vi.resetAllMocks()
	mocks.session.mockResolvedValue({ user: { id: 'admin', role: 'admin', difyUserId: 'hub_admin' } })
	mocks.rows = []
	mocks.getDb.mockReturnValue({
		select: () => ({
			from: () => ({ where: () => ({ limit: async () => mocks.rows.shift() || [] }) }),
		}),
		update: () => ({ set: mocks.update.mockReturnValue({ where: async () => ({}) }) }),
	})
})
describe('account management authorization', () => {
	it.each([
		{ call: () => GET(request('GET')) },
		{ call: () => POST(request('POST', {})) },
		{ call: () => PUT(request('PUT', {}), params) },
		{ call: () => DELETE(request('DELETE'), params) },
	])('blocks ordinary users before opening the database', async ({ call }) => {
		mocks.session.mockResolvedValue({
			user: { id: 'ordinary', role: 'user', difyUserId: 'hub_ordinary' },
		})
		expect((await call()).status).toBe(403)
		expect(mocks.getDb).not.toHaveBeenCalled()
	})
	it.each([{ role: 'user' }, { enabled: false }])(
		'prevents self-lockout of the active administrator',
		async changes => {
			const result = await PUT(
				request('PUT', { name: 'Admin', email: 'admin@test.com', ...changes }),
				{ params: Promise.resolve({ id: 'admin' }) },
			)
			expect(result.status).toBe(400)
			expect(mocks.update).not.toHaveBeenCalled()
		},
	)
	it('rejects passwords exceeding bcrypt byte limits', async () => {
		const result = await POST(
			request('POST', { name: 'Bob', email: 'bob@test.com', password: '密'.repeat(25) }),
		)
		expect(result.status).toBe(400)
	})
	it('increments the session version when disabling an account and does not accept a new Dify identity', async () => {
		mocks.rows = [
			[{ id: 'bob', email: 'bob@test.com' }],
			[{ id: 'bob' }],
			[{ id: 'bob', enabled: false }],
		]
		const result = await PUT(
			request('PUT', {
				name: 'Bob',
				email: 'bob@test.com',
				enabled: false,
				difyUserId: 'hub_someone_else',
			}),
			params,
		)
		expect(result.status).toBe(200)
		expect(mocks.update.mock.calls[0][0]).toMatchObject({ enabled: false })
		expect(mocks.update.mock.calls[0][0].sessionVersion).toBeDefined()
		expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('difyUserId')
	})
})
