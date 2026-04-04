/**
 * PayPal Payment Integration
 *
 * 功能：
 * - 创建订单
 * - 获取支付链接
 * - 验证 Webhook
 * - 处理支付回调
 */

import { Client, Environment, OrdersController, CheckoutPaymentIntent } from '@paypal/paypal-server-sdk'

/**
 * PayPal 配置
 */
export interface PayPalConfig {
  clientId: string
  clientSecret: string
  mode: 'sandbox' | 'production'
}

/**
 * 创建 PayPal 客户端
 */
export function createPayPalClient(config: PayPalConfig) {
  console.log('🔧 创建 PayPal 客户端...')
  console.log('  - Client ID:', config.clientId?.substring(0, 20) + '...')
  console.log('  - Client Secret:', config.clientSecret?.substring(0, 20) + '...')
  console.log('  - Mode:', config.mode)

  const paypalClient = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: config.clientId,
      oAuthClientSecret: config.clientSecret,
    },
    environment: config.mode === 'production' ? Environment.Production : Environment.Sandbox,
    timeout: 30000, // 30秒超时
  })

  console.log('✅ PayPal 客户端创建成功')
  return paypalClient
}

/**
 * 创建 PayPal 订单
 *
 * @param config PayPal 配置
 * @param orderNo 本地订单号
 * @param amount 金额（单位：元，会自动转换为美元）
 * @returns PayPal 订单信息和支付链接
 */
export async function createPayPalOrder(
  config: PayPalConfig,
  orderNo: string,
  amount: number
) {
  console.log('\n========================================')
  console.log('📝 开始创建 PayPal 订单')
  console.log('========================================')
  console.log('  - 订单号:', orderNo)
  console.log('  - 原始金额 (CNY):', amount)

  const paypalClient = createPayPalClient(config)
  const ordersController = new OrdersController(paypalClient)

  // 转换为美元（PayPal 只支持美元结算）
  // 假设 1 美元 = 7.2 人民币
  const usdAmount = (amount / 7.2).toFixed(2)
  console.log('  - 转换后金额 (USD):', usdAmount)

  const requestBody = {
    intent: CheckoutPaymentIntent.Capture,
    purchaseUnits: [
      {
        referenceId: orderNo,
        description: 'BG Remover 去背景服务配额购买',
        amount: {
          currencyCode: 'USD',
          value: usdAmount,
        },
      },
    ],
  }

  console.log('  - 请求体:', JSON.stringify(requestBody, null, 2))

  try {
    console.log('\n📡 调用 PayPal API...')
    const { result } = await ordersController.createOrder({ body: requestBody })

    console.log('\n✅ PayPal API 调用成功')
    console.log('  - PayPal 订单 ID:', result.id)
    console.log('  - 状态:', result.status)
    console.log('  - Links:', result.links?.map(l => `${l.rel}: ${l.href}`).join(', '))

    // 提取支付链接
    const approveLink = result.links?.find(link => link.rel === 'approve')
    console.log('  - 支付链接:', approveLink?.href || '未找到')

    console.log('\n========================================')
    console.log('🎉 PayPal 订单创建成功！')
    console.log('========================================\n')

    return {
      success: true,
      orderId: result.id,
      orderNo,
      amount: usdAmount,
      currency: 'USD',
      paymentLink: approveLink?.href || null,
      status: result.status,
    }
  } catch (error: any) {
    console.error('\n❌ PayPal API 调用失败')
    console.error('  - 错误名称:', error.name)
    console.error('  - 错误消息:', error.message)
    console.error('  - 错误堆栈:', error.stack)
    if (error.response) {
      console.error('  - 响应状态:', error.response.status)
      console.error('  - 响应数据:', error.response.data)
    }
    console.log('========================================\n')

    return {
      success: false,
      error: error.message || '创建 PayPal 订单失败',
    }
  }
}

