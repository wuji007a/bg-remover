import { NextRequest, NextResponse } from 'next/server'
import { createPayPalOrder, getPayPalConfig } from '@/lib/paypal'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * 创建订单
 *
 * 功能：
 * 1. 验证用户登录状态
 * 2. 查询产品信息
 * 3. 检查支付方式
 * 4. 创建订单记录
 * 5. 生成订单号
 * 6. 创建支付订单（PayPal）
 *
 * 支持的支付方式：
 * - paypal（已上线）
 * - wechat（暂未接入）
 * - alipay（暂未接入）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, paymentMethod } = body

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: '请选择产品'
      }, { status: 400 })
    }

    // 获取用户 token
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json({
        success: false,
        error: '请先登录',
        needLogin: true
      }, { status: 401 })
    }

    // 解码 token 获取用户 ID
    let decoded: any
    try {
      decoded = JSON.parse(Buffer.from(token, 'base64').toString())
    } catch (e) {
      console.error('Token decode error:', e)
      decoded = null
    }

    if (!decoded || !decoded.userId) {
      return NextResponse.json({
        success: false,
        error: '无效的登录状态，请重新登录',
        needLogin: true
      }, { status: 401 })
    }

    const userId = decoded.userId
    console.log(`🔍 用户 ID：${userId}`)

    // 获取 D1 数据库实例
    const DB = (process.env as any).DB

    if (!DB) {
      return NextResponse.json({
        success: false,
        error: 'D1 数据库未配置'
      }, { status: 500 })
    }

    // ============================================
    // 1. 查询产品信息
    // ============================================
    const product = await DB.prepare(`
      SELECT * FROM products WHERE id = ? AND is_active = 1
    `).bind(productId).first() as {
      id: number
      name: string
      quota_count: number
      price: number
      cost: number
    } | null

    if (!product) {
      return NextResponse.json({
        success: false,
        error: '产品不存在或已下架'
      }, { status: 404 })
    }

    console.log(`✅ 产品查询成功：${product.name}（${product.quota_count}次，¥${product.price}）`)

    // ============================================
    // 2. 检查支付方式
    // ============================================
    const availableMethods = {
      'paypal': { enabled: true, name: 'PayPal', note: '已上线' },
      'wechat': { enabled: false, name: '微信支付', note: '暂未接入' },
      'alipay': { enabled: false, name: '支付宝', note: '暂未接入' }
    }

    const methodInfo = availableMethods[paymentMethod as keyof typeof availableMethods]

    if (!methodInfo) {
      return NextResponse.json({
        success: false,
        error: '不支持的支付方式',
        availableMethods: Object.keys(availableMethods)
      }, { status: 400 })
    }

    if (!methodInfo.enabled) {
      return NextResponse.json({
        success: false,
        error: `${methodInfo.name} ${methodInfo.note}`,
        method: methodInfo
      }, { status: 503 })
    }

    // ============================================
    // 3. 生成订单号
    // ============================================
    const timestamp = Date.now().toString()
    const random = Math.random().toString(36).substring(2, 11)
    const orderNo = `BG${timestamp}${random}`

    console.log(`✅ 订单号生成：${orderNo}`)

    // ============================================
    // 4. 创建订单
    // ============================================
    const result = await DB.prepare(`
      INSERT INTO orders (order_no, user_id, product_id, amount, quota_awarded, payment_method, payment_provider)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderNo,
      userId,
      productId,
      product.price,
      product.quota_count,
      paymentMethod,
      paymentMethod
    ).run()

    console.log(`✅ 订单创建成功：${orderNo}（¥${product.price}，${product.quota_count}次）`)

    // ============================================
    // 5. 创建支付订单（PayPal）
    // ============================================
    let paymentData: any = null

    if (paymentMethod === 'paypal') {
      try {
        const paypalConfig = getPayPalConfig()
        const paypalOrder = await createPayPalOrder(
          paypalConfig,
          orderNo,
          product.price
        )

        if (!paypalOrder.success) {
          // PayPal 订单创建失败，回滚本地订单
          await DB.prepare(`
            DELETE FROM orders WHERE order_no = ?
          `).bind(orderNo).run()

          return NextResponse.json({
            success: false,
            error: 'PayPal 订单创建失败',
            details: paypalOrder.error
          }, { status: 500 })
        }

        paymentData = {
          paypalOrderId: paypalOrder.orderId,
          paymentLink: paypalOrder.paymentLink,
          amount: paypalOrder.amount,
          currency: paypalOrder.currency,
        }

        // 更新订单表，记录 PayPal 订单 ID
        await DB.prepare(`
          UPDATE orders
          SET payment_provider_order_id = ?
          WHERE order_no = ?
        `).bind(paypalOrder.orderId, orderNo).run()

        console.log(`✅ PayPal 订单创建成功：${paypalOrder.orderId}`)
      } catch (error: any) {
        console.error('PayPal integration error:', error)

        // PayPal 集成失败，回滚本地订单
        await DB.prepare(`
          DELETE FROM orders WHERE order_no = ?
        `).bind(orderNo).run()

        return NextResponse.json({
          success: false,
          error: 'PayPal 集成失败',
          details: error.message
        }, { status: 500 })
      }
    }

    // ============================================
    // 6. 返回订单信息
    // ============================================
    return NextResponse.json({
      success: true,
      data: {
        orderNo,
        productId,
        productName: product.name,
        quotaAwarded: product.quota_count,
        amount: product.price,
        paymentMethod,
        paymentProvider: paymentMethod,
        status: 0, // 0=待支付
        createdAt: new Date().toISOString(),
        ...paymentData,
      },
      message: '订单创建成功'
    })

  } catch (error: any) {
    console.error('Error:', error)

    return NextResponse.json({
      success: false,
      error: error.message || '服务器错误'
    }, { status: 500 })
  }
}
