export const ADMIN_ROLE = 'admin'
export const USER_ROLE = 'user'

export function isCurrentAccount(
	account: { enabled: boolean; sessionVersion: number } | undefined,
	sessionVersion: unknown,
): boolean {
	return !!account && account.enabled && account.sessionVersion === sessionVersion
}
