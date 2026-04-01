import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * 支付成功回调
 *
 * 功能：
 * 1. 验证订单号
 * 2. 处理支付成功
 * 3. 发放配额
 * 4. 更新订单状态
 * 5. 更新用户总消费
 *
 * 支持的支付回调：
 * - PayPal Webhook
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
        SET status = 1, paid_at = datetime('now'), payment_method = ?, payment_provider = ?
        WHERE id = ?
      `).bind(paymentMethod || order.payment_method, paymentMethod || order.payment_provider, order.id).run()

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
