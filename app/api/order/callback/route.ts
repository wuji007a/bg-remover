import { NextRequest, NextResponse } from 'next/server'
import { verifyPayPalWebhook, getPayPalConfig } from '@/lib/paypal'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * 支付成功回调（内部 API）
 *
 * 功能：
 * 1. 验证订单号
 * 2. 处理支付成功
 * 3. 发放配额
 * 4. 更新订单状态
 * 5. 更新用户总消费
 *
 * 支持的支付回调：
 * - PayPal（通过 PayPal Token 验证）
 * - 微信支付回调
 * - 支付宝回调
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderNo, status, paymentMethod, transactionId } = body

    if (!orderNo || !status) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数'
      }, { status: 400 })
    }

    // 获取 D1 数据库实例
    const DB = (process.env as any).DB

    if (!DB) {
      return NextResponse.json({
        success: false,
        error: 'D1 数据库未配置'
      }, { status: 500 })
    }

    // ============================================
    // 1. 验证订单号
    // ============================================
    const order = await DB.prepare(`
      SELECT * FROM orders WHERE order_no = ?
    `).bind(orderNo).first() as {
      id: number
      user_id: number
      product_id: number
      amount: number
      quota_awarded: number
      status: number
      payment_method: string
      payment_provider: string
      payment_provider_order_id: string
    } | null

    if (!order) {
      return NextResponse.json({
        success: false,
        error: '订单不存在'
      }, { status: 404 })
    }

    // 检查订单状态
    if (order.status === 1) {
      return NextResponse.json({
        success: false,
        error: '订单已支付',
        orderNo,
        status: order.status
      }, { status: 400 })
    }

    // ============================================
    // 2. 处理支付成功
    // ============================================
    if (status === 'success' || status === 'paid') {
      console.log(`✅ 支付成功：${orderNo}（${paymentMethod}）`)

      // ============================================
      // 3. 发放配额
      // ============================================
      await DB.prepare(`
        INSERT INTO user_quota (user_id, quota_type, total)
        VALUES (?, 2, ?)
      `).bind(order.user_id, order.quota_awarded).run()

      console.log(`✅ 发放配额：用户 ${order.user_id}，${order.quota_awarded}次`)

      // ============================================
      // 4. 更新订单状态
      // ============================================
      await DB.prepare(`
        UPDATE orders
        SET status = 1, paid_at = datetime('now'), payment_method = ?, payment_provider = ?, transaction_id = ?
        WHERE id = ?
      `).bind(
        paymentMethod || order.payment_method,
        paymentMethod || order.payment_provider,
        transactionId,
        order.id
      ).run()

      console.log(`✅ 更新订单状态：${orderNo} → 已支付`)

      // ============================================
      // 5. 更新用户总消费
      // ============================================
      await DB.prepare(`
        UPDATE users
        SET total_spent = total_spent + ?
        WHERE id = ?
      `).bind(order.amount, order.user_id).run()

      console.log(`✅ 更新用户消费：用户 ${order.user_id}，+¥${order.amount}`)

      // ============================================
      // 6. 返回成功信息
      // ============================================
      return NextResponse.json({
        success: true,
        data: {
          orderNo,
          transactionId,
          quotaAwarded: order.quota_awarded,
          amount: order.amount,
          paidAt: new Date().toISOString()
        },
        message: '支付成功，配额已发放'
      })

    } else if (status === 'failed' || status === 'cancelled') {
      console.log(`❌ 支付失败：${orderNo}（${status}）`)

      // 更新订单状态为失败
      await DB.prepare(`
        UPDATE orders
        SET status = 2
        WHERE id = ?
      `).bind(order.id).run()

      return NextResponse.json({
        success: false,
        error: '支付失败',
        orderNo,
        status
      }, { status: 400 })

    } else {
      return NextResponse.json({
        success: false,
        error: '无效的支付状态',
        status
      }, { status: 400 })
    }

  } catch (error: any) {
    console.error('Error:', error)

    return NextResponse.json({
      success: false,
      error: error.message || '服务器错误'
    }, { status: 500 })
  }
}

