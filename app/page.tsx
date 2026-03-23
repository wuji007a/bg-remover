'use client'

import { useState, useCallback, DragEvent, ChangeEvent, useEffect } from 'react'

const GOOGLE_CLIENT_ID = '1006021607677-s5p3qn6jbfe72faj4q4tioro7fdgfv7s.apps.googleusercontent.com';

export default function Home() {
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [user, setUser] = useState<any>(null)

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

  // 监听 Google 登录事件
  useEffect(() => {
    const handleGoogleLogin = (event: any) => {
      handleCredentialResponse(event.detail);
    };

    window.addEventListener('google-login', handleGoogleLogin);
    return () => window.removeEventListener('google-login', handleGoogleLogin);
  }, []);

  const handleCredentialResponse = async (response: any) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: response.credential })
      });

      const data = await res.json();

      if (data.success) {
        setUser(data.user);
      } else {
        setError(data.error || '登录失败');
      }
    } catch (err) {
      setError('登录失败，请重试');
      console.error(err);
    }
  };

  const handleLogout = () => {
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setUser(null);
  };

  const handleFile = useCallback(async (file: File) => {
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
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          🖼️ BG Remover
        </h1>
        <p className="text-gray-600">一键去除图片背景，快速且免费</p>

        {/* 用户登录/退出 */}
        <div className="mt-4">
          {user ? (
            <div className="flex items-center justify-center gap-4">
              <img
                src={user.picture}
                alt={user.name}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-gray-700">{user.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-700"
              >
                退出登录
              </button>
            </div>
          ) : (
            <div
              id="g_id_onload"
              data-client_id={GOOGLE_CLIENT_ID}
              data-callback="handleCredentialResponse"
              data-auto_prompt="false"
            />
          )}
        </div>
      </div>

      {/* 登录后显示 Google 登录按钮 */}
      {!user && (
        <div className="flex justify-center mb-8">
          <div
            className="g_id_signin"
            data-type="standard"
            data-size="large"
            data-theme="outline"
            data-text="sign_in_with"
            data-shape="rectangular"
            data-logo_alignment="left"
          />
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

      {/* 页脚 */}
      <footer className="mt-16 text-center text-gray-400 text-sm">
        Powered by remove.bg API • Made with Next.js
      </footer>
    </main>
  )
}
