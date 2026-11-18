import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { bindAccountRequest, getBoundUser } from '@/lib/account-request'
import { isCurrentAccount } from '@/lib/account-policy'

const mocks = vi.hoisted(() => ({
	session: vi.fn(),
	fetch: vi.fn(),
	app: vi.fn(),
	owns: vi.fn(),
	record: vi.fn(),
}))
vi.mock('next-auth/next', () => ({ getServerSession: mocks.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/repository/app', () => ({ getAppItem: mocks.app, getAppList: mocks.app }))
vi.mock('@/repository/user-files', () => ({
	ownsUserFile: mocks.owns,
	recordUserFile: mocks.record,
}))
import { assertSameOrigin, withAccount } from '@/lib/account-access'
import { GET as conversations } from '@/app/api/client/dify/[appId]/conversations/route'
import { GET as messages } from '@/app/api/client/dify/[appId]/conversation/[conversationId]/messages/route'
import { POST as chat } from '@/app/api/client/dify/[appId]/chat-messages/route'
import { DELETE as remove } from '@/app/api/client/dify/[appId]/conversation/[conversationId]/route'
import { POST as rename } from '@/app/api/client/dify/[appId]/conversation/[conversationId]/name/route'
import { POST as upload } from '@/app/api/client/dify/[appId]/files/upload/route'
import { GET as preview } from '@/app/api/client/dify/[appId]/files/[fileId]/preview/route'
import { POST as annotation } from '@/app/api/client/dify/[appId]/annotations/route'
import { GET as apps } from '@/app/api/client/apps/route'
import { listApp, createApp, deleteApp, getApp, updateApp } from '@/app/app-management/actions'

const context = {
	params: Promise.resolve({
		appId: 'app1',
		conversationId: 'bob-conversation',
		fileId: 'bob-file',
	}),
}
const alice = { id: 'alice', role: 'user', difyUserId: 'hub_alice' }
const account = (user = alice) => ({ user })
const request = (path: string, method = 'GET', data?: unknown) =>
	new NextRequest('http://hub.test' + path, {
		method,
		headers: { 'x-user-id': 'hub_bob', ...(data ? { 'content-type': 'application/json' } : {}) },
		...(data ? { body: JSON.stringify(data) } : {}),
	})

beforeEach(() => {
	vi.resetAllMocks()
	vi.unstubAllEnvs()
	mocks.session.mockResolvedValue(account())
	mocks.app.mockResolvedValue({
		id: 'app1',
		requestConfig: { apiBase: 'http://dify.test/v1', apiKey: 'server-only-key' },
	})
	mocks.fetch.mockResolvedValue(Response.json({ data: [] }))
	mocks.owns.mockResolvedValue(false)
	vi.stubGlobal('fetch', mocks.fetch)
})

describe('server account boundary', () => {
	it('does not accept a forged identity header without binding', () => {
		expect(() => getBoundUser(request('/'))).toThrow('Account identity is required')
	})
	it('overwrites repeated query identities', async () => {
		const bound = await bindAccountRequest(request('/?user=bob&user=charlie'), 'hub_alice')
		expect(bound.nextUrl.searchParams.getAll('user')).toEqual(['hub_alice'])
		expect(bound.headers.has('x-user-id')).toBe(false)
		expect(getBoundUser(bound)).toBe('hub_alice')
	})
	it('keeps upload bytes while replacing all multipart identity values', async () => {
		const form = new FormData()
		form.append('user', 'bob')
		form.append('user', 'charlie')
		form.append('file', new File(['document'], 'test.txt', { type: 'text/plain' }))
		const bound = await bindAccountRequest(
			new NextRequest('http://hub.test/upload', { method: 'POST', body: form }),
			'hub_alice',
		)
		const result = await bound.formData()
		expect(result.getAll('user')).toEqual(['hub_alice'])
		expect(await (result.get('file') as File).text()).toBe('document')
	})
	it('rejects unauthenticated API calls before contacting Dify', async () => {
		mocks.session.mockResolvedValue(null)
		expect((await conversations(request('/?user=bob'), context)).status).toBe(401)
		expect(mocks.app).not.toHaveBeenCalled()
		expect(mocks.fetch).not.toHaveBeenCalled()
	})
	it('rejects invalidated sessions with no user', async () => {
		mocks.session.mockResolvedValue({})
		expect((await apps(request('/apps'))).status).toBe(401)
	})
	it('rejects malformed bodies without contacting Dify', async () => {
		const req = new NextRequest('http://hub.test/chat', {
			method: 'POST',
			body: '[]',
			headers: { 'content-type': 'application/json' },
		})
		expect((await chat(req, context)).status).toBe(400)
		expect(mocks.fetch).not.toHaveBeenCalled()
	})
	it('rejects cross-origin writes', async () => {
		const req = new NextRequest('http://hub.test/chat', {
			method: 'POST',
			headers: { origin: 'http://other.test' },
			body: '{}',
		})
		expect((await chat(req, context)).status).toBe(403)
		expect(mocks.fetch).not.toHaveBeenCalled()
	})
	it('adds no-store to user-specific responses', async () => {
		const response = await conversations(request('/?user=bob'), context)
		expect(response.headers.get('cache-control')).toBe('no-store, private')
	})
})

describe('reverse proxy HTTP origin', () => {
	it('accepts the configured IP origin when Next runs on an internal address', () => {
		vi.stubEnv('NEXTAUTH_URL', 'http://10.2.96.233:19500')
		const req = new NextRequest('http://localhost:5300/chat', {
			method: 'POST',
			headers: { origin: 'http://10.2.96.233:19500' },
			body: '{}',
		})
		expect(() => assertSameOrigin(req)).not.toThrow()
	})
	it('does not trust a client origin matching only the internal host', () => {
		vi.stubEnv('NEXTAUTH_URL', 'http://10.2.96.233:19500')
		const req = new NextRequest('http://localhost:5300/chat', {
			method: 'POST',
			headers: { origin: 'http://localhost:5300' },
			body: '{}',
		})
		expect(() => assertSameOrigin(req)).toThrow('请求来源不被允许')
	})
})

describe('Dify history and send identity', () => {
	it('lists the same history identity across independent browser requests', async () => {
		for (const supplied of ['fingerprint-1', 'fingerprint-2']) {
			await conversations(request('/?user=' + supplied), context)
		}
		expect(mocks.fetch.mock.calls.map(([url]) => new URL(url).searchParams.get('user'))).toEqual([
			'hub_alice',
			'hub_alice',
		])
	})
	it('uses another logged-in account identity instead of the supplied identity', async () => {
		mocks.session.mockResolvedValue(account({ id: 'bob', role: 'user', difyUserId: 'hub_bob' }))
		await conversations(request('/?user=hub_alice'), context)
		expect(new URL(mocks.fetch.mock.calls[0][0]).searchParams.get('user')).toBe('hub_bob')
	})
	it('sends only the current identity with a forged conversation ID', async () => {
		mocks.fetch.mockImplementation(async (url: string) =>
			Response.json({ error: 'Conversation Not Exists' }, { status: 404 }),
		)
		const result = await messages(request('/?user=hub_bob'), context)
		expect(result.status).toBe(404)
		const url = new URL(mocks.fetch.mock.calls[0][0])
		expect(url.searchParams.get('user')).toBe('hub_alice')
		expect(url.searchParams.get('conversation_id')).toBe('bob-conversation')
	})
	it.each([
		['chat', chat],
		['delete', remove],
		['rename', rename],
	] as const)('%s overrides JSON and header identities', async (_name, handler) => {
		await handler(
			request('/endpoint', _name === 'delete' ? 'DELETE' : 'POST', {
				user: 'hub_bob',
				query: 'hello',
				name: 'name',
			}),
			context,
		)
		const options = mocks.fetch.mock.calls[0][1]
		expect(JSON.parse(options.body).user).toBe('hub_alice')
		expect(options.headers.Authorization).toBe('Bearer server-only-key')
	})
	it('client app list hides keys', async () => {
		mocks.app.mockResolvedValue([
			{ id: 'app1', requestConfig: { apiBase: 'http://dify.test/v1', apiKey: 'server-only-key' } },
		])
		const response = await apps(request('/apps'))
		expect(await response.text()).not.toContain('server-only-key')
	})
})

describe('files and management permissions', () => {
	it('records uploaded file ownership using the authenticated identity', async () => {
		mocks.fetch.mockResolvedValue(Response.json({ id: 'file1' }, { status: 201 }))
		const form = new FormData()
		form.set('user', 'hub_bob')
		form.set('file', new File(['hi'], 'hello.txt'))
		const response = await upload(
			new NextRequest('http://hub.test/upload', { method: 'POST', body: form }),
			context,
		)
		expect(response.status).toBe(201)
		expect(mocks.record).toHaveBeenCalledWith('app1', 'file1', 'hub_alice')
		expect(mocks.fetch.mock.calls[0][1].body.get('user')).toBe('hub_alice')
	})
	it('cannot download a guessed file from another account', async () => {
		expect((await preview(request('/preview?user=hub_bob'), context)).status).toBe(404)
		expect(mocks.owns).toHaveBeenCalledWith('app1', 'bob-file', 'hub_alice')
		expect(mocks.fetch).not.toHaveBeenCalled()
	})
	it('can preview an owned upload', async () => {
		mocks.owns.mockResolvedValue(true)
		mocks.fetch.mockResolvedValue(
			new Response('file bytes', { headers: { 'content-type': 'text/plain' } }),
		)
		const response = await preview(request('/preview'), context)
		expect(await response.text()).toBe('file bytes')
	})
	it('denies annotation writes to ordinary accounts', async () => {
		expect((await annotation(request('/annotations', 'POST', {}), context)).status).toBe(403)
		expect(mocks.fetch).not.toHaveBeenCalled()
	})
	it.each([
		() => listApp(),
		() => getApp('app1'),
		() => deleteApp('app1'),
		() => createApp({} as never),
		() => updateApp({} as never),
	])('denies direct management Server Actions to ordinary accounts', async action => {
		await expect(action()).rejects.toMatchObject({ status: 403 })
		expect(mocks.app).not.toHaveBeenCalled()
	})
	it('allows the administrator through the explicit role boundary', async () => {
		mocks.session.mockResolvedValue(account({ ...alice, role: 'admin' }))
		const protectedHandler = withAccount(async () => Response.json({ ok: true }), true)
		expect((await protectedHandler(request('/admin'))).status).toBe(200)
	})
})

describe('session revocation policy', () => {
	it.each([
		[undefined, 0, false],
		[{ enabled: false, sessionVersion: 1 }, 1, false],
		[{ enabled: true, sessionVersion: 2 }, 1, false],
		[{ enabled: true, sessionVersion: 2 }, undefined, false],
		[{ enabled: true, sessionVersion: 2 }, 2, true],
	])('checks deletion, disable and password/session version changes', (row, version, valid) => {
		expect(isCurrentAccount(row, version)).toBe(valid)
	})
})
