import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BG Remover - 一键去背景',
  description: '快速去除图片背景，免费在线工具',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
