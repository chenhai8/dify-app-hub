import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	output: 'standalone',
	turbopack: {
		root: path.resolve(__dirname),
	},
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					// 助手使用同源登录，不开放跨域凭据
					{ key: 'X-Content-Type-Options', value: 'nosniff' },
					{ key: 'Referrer-Policy', value: 'same-origin' },
					{ key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
					{
						key: 'Access-Control-Allow-Headers',
						value:
							'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-USER-ID',
					},
				],
			},
		]
	},
}

export default nextConfig
