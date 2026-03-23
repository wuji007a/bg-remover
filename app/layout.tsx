import type { Metadata } from 'next'
import Script from 'next/script'
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
      <head>
        <Script
          id="google-oauth-callback"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.handleCredentialResponse = function(response) {
                window.dispatchEvent(new CustomEvent('google-login', { detail: response }));
              };
            `
          }}
        />
        <Script
          src="https://accounts.google.com/gsi/client"
          async
          defer
          strategy="afterInteractive"
        />
      </head>
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
