import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * 图片背景移除接口
 *
 * 功能：
 * 1. 检查用户登录状态
 * 2. 检查用户级别限流（1分钟最多5次请求）
 * 3. 检查IP级别限流（1分钟最多10次请求）
 * 4. 检查并扣减用户配额
 * 5. 调用背景移除 API
 * 6. 记录使用日志
 * 7. 更新限流计数
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image') as File

    if (!image) {
      return NextResponse.json({ error: '请上传图片' }, { status: 400 })
    }

    // 获取用户 token
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json({ 
        error: '请先登录',
        needLogin: true
      }, { status: 401 })
    }

    // 解码 token 获取用户 ID
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
    const userId = decoded.userId

    // 获取 IP 地址
    const ip = request.headers.get('cf-connecting-ip') || 'unknown'

    // 获取 D1 数据库实例
    const DB = (process.env as any).DB

    if (!DB) {
      console.warn('⏳ D1 数据库未配置，跳过配额检查')
    } else {
      try {
        // ============================================
        // 1. 检查用户级别限流（1分钟最多5次请求）
        // ============================================
        const userRateLimitCheck = await DB.prepare(`
          SELECT request_count, window_start
          FROM rate_limits
          WHERE user_id = ? AND window_start > datetime('now', '-1 minute')
          ORDER BY window_start DESC
          LIMIT 1
        `).bind(userId).first() as { request_count: number } | null

        const userLimit = parseInt(process.env.RATE_LIMIT_USER_PER_MINUTE || '5')

        if (userRateLimitCheck && userRateLimitCheck.request_count >= userLimit) {
          return NextResponse.json({ 
            error: '请求过于频繁，请稍后再试',
            rateLimited: true,
            type: 'user'
          }, { status: 429 })
        }

        // ============================================
        // 2. 检查 IP 级别限流（1分钟最多10次请求）
        // ============================================
        const ipRateLimitCheck = await DB.prepare(`
          SELECT request_count, window_start
          FROM rate_limits
          WHERE ip_address = ? AND window_start > datetime('now', '-1 minute')
          ORDER BY window_start DESC
          LIMIT 1
        `).bind(ip).first() as { request_count: number } | null

        const ipLimit = parseInt(process.env.RATE_LIMIT_IP_PER_MINUTE || '10')

        if (ipRateLimitCheck && ipRateLimitCheck.request_count >= ipLimit) {
          return NextResponse.json({ 
            error: '请求过于频繁，请稍后再试',
            rateLimited: true,
            type: 'ip'
          }, { status: 429 })
        }

        // ============================================
        // 3. 检查用户配额
        // ============================================
        const quotaCheck = await DB.prepare(`
          SELECT
            (SELECT COALESCE(SUM(total - used), 0) FROM user_quota WHERE user_id = ? AND quota_type = 2) as prepaid,
            (SELECT COALESCE(total - used, 0) FROM user_quota WHERE user_id = ? AND quota_type = 1 ORDER BY created_at DESC LIMIT 1) as free
        `).bind(userId, userId).first() as { prepaid: number, free: number } | null

        const prepaid = quotaCheck?.prepaid || 0
        const free = quotaCheck?.free || 0
        const total = prepaid + free

        if (total <= 0) {
          return NextResponse.json({ 
            error: '配额不足，请购买套餐',
            needPay: true,
            quota: { prepaid, free, total }
          }, { status: 402 })
        }

        // ============================================
        // 4. 扣减配额（优先扣除购买额度）
        // ============================================
        let quotaId: number | null = null

        if (prepaid > 0) {
          // 扣除购买额度
          const quotaUpdate = await DB.prepare(`
            UPDATE user_quota
            SET used = used + 1
            WHERE id = (
              SELECT id FROM user_quota
              WHERE user_id = ? AND quota_type = 2 AND total > used
              ORDER BY created_at ASC
              LIMIT 1
            )
            RETURNING id
          `).bind(userId).first() as { id: number } | null

          quotaId = quotaUpdate!.id
          console.log(`✅ 扣除购买额度：${quotaId}`)
        } else if (free > 0) {
          // 扣除免费额度
          const quotaUpdate = await DB.prepare(`
            UPDATE user_quota
            SET used = used + 1
            WHERE id = (
              SELECT id FROM user_quota
              WHERE user_id = ? AND quota_type = 1 AND total > used
              ORDER BY created_at DESC
              LIMIT 1
            )
            RETURNING id
          `).bind(userId).first() as { id: number } | null

          quotaId = quotaUpdate!.id
          console.log(`✅ 扣除免费额度：${quotaId}`)
        }

      } catch (dbError: any) {
        console.error('数据库操作失败:', dbError)
        // 继续执行，不中断用户请求
      }
    }

    // ============================================
    // 5. 调用背景移除 API
    // ============================================
    const { createImageRemoverService } = await import('@/lib/bg-remover')
    const service = createImageRemoverService()

    const result = await service.removeBackground(image)

    // ============================================
    // 6. 记录使用日志
    // ============================================
    if (DB) {
      try {
        const providerInfo = service.getProviderInfo()

        await DB.prepare(`
          INSERT INTO usage_logs (user_id, quota_id, api_provider, cost)
          VALUES (?, ?, ?, ?)
        `).bind(
          userId,
          null, // quotaId 可能为 null
          providerInfo.type,
          0.05  // remove.bg 成本
        ).run()

        console.log(`✅ 记录使用日志：${userId} (${providerInfo.name})`)
      } catch (dbError: any) {
        console.error('记录使用日志失败:', dbError)
      }
    }

    // ============================================
    // 7. 更新限流计数
    // ============================================
    if (DB) {
      try {
        const now = new Date().toISOString()
        const windowStart = new Date(Date.now() - 60000).toISOString()

        // 更新用户限流
        await DB.prepare(`
          INSERT INTO rate_limits (user_id, ip_address, request_count, window_start)
          VALUES (?, ?, 1, ?)
          ON CONFLICT(user_id, window_start) DO UPDATE SET
            request_count = request_count + 1
        `).bind(userId, ip, now).run()

        // 更新 IP 限流
        await DB.prepare(`
          INSERT INTO rate_limits (user_id, ip_address, request_count, window_start)
          VALUES (?, ?, 1, ?)
          ON CONFLICT(ip_address, window_start) DO UPDATE SET
            request_count = request_count + 1
        `).bind(userId, ip, now).run()

        // 清理过期的限流记录
        await DB.prepare(`
          DELETE FROM rate_limits WHERE window_start < ?
        `).bind(windowStart).run()
      } catch (dbError: any) {
        console.error('更新限流计数失败:', dbError)
      }
    }

    // 返回处理后的图片
    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'X-Provider': service.getProviderInfo().name,
      },
    })
  } catch (error: any) {
    console.error('Error:', error)

    // 根据错误类型返回不同的状态码
    if (error.message.includes('API 配额已用完')) {
      return NextResponse.json({ error: error.message }, { status: 402 })
    }
    if (error.message.includes('API Key 无效')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error.message.includes('API 请求频率超限')) {
      return NextResponse.json({ error: error.message }, { status: 429 })
    }

    return NextResponse.json({
      error: error.message || '服务器错误'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // 查询用户配额
  const token = request.cookies.get('auth_token')?.value
  if (!token) {
    return NextResponse.json({ 
      success: false,
      data: { prepaid: 0, free: 0, total: 0 }
    }, { status: 401 })
  }

  const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
  const userId = decoded.userId

  const DB = (process.env as any).DB

  if (!DB) {
    return NextResponse.json({
      success: true,
      data: { prepaid: 0, free: 0, total: 0 },
      message: 'D1 数据库未配置'
    })
  }

  try {
    const quota = await DB.prepare(`
      SELECT
        (SELECT COALESCE(SUM(total - used), 0) FROM user_quota WHERE user_id = ? AND quota_type = 2) as prepaid,
        (SELECT COALESCE(total - used, 0) FROM user_quota WHERE user_id = ? AND quota_type = 1 ORDER BY created_at DESC LIMIT 1) as free
    `).bind(userId, userId).first() as { prepaid: number, free: number } | null

    const prepaid = quota?.prepaid || 0
    const free = quota?.free || 0
    const total = prepaid + free

    return NextResponse.json({
      success: true,
      data: { prepaid, free, total }
    })
  } catch (error: any) {
    console.error('查询配额失败:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
