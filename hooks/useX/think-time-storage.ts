import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { indexedDBStorage } from '@/lib/helpers/indexeddb-storage'

interface ThinkTimeStore {
	data: Record<string, number>
	setTime: (key: string, elapsedTime: number) => void
	getTime: (key: string) => number | undefined
}

const useThinkTimeStore = create<ThinkTimeStore>()(
	persist(
		(set, get) => ({
			data: {},
			setTime: (key, elapsedTime) => {
				// 已有值不覆盖（保留首次记录的精确时间）
				if (get().data[key] !== undefined) return
				set(state => ({ data: { ...state.data, [key]: elapsedTime } }))
			},
			getTime: key => get().data[key],
		}),
		{
			name: 'think-time-storage',
			storage: createJSONStorage(() => indexedDBStorage),
			partialize: state => ({ data: state.data }),
			skipHydration: true,
			merge: (persisted, current) => ({
				...current,
				data: (persisted as Partial<ThinkTimeStore> | undefined)?.data ?? {},
			}),
		},
	),
)

/** 切换账号时隔离思考时长缓存，不加载匿名浏览器状态 */
export async function activateThinkTimeCache(accountId: string): Promise<void> {
	useThinkTimeStore.persist.setOptions({ name: 'think-time-storage:' + accountId })
	await useThinkTimeStore.persist.rehydrate()
}

export const getThinkTime = (key: string) => useThinkTimeStore.getState().getTime(key)
export const setThinkTime = (key: string, elapsedTime: number) =>
	useThinkTimeStore.getState().setTime(key, elapsedTime)

export default useThinkTimeStore
