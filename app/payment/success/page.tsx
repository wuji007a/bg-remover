'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [orderNo, setOrderNo] = useState<string | null>(null)
  const [quota, setQuota] = useState<number>(0)

  useEffect(() => {
    const processPayment = async () => {
      // 从 sessionStorage 中获取订单号（在跳转到 PayPal 之前存储）
      const orderNo = sessionStorage.getItem('orderNo')
      const token = searchParams.get('token')
      const payerId = searchParams.get('PayerID')

      if (!orderNo || !token || !payerId) {
        setStatus('error')
        return
      }

      try {
        // 调用后端接口处理支付成功
        const response = await fetch('/api/order/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderNo,
            status: 'success',
            paymentMethod: 'paypal',
            transactionId: token,
          }),
        })

        const data = await response.json()

        if (data.success) {
          setStatus('success')
          setOrderNo(data.data.orderNo)
          setQuota(data.data.quotaAwarded)

          // 清除 sessionStorage 中的订单号
          sessionStorage.removeItem('orderNo')
        } else {
          setStatus('error')
        }
      } catch (error) {
        console.error('Payment processing error:', error)
        setStatus('error')
      }
    }

    processPayment()
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {status === 'loading' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800">处理支付中...</h2>
            <p className="text-gray-600 mt-2">请稍候，我们正在确认您的支付</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">支付成功！</h2>
            <p className="text-gray-600 mb-4">
              您已成功购买 {quota} 次去背景服务配额
            </p>
            {orderNo && (
              <p className="text-sm text-gray-500 mb-6">
                订单号：{orderNo}
              </p>
            )}
            <div className="space-y-3">
              <Link
                href="/"
                className="block w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
              >
                开始使用
              </Link>
              <Link
                href="/pricing"
                className="block w-full bg-gray-100 text-gray-800 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                返回定价页面
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">支付失败</h2>
            <p className="text-gray-600 mb-6">
              抱歉，支付处理失败，请重试或联系客服
            </p>
            <div className="space-y-3">
              <Link
                href="/pricing"
                className="block w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
              >
                返回重试
              </Link>
              <Link
                href="/"
                className="block w-full bg-gray-100 text-gray-800 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                返回首页
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">加载中...</p>
      </div>
    </div>}>
      <PaymentSuccessContent />
    </Suspense>
  )
}
