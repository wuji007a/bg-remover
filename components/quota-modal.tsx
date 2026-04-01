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
      // 从数据库获取产品信息（这里暂时硬编码，实际应该从 API 获取）
      const mockProducts: Product[] = [
        { id: 1, name: '单次购买', quota_count: 1, price: 0.5, sort_order: 1 },
        { id: 2, name: '10次优惠包', quota_count: 10, price: 4.0, sort_order: 2 },
        { id: 3, name: '50次超值包', quota_count: 50, price: 15.0, sort_order: 3 },
      ]
      setProducts(mockProducts)
      setSelectedProductId(2) // 默认选择 10 次包
    } catch (error) {
      console.error('获取产品失败:', error)
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
        // 跳转到 PayPal 支付页面
        // TODO: 实际跳转到 PayPal
        alert('订单创建成功！订单号：' + data.data.orderNo)
        onClose()
      } else {
        alert('创建订单失败：' + data.error)
      }
    } catch (error) {
      console.error('创建订单失败:', error)
      alert('创建订单失败，请稍后重试')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-8 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">配额不足</h2>
              <p className="text-orange-100">
                您的配额已用完，选择一个套餐继续使用
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

        {/* 内容 */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">加载中...</div>
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
                        {product.quota_count} 次
                      </span>
                    </div>

                    {/* 显示单次价格 */}
                    <div className="text-sm text-gray-500">
                      ¥{(product.price / product.quota_count).toFixed(2)} / 次
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 提示信息 */}
          <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-sm text-orange-800">
              <span className="font-semibold">💡 提示：</span>
              套餐永久有效，不限使用期限。推荐购买 10 次或 50 次套餐，享受更多优惠！
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium"
            >
              稍后再说
            </button>
            <button
              onClick={() => selectedProductId && handlePurchase(selectedProductId)}
              disabled={!selectedProductId}
              className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>立即购买</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
