'use client'

import { useState, useEffect } from 'react'
import { X, Package, ArrowRight } from 'lucide-react'

interface QuotaModalProps {
  isOpen: boolean
  onClose: () => void
}

interface Product {
  id: number
  name: string
  quota_count: number
  price: number
  sort_order: number
}

export default function QuotaModal({ isOpen, onClose }: QuotaModalProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchProducts()
    }
  }, [isOpen])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      // Fetch product information from database (temporarily hardcoded, should be fetched from API)
      const mockProducts: Product[] = [
        { id: 1, name: 'Single Purchase', quota_count: 1, price: 0.5, sort_order: 1 },
        { id: 2, name: '10-Pack', quota_count: 10, price: 4.0, sort_order: 2 },
        { id: 3, name: '50-Pack', quota_count: 50, price: 15.0, sort_order: 3 },
      ]
      setProducts(mockProducts)
      setSelectedProductId(2) // Default to 10-Pack
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
        // Redirect to PayPal payment page
        // TODO: Actual PayPal redirect
        alert('Order created successfully! Order No: ' + data.data.orderNo)
        onClose()
      } else {
        alert('Failed to create order: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to create order:', error)
      alert('Failed to create order, please try again later')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-8 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">Quota Exhausted</h2>
              <p className="text-orange-100">
                Your quota has been used up. Select a plan to continue using
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className={`
                    border-2 rounded-xl p-5 cursor-pointer transition-all
                    ${selectedProductId === product.id
                      ? 'border-orange-500 shadow-lg scale-105'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }
                  `}
                  onClick={() => setSelectedProductId(product.id)}
                >
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2 text-gray-800">
                      {product.name}
                    </h3>

                    <div className="mb-3">
                      <span className="text-3xl font-bold text-orange-600">
                        ¥{product.price.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-1 text-gray-600 mb-4">
                      <Package className="w-4 h-4" />
                      <span className="text-lg font-medium">
                        {product.quota_count} times
                      </span>
                    </div>

                    {/* Show price per use */}
                    <div className="text-sm text-gray-500">
                      ¥{(product.price / product.quota_count).toFixed(2)} / use
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hint */}
          <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-sm text-orange-800">
              <span className="font-semibold">💡 Tip:</span>
              Packages are valid forever with no expiration. We recommend purchasing the 10-Pack or 50-Pack for more savings!
            </p>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium"
            >
              Maybe Later
            </button>
            <button
              onClick={() => selectedProductId && handlePurchase(selectedProductId)}
              disabled={!selectedProductId}
              className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Buy Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
