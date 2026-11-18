import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@ant-design/x-sdk', () => ({ AbstractChatProvider: class {} }))
vi.mock('@/lib/helpers', () => ({ isTempId: (id?: string) => id?.startsWith('temp') ?? false }))
vi.mock('@/lib/core', () => ({ Roles: { AI: 'assistant', USER: 'user' } }))
vi.mock('@/lib/api', () => ({
	EventEnum: {
		MESSAGE: 'message',
		AGENT_MESSAGE: 'agent_message',
		AGENT_THOUGHT: 'agent_thought',
		MESSAGE_REPLACE: 'message_replace',
		MESSAGE_END: 'message_end',
		WORKFLOW_STARTED: 'workflow_started',
	},
}))
vi.mock('@/hooks/useX/workflow-data-storage', () => ({ default: { set: vi.fn() } }))
import { CustomProvider } from '@/hooks/useX/x-provider'

beforeEach(() => vi.stubGlobal('window', { location: { pathname: '/chat/app1' } }))
afterEach(() => vi.unstubAllGlobals())

describe('Chatflow conversation ID notification', () => {
	it('notifies the layout after early workflow frames with the same conversation ID', () => {
		const changed = vi.fn()
		const provider = new CustomProvider({ onConversationIdChange: changed } as never)
		const frame = (event: string) => ({
			originMessage: { id: 'message-1', content: '', workflows: { nodes: [] } },
			chunk: {
				data: JSON.stringify({
					event,
					conversation_id: 'conversation-1',
					message_id: 'message-1',
					answer: 'hello',
					data: {},
				}),
			},
		})
		provider.transformMessage(frame('workflow_started') as never)
		expect(changed).not.toHaveBeenCalled()
		provider.transformMessage(frame('message') as never)
		expect(changed).toHaveBeenCalledExactlyOnceWith('conversation-1')
		provider.transformMessage(frame('message') as never)
		expect(changed).toHaveBeenCalledTimes(1)
	})
})
