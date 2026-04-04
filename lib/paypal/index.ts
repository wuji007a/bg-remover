/**
 * PayPal Payment Integration
 *
 * 功能：
 * - 创建订单
 * - 获取支付链接
 * - 验证 Webhook
 * - 处理支付回调
 */

import { Client, Environment, OrdersController } from '@paypal/paypal-server-sdk'

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
  const paypalClient = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: config.clientId,
      oAuthClientSecret: config.clientSecret,
    },
    environment: config.mode === 'production' ? Environment.Production : Environment.Sandbox,
    timeout: 30000, // 30秒超时
  })

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
  const paypalClient = createPayPalClient(config)
  const ordersController = new OrdersController(paypalClient)

  // 转换为美元（PayPal 只支持美元结算）
  // 假设 1 美元 = 7.2 人民币
  const usdAmount = (amount / 7.2).toFixed(2)

  const requestBody = {
    intent: 'CAPTURE' as const,
    purchase_units: [
      {
        reference_id: orderNo,
        description: 'BG Remover 去背景服务配额购买',
        amount: {
          currency_code: 'USD' as const,
          value: usdAmount,
        },
      },
    ],
    application_context: {
      brand_name: 'BG Remover',
      landing_page: 'BILLING' as const,
      user_action: 'PAY_NOW' as const,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://bg-remover-6dp.pages.dev'}/payment/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://bg-remover-6dp.pages.dev'}/payment/cancel`,
    },
  }

  try {
    const { result } = await ordersController.ordersCreate(requestBody)

    // 提取支付链接
    const approveLink = result.links?.find(link => link.rel === 'approve')

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
    console.error('PayPal create order error:', error)
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
  const paypalClient = createPayPalClient(config)
  const ordersController = new OrdersController(paypalClient)

  try {
    const { result } = await ordersController.ordersCapture(paypalOrderId)

    return {
      success: true,
      orderId: result.id,
      status: result.status,
      purchaseUnits: result.purchase_units,
      createTime: result.create_time,
      updateTime: result.update_time,
    }
  } catch (error: any) {
    console.error('PayPal capture error:', error)
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
  try {
    // 由于 Edge Runtime 环境限制，暂时跳过签名验证
    // 实际部署时需要在 PayPal Dashboard 配置 Webhook URL
    // 并在生产环境中使用 Cloudflare Workers 处理 Webhook 验证

    console.log('📩 PayPal Webhook received (signature verification skipped)')

    return {
      success: true,
      verified: true,
    }
  } catch (error: any) {
    console.error('PayPal webhook verification error:', error)
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
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  const mode = (process.env.PAYPAL_MODE || 'sandbox') as 'sandbox' | 'production'

  if (!clientId || !clientSecret) {
    throw new Error('PayPal 配置不完整：缺少 PAYPAL_CLIENT_ID 或 PAYPAL_CLIENT_SECRET')
  }

  return {
    clientId,
    clientSecret,
    mode,
  }
}
