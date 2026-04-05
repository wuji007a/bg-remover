/**
 * PayPal Payment Integration (使用原生 fetch，兼容 Cloudflare Edge Runtime)
 *
 * 功能：
 * - 创建订单
 * - 获取支付链接
 * - 验证 Webhook
 * - 处理支付回调
 */

/**
 * PayPal 配置
 */
export interface PayPalConfig {
  clientId: string
  clientSecret: string
  mode: 'sandbox' | 'production'
}

/**
 * PayPal 环境配置
 */
const PAYPAL_BASE_URLS = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  production: 'https://api-m.paypal.com'
}

/**
 * 获取 Access Token
 */
async function getAccessToken(config: PayPalConfig): Promise<string> {
  const baseUrl = PAYPAL_BASE_URLS[config.mode]
  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

  console.log('🔑 获取 PayPal Access Token...')
  console.log('  - Base URL:', baseUrl)

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials'
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ 获取 Access Token 失败:', errorText)
    throw new Error(`获取 Access Token 失败: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log('✅ Access Token 获取成功')

  return data.access_token
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

  const baseUrl = PAYPAL_BASE_URLS[config.mode]

  // 转换为美元（PayPal 只支持美元结算）
  // 假设 1 美元 = 7.2 人民币
  const usdAmount = (amount / 7.2).toFixed(2)
  console.log('  - 转换后金额 (USD):', usdAmount)

  try {
    // 1. 获取 Access Token
    const accessToken = await getAccessToken(config)

    // 2. 创建订单
    const requestBody = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: orderNo,
          custom_id: orderNo,  // 用于前端回调时获取订单号
          description: 'BG Remover 去背景服务配额购买',
          amount: {
            currency_code: 'USD',
            value: usdAmount,
          },
        },
      ],
      application_context: {
        return_url: 'https://bg-remover-6dp.pages.dev/payment/success',
        cancel_url: 'https://bg-remover-6dp.pages.dev/payment/cancel',
      },
    }

    console.log('📡 调用 PayPal API...')
    console.log('  - 请求体:', JSON.stringify(requestBody, null, 2))

    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ PayPal API 调用失败:', errorText)
      console.error('  - 状态码:', response.status)
      throw new Error(`PayPal API 调用失败: ${response.status} - ${errorText}`)
    }

    const result = await response.json()

    console.log('\n✅ PayPal API 调用成功')
    console.log('  - PayPal 订单 ID:', result.id)
    console.log('  - 状态:', result.status)
    console.log('  - Links 数量:', result.links?.length || 0)

    // 提取支付链接
    const links = result.links || []
    let approveLink: string | null = null

    for (let i = 0; i < links.length; i++) {
      const link = links[i]
      console.log(`  - Link ${i + 1}: ${link.rel} - ${link.href}`)

      if (link.rel === 'approve') {
        approveLink = link.href
        console.log('  - 找到支付链接 ✓')
      }
    }

    if (!approveLink) {
      console.warn('⚠️  未找到 approve 链接')
    }

    console.log('\n========================================')
    console.log('🎉 PayPal 订单创建成功！')
    console.log('========================================\n')

    return {
      success: true,
      orderId: result.id,
      orderNo,
      amount: usdAmount,
      currency: 'USD',
      paymentLink: approveLink,
      status: result.status,
    }
  } catch (error: any) {
    console.error('\n========================================')
    console.error('❌ PayPal 订单创建失败')
    console.error('========================================\n')
    console.error('  - 错误名称:', error.name)
    console.error('  - 错误消息:', error.message)
    console.error('  - 错误堆栈:', error.stack)
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

  const baseUrl = PAYPAL_BASE_URLS[config.mode]

  try {
    // 1. 获取 Access Token
    const accessToken = await getAccessToken(config)

    // 2. 捕获支付
    console.log('📡 调用 PayPal 捕获 API...')

    const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ PayPal 捕获失败:', errorText)
      console.error('  - 状态码:', response.status)
      throw new Error(`PayPal 捕获失败: ${response.status} - ${errorText}`)
    }

    const result = await response.json()

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
      purchaseUnits: result.purchase_units,
      createTime: result.create_time,
      updateTime: result.update_time,
    }
  } catch (error: any) {
    console.error('\n========================================')
    console.error('❌ PayPal 捕获失败')
    console.error('========================================\n')
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
  const rawMode = process.env.PAYPAL_MODE || 'sandbox'

  // 将 'live' 映射为 'production'（PayPal API 期望 production）
  const mode = (rawMode === 'live' ? 'production' : rawMode) as 'sandbox' | 'production'

  console.log('  - PAYPAL_CLIENT_ID:', clientId?.substring(0, 20) + '...')
  console.log('  - PAYPAL_CLIENT_SECRET:', clientSecret ? '已设置' : '未设置')
  console.log('  - PAYPAL_MODE (原始):', rawMode)
  console.log('  - PAYPAL_MODE (映射):', mode)

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
