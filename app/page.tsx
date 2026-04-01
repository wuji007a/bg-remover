'use client'

import { useState, useCallback, DragEvent, ChangeEvent, useEffect } from 'react'
import { Package, ShoppingCart, X } from 'lucide-react'
import QuotaBadge from '@/components/quota-badge'
import QuotaModal from '@/components/quota-modal'

// Google OAuth 配置（从环境变量读取，或使用默认值）
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '1006021607677-s5p3qn6jbfe72faj4q4tioro7fdgfv7s.apps.googleusercontent.com';
const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || 'https://bg-remover-6dp.pages.dev/api/auth/callback';

export default function Home() {
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false)

  // 初始化时检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setUser(data.user);
          }
        }
      } catch (err) {
        console.error('检查登录状态失败:', err);
      }
    };

    checkAuth();
  }, []);

  // 处理 Google 登录
  const handleGoogleLogin = () => {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=openid%20email%20profile&` +
      `access_type=offline`;
    window.location.href = authUrl;
  };

  const handleLogout = () => {
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setUser(null);
  };

  const handleFile = useCallback(async (file: File) => {
    // 检查配额
    try {
      const quotaRes = await fetch('/api/quota')
      const quotaData = await quotaRes.json()

      if (quotaData.success && quotaData.data.total === 0) {
        // 配额不足，显示弹窗
        setIsQuotaModalOpen(true)
        return
      }
    } catch (err) {
      console.error('检查配额失败:', err)
    }

    // 验证文件类型
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('请上传 JPG、PNG 或 WebP 格式的图片')
      return
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('图片大小不能超过 10MB')
      return
    }

    setError(null)
    setResultImage(null)
    setLoading(true)

    // 显示原图预览
    const reader = new FileReader()
    reader.onload = () => {
      setOriginalImage(reader.result as string)
    }
    reader.readAsDataURL(file)

    // 调用 API
    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch('/api/remove-bg', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '处理失败')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setResultImage(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDownload = useCallback(() => {
    if (!resultImage) return

    const link = document.createElement('a')
    link.href = resultImage
    link.download = `removed_bg_${Date.now()}.png`
    link.click()
  }, [resultImage])

  const handleReset = useCallback(() => {
    setOriginalImage(null)
    setResultImage(null)
    setError(null)
  }, [])

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 标题和用户信息 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-800">
              🖼️ BG Remover
            </h1>
            {user && (
              <div className="flex items-center gap-3">
                <QuotaBadge />
                <a
                  href="/pricing"
                  className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>购买套餐</span>
                </a>
              </div>
            )}
          </div>

          {/* 用户登录/退出 */}
          {user ? (
            <div className="flex items-center gap-4">
              <img
                src={user.picture}
                alt={user.name}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-gray-700 text-sm">{user.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-700"
              >
                退出
              </button>
            </div>
          ) : null}
        </div>
        <p className="text-gray-600 text-center">一键去除图片背景，快速且免费</p>
      </div>

      {/* 登录后显示 Google 登录按钮 */}
      {!user && (
        <div className="flex justify-center mb-8">
          <button
            onClick={handleGoogleLogin}
            className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all shadow-sm"
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt="Google"
              className="w-5 h-5"
            />
            <span className="text-gray-700 font-medium">使用 Google 登录</span>
          </button>
        </div>
      )}

      {/* 提示：未登录无法使用 */}
      {!user && (
        <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-8">
          <p className="text-yellow-800">🔐 请先登录以使用去背景功能</p>
        </div>
      )}

      {/* 上传区域 */}
      {user && !originalImage && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('fileInput')?.click()}
          className={`
            border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer
            transition-all duration-200
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }
          `}
        >
          <div className="text-6xl mb-4">📤</div>
          <p className="text-xl text-gray-600 mb-2">
            拖拽图片到这里，或点击上传
          </p>
          <p className="text-sm text-gray-400">
            支持 JPG、PNG、WebP，最大 10MB
          </p>
          <input
            id="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-center">
          ❌ {error}
        </div>
      )}

      {/* 处理中状态 */}
      {loading && (
        <div className="mt-8 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">正在去除背景...</p>
        </div>
      )}

      {/* 结果预览 */}
      {originalImage && !loading && (
        <div className="mt-8">
          <div className="grid md:grid-cols-2 gap-6">
            {/* 原图 */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">原图</h3>
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                <img
                  src={originalImage}
                  alt="原图"
                  className="w-full h-auto rounded-lg"
                />
              </div>
            </div>

            {/* 结果图 */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">去背景结果</h3>
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                {resultImage ? (
                  <div className="checkerboard rounded-lg">
                    <img
                      src={resultImage}
                      alt="结果"
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-400">
                    等待处理...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={handleDownload}
              disabled={!resultImage}
              className={`
                px-6 py-3 rounded-lg font-medium transition-all
                ${resultImage
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              📥 下载 PNG
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
            >
              🔄 重新上传
            </button>
          </div>
        </div>
      )}

      {/* 配额不足弹窗 */}
      <QuotaModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />

      {/* 页脚 */}
      <footer className="mt-16 text-center text-gray-400 text-sm">
        Powered by ClipDrop API • Made with Next.js
      </footer>
    </main>
  )
}
