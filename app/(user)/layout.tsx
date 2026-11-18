'use client'

import { ThemeContextProvider, useThemeContext } from '@/lib/theme'
import { App, ConfigProvider, Spin, theme } from 'antd'
import { signOut, useSession } from 'next-auth/react'
import zhCN from 'antd/es/locale/zh_CN'
import enUS from 'antd/es/locale/en_US'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { activateWorkflowCache } from '@/hooks/useX/workflow-data-storage'
import { activateThinkTimeCache } from '@/hooks/useX/think-time-storage'
import { useAuth } from '@/hooks/use-auth'
import { initResponsiveConfig } from '@/lib/helpers'

import '@/libs/i18n'

initResponsiveConfig()

function UserLayoutInner({ children }: { children: React.ReactNode }) {
	const { isAuthorized, loading } = useAuth()
	const { data: session } = useSession()
	const initialAccount = useRef<string | null>(null)
	const [readyAccount, setReadyAccount] = useState<string | null>(null)
	useEffect(() => {
		const id = session?.user?.id
		if (!id) return
		let active = true
		Promise.all([activateWorkflowCache(id), activateThinkTimeCache(id)])
			.then(() => {
				if (active) setReadyAccount(id)
			})
			.catch(() => {
				if (active) window.location.replace('/login')
			})
		return () => {
			active = false
		}
	}, [session?.user?.id])
	useEffect(() => {
		const id = session?.user?.id
		if (id && initialAccount.current && id !== initialAccount.current) window.location.reload()
		if (id) initialAccount.current = id
	}, [session?.user?.id])
	const pathname = usePathname()
	const router = useRouter()
	const { i18n } = useTranslation()
	const { isDark } = useThemeContext()

	useEffect(() => {
		if (!loading && !isAuthorized && pathname !== '/auth') {
			window.location.replace('/login')
		}
	}, [isAuthorized, loading, pathname, router])

	if (
		!isAuthorized ||
		readyAccount !== session?.user?.id ||
		(initialAccount.current && initialAccount.current !== session?.user?.id)
	)
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Spin />
			</div>
		)

	return (
		<ConfigProvider
			locale={i18n.language === 'en' ? enUS : zhCN}
			theme={{
				algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
			}}
		>
			<App>
				<div className="flex items-center justify-end gap-4 border-b px-4 py-2 text-sm">
					<span>{session?.user?.name || session?.user?.email}</span>
					{session?.user?.role === 'admin' && <a href="/app-management">管理后台</a>}
					<button
						type="button"
						onClick={() => signOut({ callbackUrl: '/login' })}
					>
						退出登录
					</button>
				</div>
				<div key={session?.user?.id}>{children}</div>
			</App>
		</ConfigProvider>
	)
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
	return (
		<ThemeContextProvider>
			<UserLayoutInner>{children}</UserLayoutInner>
		</ThemeContextProvider>
	)
}
