'use client'

import { Spin } from 'antd'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ReactNode, useEffect } from 'react'

interface AuthGuardProps {
	children: ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
	const { data: session, status } = useSession()
	const router = useRouter()

	useEffect(() => {
		if (status === 'loading') return // 仍在加载中

		if (!session?.user?.id) {
			router.push('/login')
		} else if (session.user.role !== 'admin') {
			router.replace('/apps')
		}
	}, [session, status, router])

	if (status === 'loading') {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Spin size="large" />
			</div>
		)
	}

	if (!session?.user?.id || session.user.role !== 'admin') {
		return null
	}

	return <>{children}</>
}
