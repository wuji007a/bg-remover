import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * Image Background Removal API
 *
 * Features:
 * 1. Check user login status
 * 2. Check user-level rate limiting (max 5 requests per minute)
 * 3. Check IP-level rate limiting (max 10 requests per minute)
 * 4. Check user quota
 * 5. Call background removal API (FIRST)
 * 6. Deduct quota AFTER successful API call
 * 7. Log usage
 * 8. Update rate limiting counters
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image') as File

    if (!image) {
      return NextResponse.json({ error: 'Please upload an image' }, { status: 400 })
    }

    // Get user token
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json({
        error: 'Please login first',
        needLogin: true
      }, { status: 401 })
    }

    // Decode token to get user ID (Google ID)
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
    const googleId = decoded.userId

    // Get IP address
    const ip = request.headers.get('cf-connecting-ip') || 'unknown'

    // Get D1 database instance
    const DB = (process.env as any).DB

    let dbUserId: number | null = null

    if (!DB) {
      console.warn('⏳ D1 database not configured, skipping quota check')
    } else {
      try {
        // Query database ID from Google ID
        const user = await DB.prepare(`
          SELECT id FROM users WHERE google_id = ?
        `).bind(googleId).first() as { id: number } | null

        if (!user) {
          return NextResponse.json({
            error: 'User not found, please login again',
            needLogin: true
          }, { status: 404 })
        }

        dbUserId = user.id

        // ============================================
        // 1. Check user-level rate limiting (max 5 requests per minute)
        // ============================================
        const userRateLimitCheck = await DB.prepare(`
          SELECT request_count, window_start
          FROM rate_limits
          WHERE user_id = ? AND window_start > datetime('now', '-1 minute')
          ORDER BY window_start DESC
          LIMIT 1
        `).bind(dbUserId).first() as { request_count: number } | null

        const userLimit = parseInt(process.env.RATE_LIMIT_USER_PER_MINUTE || '5')

        if (userRateLimitCheck && userRateLimitCheck.request_count >= userLimit) {
          return NextResponse.json({
            error: 'Too many requests, please try again later',
            rateLimited: true,
            type: 'user'
          }, { status: 429 })
        }

        // ============================================
        // 2. Check IP-level rate limiting (max 10 requests per minute)
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
            error: 'Too many requests, please try again later',
            rateLimited: true,
            type: 'ip'
          }, { status: 429 })
        }

        // ============================================
        // 3. Check user quota
        // ============================================
        const quotaCheck = await DB.prepare(`
          SELECT
            (SELECT COALESCE(SUM(total - used), 0) FROM user_quota WHERE user_id = ? AND quota_type = 2) as prepaid,
            (SELECT COALESCE(total - used, 0) FROM user_quota WHERE user_id = ? AND quota_type = 1 ORDER BY created_at DESC LIMIT 1) as free
        `).bind(dbUserId, dbUserId).first() as { prepaid: number, free: number } | null

        const prepaid = quotaCheck?.prepaid || 0
        const free = quotaCheck?.free || 0
        const total = prepaid + free

        if (total <= 0) {
          return NextResponse.json({
            error: 'Insufficient quota, please purchase a package',
            needPay: true,
            quota: { prepaid, free, total }
          }, { status: 402 })
        }

        console.log(`✅ Quota check passed: prepaid=${prepaid}, free=${free}, total=${total}`)
      } catch (dbError: any) {
        console.error('Database operation failed:', dbError)
        // Continue execution, do not interrupt user request
      }
    }

    // ============================================
    // 4. Call background removal API (FIRST)
    // ============================================
    console.log('\n🎨 Calling background removal API...')

    const { createImageRemoverService } = await import('@/lib/bg-remover')
    const service = createImageRemoverService()

    let result: any
    try {
      result = await service.removeBackground(image)
      console.log('✅ Background removal API call succeeded')
    } catch (apiError: any) {
      console.error('❌ Background removal API call failed:', apiError.message)
      
      // Return error immediately (quota NOT deducted yet)
      return NextResponse.json({
        success: false,
        error: apiError.message || 'Background removal API error'
      }, { status: 500 })
    }

    // ============================================
    // 5. Deduct quota (AFTER successful API call)
    // ============================================
    let quotaId: number | null = null

    console.log(`\n📊 开始配额扣减流程...`)
    console.log(`  - DB 是否可用: ${!!DB}`)
    console.log(`  - dbUserId: ${dbUserId}`)

    if (DB && dbUserId) {
      try {
        // 先查询当前配额
        const quotaCheck = await DB.prepare(`
          SELECT
            (SELECT COALESCE(SUM(total - used), 0) FROM user_quota WHERE user_id = ? AND quota_type = 2) as prepaid,
            (SELECT COALESCE(total - used, 0) FROM user_quota WHERE user_id = ? AND quota_type = 1 ORDER BY created_at DESC LIMIT 1) as free
        `).bind(dbUserId, dbUserId).first() as { prepaid: number, free: number } | null

        const prepaid = quotaCheck?.prepaid || 0
        const free = quotaCheck?.free || 0

        console.log(`  - 扣减前配额: prepaid=${prepaid}, free=${free}, total=${prepaid + free}`)

        if (prepaid > 0) {
          // 扣除购买配额
          console.log(`  - 扣除购买配额...`)

          // 先查询要扣除的配额 ID
          const quotaToDeduct = await DB.prepare(`
            SELECT id FROM user_quota
            WHERE user_id = ? AND quota_type = 2 AND total > used
            ORDER BY created_at ASC
            LIMIT 1
          `).bind(dbUserId).first() as { id: number } | null

          if (quotaToDeduct) {
            console.log(`  - 找到配额记录: id=${quotaToDeduct.id}`)

            // 执行扣减
            const result = await DB.prepare(`
              UPDATE user_quota
              SET used = used + 1
              WHERE id = ?
            `).bind(quotaToDeduct.id).run()

            console.log(`  - 扣减结果: success=${result.success}, meta=${JSON.stringify(result.meta)}`)

            quotaId = quotaToDeduct.id
            console.log(`✅ 已扣除购买配额: ${quotaId}`)
          } else {
            console.error(`❌ 未找到可用的购买配额记录`)
          }
        } else if (free > 0) {
          // 扣除免费配额
          console.log(`  - 扣除免费配额...`)

          // 先查询要扣除的配额 ID
          const quotaToDeduct = await DB.prepare(`
            SELECT id FROM user_quota
            WHERE user_id = ? AND quota_type = 1 AND total > used
            ORDER BY created_at DESC
            LIMIT 1
          `).bind(dbUserId).first() as { id: number } | null

          if (quotaToDeduct) {
            console.log(`  - 找到配额记录: id=${quotaToDeduct.id}`)

            // 执行扣减
            const result = await DB.prepare(`
              UPDATE user_quota
              SET used = used + 1
              WHERE id = ?
            `).bind(quotaToDeduct.id).run()

            console.log(`  - 扣减结果: success=${result.success}, meta=${JSON.stringify(result.meta)}`)

            quotaId = quotaToDeduct.id
            console.log(`✅ 已扣除免费配额: ${quotaId}`)
          } else {
            console.error(`❌ 未找到可用的免费配额记录`)
          }
        } else {
          console.error(`❌ 无可用配额可扣除`)
        }

        // 扣减后再次查询配额
        const quotaAfter = await DB.prepare(`
          SELECT
            (SELECT COALESCE(SUM(total - used), 0) FROM user_quota WHERE user_id = ? AND quota_type = 2) as prepaid,
            (SELECT COALESCE(total - used, 0) FROM user_quota WHERE user_id = ? AND quota_type = 1 ORDER BY created_at DESC LIMIT 1) as free
        `).bind(dbUserId, dbUserId).first() as { prepaid: number, free: number } | null

        const prepaidAfter = quotaAfter?.prepaid || 0
        const freeAfter = quotaAfter?.free || 0
        console.log(`  - 扣减后配额: prepaid=${prepaidAfter}, free=${freeAfter}, total=${prepaidAfter + freeAfter}`)
        console.log(`  - 扣减数量: ${(prepaid + free) - (prepaidAfter + freeAfter)}`)

      } catch (quotaError: any) {
        console.error('❌ 配额扣减失败:', quotaError)
        console.error('  - 错误名称:', quotaError.name)
        console.error('  - 错误消息:', quotaError.message)
        console.error('  - 错误堆栈:', quotaError.stack)
        // Continue execution, return result even if quota deduction fails
      }
    } else {
      console.error(`❌ 配额扣减跳过: DB 或 dbUserId 为空`)
    }

    // ============================================
    // 6. Log usage
    // ============================================
    if (DB && dbUserId) {
      try {
        const providerInfo = service.getProviderInfo()

        await DB.prepare(`
          INSERT INTO usage_logs (user_id, quota_id, api_provider, cost)
          VALUES (?, ?, ?, ?)
        `).bind(
          dbUserId,
          quotaId,
          providerInfo.name,
          providerInfo.cost
        ).run()

        console.log(`✅ Usage logged: user ${dbUserId}, provider ${providerInfo.name}`)
      } catch (logError: any) {
        console.error('Failed to log usage:', logError)
        // Continue execution, do not affect user
      }
    }

    // ============================================
    // 7. Update rate limiting counters
    // ============================================
    if (DB && dbUserId) {
      try {
        const now = new Date()
        const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0)

        // Update user rate limit
        await DB.prepare(`
          INSERT INTO rate_limits (user_id, ip_address, request_count, window_start)
          VALUES (?, ?, 1, ?)
          ON CONFLICT(user_id, ip_address, window_start) DO UPDATE SET
            request_count = request_count + 1
        `).bind(dbUserId, ip, windowStart.toISOString()).run()

        console.log(`✅ Rate limit updated: user ${dbUserId}`)
      } catch (rateError: any) {
        console.error('Failed to update rate limit:', rateError)
        // Continue execution, do not affect user
      }
    }

    // ============================================
    // 8. Return result (directly as binary stream)
    // ============================================
    // Get provider info
    const providerInfo = service.getProviderInfo()

    console.log('✅ Request completed successfully')

    // Return the image buffer directly (not JSON)
    // Frontend will handle: const blob = await res.blob()
    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'X-Provider': providerInfo.name,
      },
    })

  } catch (error: any) {
    console.error('\n========================================')
    console.error('❌ Background removal failed')
    console.error('========================================\n')
    console.error('  - Error name:', error.name)
    console.error('  - Error message:', error.message)
    console.error('  - Error stack:', error.stack)
    console.error('========================================\n')

    return NextResponse.json({
      success: false,
      error: error.message || 'Server error'
    }, { status: 500 })
  }
}
