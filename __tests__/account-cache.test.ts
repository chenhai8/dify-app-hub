import { beforeEach, describe, expect, it, vi } from 'vitest'
const storage = vi.hoisted(() => new Map<string, string>())
vi.mock('@/lib/helpers/indexeddb-storage', () => ({
	indexedDBStorage: {
		getItem: async (key: string) => storage.get(key) ?? null,
		setItem: async (key: string, value: string) => {
			storage.set(key, value)
		},
		removeItem: async (key: string) => {
			storage.delete(key)
		},
	},
}))
import workflowDataStorage, { activateWorkflowCache } from '@/hooks/useX/workflow-data-storage'
import { activateThinkTimeCache, getThinkTime, setThinkTime } from '@/hooks/useX/think-time-storage'
const options = { appId: 'app', conversationId: 'conversation', messageId: 'message', key: 'node' }

beforeEach(() => storage.clear())
describe('account-scoped browser caches', () => {
	it('keeps workflow data isolated even for the same conversation key', async () => {
		await activateWorkflowCache('alice')
		await workflowDataStorage.set({ ...options, value: 'alice private node' })
		await activateWorkflowCache('bob')
		expect(await workflowDataStorage.get(options)).toBeUndefined()
		await workflowDataStorage.set({ ...options, value: 'bob private node' })
		await activateWorkflowCache('alice')
		expect(await workflowDataStorage.get(options)).toBe('alice private node')
	})
	it('does not reuse another account thinking-time cache', async () => {
		await activateThinkTimeCache('alice')
		setThinkTime('message', 1234)
		await activateThinkTimeCache('bob')
		expect(getThinkTime('message')).toBeUndefined()
		await activateThinkTimeCache('alice')
		expect(getThinkTime('message')).toBe(1234)
	})
	it('ignores unscoped anonymous caches without deleting them', async () => {
		storage.set(
			'think-time-storage',
			JSON.stringify({ state: { data: { message: 99 } }, version: 0 }),
		)
		await activateThinkTimeCache('alice')
		expect(getThinkTime('message')).toBeUndefined()
		expect(storage.has('think-time-storage')).toBe(true)
	})
})
