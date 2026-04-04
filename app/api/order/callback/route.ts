import { NextRequest, NextResponse } from 'next/server'

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
 * 说明：
 * - 这个 API 由前端在 PayPal 支付成功后调用
 * - PayPal 支付成功后，会通过 return_url 跳转回 /payment/success
 * - 前端从 URL 参数中提取订单号，然后调用这个 API 发放配额
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

    console.log('📝 收到支付回调:', { orderNo, status, paymentMethod, transactionId })

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
      console.error('❌ 订单不存在:', orderNo)
      return NextResponse.json({
        success: false,
        error: '订单不存在'
      }, { status: 404 })
    }

    // 检查订单状态，避免重复处理
    if (order.status === 1) {
      console.log('✅ 订单已支付，跳过处理:', orderNo)
      return NextResponse.json({
        success: true,
        data: {
          orderNo,
          status: order.status,
          message: '订单已支付'
        }
      })
    }

    // ============================================
    // 2. 处理支付成功
    // ============================================
    if (status === 'success' || status === 'paid') {
      console.log('✅ 处理支付成功:', orderNo)

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

      console.log('✅ 更新订单状态:', orderNo, '→ 已支付')

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
      console.log('❌ 处理支付失败:', orderNo, status)

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
    console.error('❌ 支付回调异常:', error)
    console.error('  - 错误名称:', error.name)
    console.error('  - 错误消息:', error.message)
    console.error('  - 错误堆栈:', error.stack)

    return NextResponse.json({
      success: false,
      error: error.message || '服务器错误'
    }, { status: 500 })
  }
}

/**
 * Webhook 端点说明
 *
 * 说明：由于 Cloudflare Edge Runtime 环境限制，
 * Webhook 签名验证功能暂时无法使用。
 * 因此本系统采用前端回调方式处理支付成功事件，
 * 而不依赖 PayPal Webhook。
 *
 * 支付流程：
 * 1. 用户点击购买
 * 2. 创建订单，获取 PayPal 支付链接
 * 3. 用户在 PayPal 完成支付
 * 4. PayPal 重定向到 /payment/success?token=xxx
 * 5. 前端从 URL 中提取订单号（需要我们在 return_url 中传递）
 * 6. 前端调用 POST /api/order/callback 发放配额
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: '支付回调端点正常',
    note: '本系统使用前端回调方式，不依赖 Webhook',
    endpoint: '/api/order/callback',
    method: 'POST'
  })
}