/**
 * PayPal Webhook 处理
 *
 * PayPal 会通过 Webhook 发送支付通知
 * 需要验证 Webhook 签名
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'PayPal Webhook 端点正常',
    note: '需要在 Cloudflare Pages 中配置 Webhook URL',
    webhookUrl: new URL('/api/order/callback', request.url).toString()
  })
}

/**
 * PayPal Webhook 接收端点
 *
 * 用于接收 PayPal 的支付通知
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.text()
    const headers = request.headers

    // 获取 PayPal 配置
    const paypalConfig = getPayPalConfig()
    const webhookId = process.env.PAYPAL_WEBHOOK_ID

    if (!webhookId) {
      console.error('PAYPAL_WEBHOOK_ID 未配置')
      return NextResponse.json({
        success: false,
        error: 'Webhook 配置不完整'
      }, { status: 500 })
    }

    // 验证 Webhook 签名
    const verification = await verifyPayPalWebhook(
      paypalConfig,
      webhookId,
      headers,
      body
    )

    if (!verification.success || !verification.verified) {
      console.error('Webhook 验证失败')
      return NextResponse.json({
        success: false,
        error: 'Webhook 验证失败'
      }, { status: 401 })
    }

    // 解析 Webhook 事件
    const eventData = JSON.parse(body)
    const eventType = eventData.event_type
    const resource = eventData.resource

    console.log(`📩 PayPal Webhook 事件：${eventType}`)

    // 获取 D1 数据库实例
    const DB = (process.env as any).DB

    if (!DB) {
      return NextResponse.json({
        success: false,
        error: 'D1 数据库未配置'
      }, { status: 500 })
    }

    // 处理支付完成的订单
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'PAYMENT.CAPTURE.DENIED') {
      // 从 PayPal 订单 ID 提取
      const paypalOrderId = resource.id

      if (!paypalOrderId) {
        console.error('无法提取 PayPal 订单 ID')
        return NextResponse.json({
          success: false,
          error: '无法提取 PayPal 订单 ID'
        }, { status: 400 })
      }

      // 通过 PayPal 订单 ID 查询本地订单
      const order = await DB.prepare(`
        SELECT * FROM orders WHERE payment_provider_order_id = ?
      `).bind(paypalOrderId).first() as {
        id: number
        user_id: number
        quota_awarded: number
        amount: number
        status: number
        order_no: string
      } | null

      if (!order) {
        console.error(`订单不存在：PayPal 订单 ID ${paypalOrderId}`)
        return NextResponse.json({
          success: false,
          error: '订单不存在'
        }, { status: 404 })
      }

      // 检查订单状态，避免重复处理
      if (order.status === 1) {
        console.log(`订单已处理：${order.order_no}`)
        return NextResponse.json({
          success: true,
          message: '订单已处理'
        })
      }

      // 只处理成功的情况
      if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        // 发放配额
        await DB.prepare(`
          INSERT INTO user_quota (user_id, quota_type, total)
          VALUES (?, 2, ?)
        `).bind(order.user_id, order.quota_awarded).run()

        console.log(`✅ 发放配额：用户 ${order.user_id}，${order.quota_awarded}次`)

        // 更新订单状态
        await DB.prepare(`
          UPDATE orders
          SET status = 1, paid_at = datetime('now'), transaction_id = ?
          WHERE id = ?
        `).bind(paypalOrderId, order.id).run()

        console.log(`✅ 更新订单状态：${order.order_no} → 已支付`)

        // 更新用户总消费
        await DB.prepare(`
          UPDATE users
          SET total_spent = total_spent + ?
          WHERE id = ?
        `).bind(order.amount, order.user_id).run()

        console.log(`✅ 更新用户消费：用户 ${order.user_id}，+¥${order.amount}`)

        return NextResponse.json({
          success: true,
          message: '支付成功，配额已发放'
        })
      } else {
        // 支付被拒绝
        await DB.prepare(`
          UPDATE orders
          SET status = 2
          WHERE id = ?
        `).bind(order.id).run()

        console.log(`❌ 支付被拒绝：${order.order_no}`)

        return NextResponse.json({
          success: false,
          error: '支付被拒绝',
          orderNo: order.order_no
        }, { status: 400 })
      }
    }

    // 其他事件类型
    return NextResponse.json({
      success: true,
      message: `Webhook 事件已接收：${eventType}`,
      eventType
    })

  } catch (error: any) {
    console.error('PayPal Webhook error:', error)

    return NextResponse.json({
      success: false,
      error: error.message || 'Webhook 处理失败'
    }, { status: 500 })
  }
}
