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
 * 3. 创建订单记录
 * 4. 生成订单号
 * 5. 返回 PayPal 支付链接（用户跳转到 PayPal 支付，支付成功后会通过 return_url 回来）
 *
 * 支持的支付方式：
 * - paypal（已上线）
 * - wechat（暂未接入）
 * - alipay（暂未接入）
 */
export async function POST(request: NextRequest) {
  console.log('\n========================================')
  console.log('📝 开始处理订单创建请求')
  console.log('========================================\n')

  try {
    const body = await request.json()
    const { productId, paymentMethod } = body

    console.log('请求参数:')
    console.log('  - productId:', productId)
    console.log('  - paymentMethod:', paymentMethod)

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: '请选择产品'
      }, { status: 400 })
    }

    // 获取用户 token
    const token = request.cookies.get('auth_token')?.value
    console.log('用户 token:', token ? `存在 (${token.substring(0, 30)}...)` : '不存在')

    if (!token) {
      return NextResponse.json({
        success: false,
        error: '请先登录',
        needLogin: true
      }, { status: 401 })
    }

    // 解码 token 获取用户 ID（这是数据库 ID，整数）
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

    const userId = decoded.userId  // 这是数据库 ID（整数）
    const googleId = decoded.googleId  // 这是 Google ID（字符串，用于其他用途）

    console.log('数据库 ID:', userId)
    console.log('Google ID:', googleId)

    // 获取 D1 数据库实例
    const DB = (process.env as any).DB

    if (!DB) {
      return NextResponse.json({
        success: false,
        error: 'D1 数据库未配置'
      }, { status: 500 })
    }

    // ============================================
    // 1. 从 users 表查询用户信息
    // ============================================
    console.log('\n📊 步骤 1: 查询用户')

    const user = await DB.prepare(`
      SELECT id, email, name FROM users WHERE id = ?
    `).bind(userId).first() as {
      id: number
      email: string
      name: string
    } | null

    if (!user) {
      return NextResponse.json({
        success: false,
        error: '用户不存在，请重新登录',
        needLogin: true
      }, { status: 403 })
    }

    console.log('✅ 查询到用户:')
    console.log('  - 数据库 ID:', user.id)
    console.log('  - 邮箱:', user.email)
    console.log('  - 姓名:', user.name)

    const dbUserId = user.id  // 使用数据库 ID（整数）

    // ============================================
    // 2. 查询产品信息
    // ============================================
    console.log('\n📊 步骤 2: 查询产品')

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

    console.log('✅ 查询到产品:')
    console.log('  - ID:', product.id)
    console.log('  - 名称:', product.name)
    console.log('  - 配额:', product.quota_count)
    console.log('  - 价格: ¥', product.price)

    // ============================================
    // 3. 检查支付方式
    // ============================================
    console.log('\n📊 步骤 3: 检查支付方式')

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

    console.log('✅ 支付方式验证通过:', methodInfo.name)

    // ============================================
    // 4. 生成订单号
    // ============================================
    console.log('\n📊 步骤 4: 生成订单号')

    const timestamp = Date.now().toString()
    const random = Math.random().toString(36).substring(2, 11)
    const orderNo = `BG${timestamp}${random}`

    console.log('✅ 订单号生成：', orderNo)

    // ============================================
    // 5. 创建订单
    // ============================================
    console.log('\n📊 步骤 5: 创建本地订单')

    const result = await DB.prepare(`
      INSERT INTO orders (order_no, user_id, product_id, amount, quota_awarded, payment_method, payment_provider)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderNo,
      dbUserId,  // 使用数据库 ID（整数）
      productId,
      product.price,
      product.quota_count,
      paymentMethod,
      paymentMethod
    ).run()

    console.log('✅ 订单创建成功：', orderNo)
    console.log('  - 金额: ¥', product.price)
    console.log('  - 配额:', product.quota_count)

    // ============================================
    // 6. 创建 PayPal 订单并获取支付链接
    // ============================================
    console.log('\n📊 步骤 6: 创建 PayPal 订单')

    let paymentData: any = null

    if (paymentMethod === 'paypal') {
      try {
        console.log('📡 获取 PayPal 配置...')
        const paypalConfig = getPayPalConfig()

        console.log('📡 调用 createPayPalOrder...')
        const paypalOrder = await createPayPalOrder(
          paypalConfig,
          orderNo,
          product.price
        )

        if (!paypalOrder.success) {
          console.error('❌ PayPal 订单创建失败')
          console.error('  - 错误:', paypalOrder.error)

          // PayPal 订单创建失败，回滚本地订单
          console.log('📡 回滚本地订单...')
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

        console.log('✅ PayPal 订单创建成功')
        console.log('  - PayPal 订单 ID:', paypalOrder.orderId)
        console.log('  - 支付链接:', paypalOrder.paymentLink)
        console.log('  - 金额:', paypalOrder.amount, paypalOrder.currency)
      } catch (error: any) {
        console.error('❌ PayPal 集成异常')
        console.error('  - 错误名称:', error.name)
        console.error('  - 错误消息:', error.message)
        console.error('  - 错误堆栈:', error.stack)

        // PayPal 集成失败，回滚本地订单
        console.log('📡 回滚本地订单...')
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
    // 7. 返回订单信息
    // ============================================
    console.log('\n📊 步骤 7: 返回订单信息')
    console.log('========================================')
    console.log('✅ 订单创建成功！')
    console.log('========================================\n')

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
    console.error('\n========================================')
    console.error('❌ 订单创建异常')
    console.error('========================================\n')
    console.error('  - 错误名称:', error.name)
    console.error('  - 错误消息:', error.message)
    console.error('  - 错误堆栈:', error.stack)
    console.error('========================================\n')

    return NextResponse.json({
      success: false,
      error: error.message || '服务器错误'
    }, { status: 500 })
  }
}
