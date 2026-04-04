'use client'

import { useState, useEffect } from 'react'
import { Package, Check, ArrowRight, Tag, Shield } from 'lucide-react'

interface Product {
  id: number
  name: string
  quota_count: number
  price: number
  cost: number
  sort_order: number
}

export default function PricingPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const mockProducts: Product[] = [
        { id: 1, name: 'Single Purchase', quota_count: 1, price: 0.5, cost: 0.05, sort_order: 1 },
        { id: 2, name: '10-Pack', quota_count: 10, price: 4.0, cost: 0.50, sort_order: 2 },
        { id: 3, name: '50-Pack', quota_count: 50, price: 15.0, cost: 2.50, sort_order: 3 },
      ]
      setProducts(mockProducts)
      setSelectedProductId(2)
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async (productId: number) => {
    try {
      const res = await fetch('/api/order/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          paymentMethod: 'paypal',
        }),
      })

      const data = await res.json()

      if (data.success) {
        // 存储订单号到 sessionStorage（用于支付成功后回调）
        sessionStorage.setItem('orderNo', data.data.orderNo)

        // 跳转到 PayPal 支付页面
        if (data.data.paymentLink) {
          window.location.href = data.data.paymentLink
        } else {
          alert('Order created successfully, but payment link is missing. Order No: ' + data.data.orderNo)
        }
      } else {
        alert('Failed to create order: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to create order:', error)
      alert('Failed to create order, please try again later')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg" />
            <h1 className="text-xl font-bold text-gray-800">bg-remover</h1>
          </div>
          <a
            href="/"
            className="text-gray-600 hover:text-gray-800 transition-colors font-medium"
          >
            Back to Home
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h2>
          <p className="text-lg text-gray-600">
            Simple and transparent pricing, no hidden fees
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {products.map((product) => (
              <div
                key={product.id}
                className={`
                  bg-white rounded-2xl shadow-lg overflow-hidden transition-all
                  ${selectedProductId === product.id
                    ? 'ring-2 ring-orange-500 shadow-2xl scale-105'
                    : 'hover:shadow-xl hover:scale-105'
                  }
                `}
                onClick={() => setSelectedProductId(product.id)}
              >
                <div
                  className={`
                    px-6 py-8 text-center
                    ${
                      product.id === 2
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                        : 'bg-gray-50 text-gray-900'
                    }
                  `}
                >
                  <h3 className="text-2xl font-bold mb-2">
                    {product.name}
                  </h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-extrabold">
                      ¥{product.price.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1">
                    <Package className="w-5 h-5" />
                    <span className="text-lg font-medium">
                      {product.quota_count} times
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">
                      Price per use:
                      <span className="font-semibold text-gray-900">
                        ¥{(product.price / product.quota_count).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">
                        Packages are valid forever, no expiration
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">
                        High-quality AI background removal
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">
                        Supports multiple image formats
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">
                        Fast processing, instant results
                      </span>
                    </li>
                  </ul>

                  <button
                    onClick={() => handlePurchase(product.id)}
                    className={`
                      mt-6 w-full py-3 rounded-lg font-semibold transition-all
                      ${
                        product.id === 2
                          ? 'bg-orange-600 text-white hover:bg-orange-700'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }
                    `}
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-orange-50 rounded-xl p-6 border border-orange-200">
            <div className="flex items-start gap-3">
              <Tag className="w-6 h-6 text-orange-600 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-orange-900 mb-2">
                  💡 New User Bonus
                </h4>
                <p className="text-sm text-orange-800">
                  Sign up now and get 3 free credits, valid forever! Experience high-quality AI background removal service immediately.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-xl p-6 border border-green-200">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900 mb-2">
                  🔒 Secure Payment
                </h4>
                <p className="text-sm text-green-800">
                  We use Google OAuth for login to ensure your account security. Payment is processed through PayPal, with refund support.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-gray-200 pt-8">
        <div className="text-center text-sm text-gray-600">
          <p className="mb-2">
            All packages are one-time payments, no monthly fees, no subscription fees
          </p>
          <p>
            For questions, please visit{' '}
            <a
              href="https://github.com/wuji007a/bg-remover/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              GitHub Issues
            </a>{' '}
            to contact us
          </p>
        </div>
      </footer>
    </div>
  )
}
