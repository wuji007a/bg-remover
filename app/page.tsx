'use client'

import { useState, useCallback, DragEvent, ChangeEvent, useEffect } from 'react'
import { Package, ShoppingCart, X } from 'lucide-react'
import QuotaBadge from '@/components/quota-badge'
import QuotaModal from '@/components/quota-modal'

// Google OAuth configuration (read from environment variables, or use default values)
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
  const [quotaKey, setQuotaKey] = useState(0) // 用于刷新配额显示

  // Check login status on initialization
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
        console.error('Failed to check login status:', err);
      }
    };

    checkAuth();
  }, []);

  // Handle Google login
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
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan1970 00:00:00 GMT';
    setUser(null);
  };

  const handleFile = useCallback(async (file: File) => {
    // Check quota
    try {
      const quotaRes = await fetch('/api/quota')
      const quotaData = await quotaRes.json()

      if (quotaData.success && quotaData.data.total === 0) {
        // Insufficient quota, show modal
        setIsQuotaModalOpen(true)
        return
      }
    } catch (err) {
      console.error('Quota check failed:', err)
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Please upload JPG, PNG or WebP format image')
      return
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size cannot exceed 10MB')
      return
    }

    setError(null)
    setResultImage(null)
    setLoading(true)

    // Show original image preview
    const reader = new FileReader()
    reader.onload = () => {
      setOriginalImage(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Call API
    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch('/api/remove-bg', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Processing failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setResultImage(url)

      // 刷新配额显示
      setQuotaKey(prev => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed, please try again')
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
      {/* Header and user info */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-800">
              🖼️ BG Remover
            </h1>
            {user && (
              <div className="flex items-center gap-3">
                <QuotaBadge key={quotaKey} />
                <a
                  href="/pricing"
                  className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Packages</span>
                </a>
              </div>
            )}
          </div>

          {/* User login/logout */}
          {user ? (
            <div className="flex items-center gap-4">
              <img
                src={user.picture}
                alt={user.name}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-gray-700 text-sm truncate max-w-[120px]" title={user.name}>
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
        <p className="text-gray-600 text-center">One-click background removal, fast and free</p>
      </div>

      {/* Show Google login button after login prompt */}
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
            <span className="text-gray-700 font-medium">Sign in with Google</span>
          </button>
        </div>
      )}

      {/* Prompt: Login required */}
      {!user && (
        <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-8">
          <p className="text-yellow-800">🔐 Please login to use the background removal feature</p>
        </div>
      )}

      {/* Upload area */}
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
            Drag & drop an image here, or click to upload
          </p>
          <p className="text-sm text-gray-400">
            Supports JPG, PNG, WebP, max 10MB
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

      {/* Error message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-center">
          ❌ {error}
        </div>
      )}

      {/* Processing state */}
      {loading && (
        <div className="mt-8 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Removing background...</p>
        </div>
      )}

      {/* Result preview */}
      {originalImage && !loading && (
        <div className="mt-8">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Original image */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">Original Image</h3>
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                <img
                  src={originalImage}
                  alt="Original Image"
                  className="w-full h-auto rounded-lg"
                />
              </div>
            </div>

            {/* Result */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">Background Removed</h3>
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                {resultImage ? (
                  <div className="checkerboard rounded-lg">
                    <img
                      src={resultImage}
                      alt="Result"
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-400">
                    Processing...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
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
              📥 Download PNG
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
            >
              🔄 Upload New
            </button>
          </div>
        </div>
      )}

      {/* Insufficient quota modal */}
      <QuotaModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />

      {/* Footer */}
      <footer className="mt-16 text-center text-gray-400 text-sm">
        Powered by ClipDrop API • Made with Next.js
      </footer>
    </main>
  )
}
