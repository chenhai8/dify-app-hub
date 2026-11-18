import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export const useAuth = () => {
	const router = useRouter()
	const { data: session, status } = useSession()
	const userId = session?.user?.difyUserId || ''

	return {
		isAuthorized: status === 'authenticated' && !!userId,
		loading: status === 'loading',
		goAuthorize: () => router.push('/login'),
		userId,
	}
}