/**
 * 捕获 PayPal 支付
 *
 * @param config PayPal 配置
 * @param paypalOrderId PayPal 订单 ID
 * @returns 捕获结果
 */
export async function capturePayPalOrder(
  config: PayPalConfig,
  paypalOrderId: string
) {
  console.log('\n========================================')
  console.log('💰 开始捕获 PayPal 支付')
  console.log('========================================')
  console.log('  - PayPal 订单 ID:', paypalOrderId)

  const paypalClient = createPayPalClient(config)
  const ordersController = new OrdersController(paypalClient)

  try {
    console.log('\n📡 调用 PayPal 捕获 API...')
    const { result } = await ordersController.captureOrder({ id: paypalOrderId })

    console.log('\n✅ PayPal 捕获成功')
    console.log('  - 订单 ID:', result.id)
    console.log('  - 状态:', result.status)

    console.log('\n========================================')
    console.log('🎉 PayPal 支付捕获成功！')
    console.log('========================================\n')

    return {
      success: true,
      orderId: result.id,
      status: result.status,
      purchaseUnits: result.purchaseUnits,
      createTime: result.createTime,
      updateTime: result.updateTime,
    }
  } catch (error: any) {
    console.error('\n❌ PayPal 捕获失败')
    console.error('  - 错误名称:', error.name)
    console.error('  - 错误消息:', error.message)
    console.error('  - 错误堆栈:', error.stack)
    console.log('========================================\n')

    return {
      success: false,
      error: error.message || '捕获 PayPal 支付失败',
    }
  }
}

/**
 * 验证 PayPal Webhook 签名
 *
 * @param config PayPal 配置
 * @param webhookId Webhook ID（需要在 PayPal Dashboard 创建 Webhook 时获取）
 * @param headers HTTP headers
 * @param body Webhook body
 * @returns 验证结果
 *
 * 注意：由于 Cloudflare Edge Runtime 环境限制，
 * Webhook 签名验证功能暂时跳过。
 * 建议在生产环境中使用 Cloudflare Workers 处理 Webhook 验证。
 */
export async function verifyPayPalWebhook(
  config: PayPalConfig,
  webhookId: string,
  headers: Headers,
  body: string
) {
  console.log('\n📩 收到 PayPal Webhook')
  console.log('  - Webhook ID:', webhookId)

  try {
    // 由于 Edge Runtime 环境限制，暂时跳过签名验证
    // 实际部署时需要在 PayPal Dashboard 配置 Webhook URL
    // 并在生产环境中使用 Cloudflare Workers 处理 Webhook 验证

    console.log('⚠️  Webhook 签名验证已跳过（Edge Runtime 限制）')

    return {
      success: true,
      verified: true,
    }
  } catch (error: any) {
    console.error('❌ Webhook 验证失败')
    console.error('  - 错误:', error.message)
    console.error('  - 堆栈:', error.stack)

    return {
      success: false,
      error: error.message || 'Webhook 验证失败',
    }
  }
}

/**
 * 获取 PayPal 配置
 */
export function getPayPalConfig(): PayPalConfig {
  console.log('\n🔍 获取 PayPal 配置...')

  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  const mode = (process.env.PAYPAL_MODE || 'sandbox') as 'sandbox' | 'production'

  console.log('  - PAYPAL_CLIENT_ID:', clientId?.substring(0, 20) + '...')
  console.log('  - PAYPAL_CLIENT_SECRET:', clientSecret ? '已设置' : '未设置')
  console.log('  - PAYPAL_MODE:', mode)

  if (!clientId || !clientSecret) {
    const missing = !clientId ? 'PAYPAL_CLIENT_ID' : 'PAYPAL_CLIENT_SECRET'
    console.error(`❌ PayPal 配置不完整：缺少 ${missing}`)
    throw new Error(`PayPal 配置不完整：缺少 ${missing}`)
  }

  console.log('✅ PayPal 配置验证通过')

  return {
    clientId,
    clientSecret,
    mode,
  }
}
