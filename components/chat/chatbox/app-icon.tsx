import { useDifyChatStore } from '@/lib/core'
import { useThemeContext } from '@/lib/theme'
import { useMemo, useState } from 'react'
import React from 'react'
import data from '@emoji-mart/data'
import { init } from 'emoji-mart'

init({ data })

import { useMount } from 'ahooks'

/**
 * 应用图标
 */
export default function AppIcon(props: { size?: 'small' | 'default'; hasContainer?: boolean }) {
	const { size = 'default', hasContainer = false } = props

	const currentApp = useDifyChatStore(s => s.currentApp)
	const { isDark } = useThemeContext()
	const [failedImage, setFailedImage] = useState<string | null>(null)

	// 初始化 emoji-mart
	useMount(() => {
		init({ data })
	})

	const renderProps = useMemo(() => {
		return {
			background: currentApp?.site?.icon_background || '#ffead5',
			type: currentApp?.site?.icon_type || 'emoji',
			icon:
				currentApp?.site?.icon_type === 'image' && currentApp?.site?.icon_url
					? `/api/client/dify/${encodeURIComponent(currentApp.config.id)}/icon`
					: currentApp?.site?.icon || '🤖',
		}
	}, [currentApp])

	const renderIcon = useMemo(() => {
		if (renderProps.type === 'image') {
			if (failedImage === renderProps.icon)
				return (
					<span
						role="img"
						aria-label="助手图标"
					>
						🤖
					</span>
				)
			return (
				<img
					className="inline-block h-full w-full"
					src={renderProps.icon}
					alt="助手图标"
					onError={() => setFailedImage(renderProps.icon)}
				/>
			)
		}
		const emoji = (data as Record<string, unknown>).emojis as
			| Record<string, { skins?: { native: string }[] }>
			| undefined
		const native = emoji?.[renderProps.icon]?.skins?.[0]?.native
		return native || renderProps.icon || '🤖'
	}, [renderProps, failedImage])

	if (hasContainer) {
		return renderIcon
	}

	return (
		<div
			className={`flex items-center justify-center rounded-lg ${size === 'small' ? "h-9 w-9 text-xl" : "h-11 w-11 text-2xl"} flex items-center overflow-hidden`}
			style={{
				background: isDark ? 'transparent' : renderProps.background,
			}}
		>
			{renderIcon}
		</div>
	)
}
