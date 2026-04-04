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
 * 4. Check and deduct user quota
 * 5. Call background removal API
 * 6. Log usage
 * 7. Update rate limiting counters
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

        // ============================================
        // 4. Deduct quota (deduct purchased quota first)
        // ============================================
        let quotaId: number | null = null

        if (prepaid > 0) {
          // Deduct purchased quota
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
          `).bind(dbUserId).first() as { id: number } | null

          quotaId = quotaUpdate!.id
          console.log(`✅ Deducted purchased quota: ${quotaId}`)
        } else if (free > 0) {
          // Deduct free quota
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
          `).bind(dbUserId).first() as { id: number } | null

          quotaId = quotaUpdate!.id
          console.log(`✅ Deducted free quota: ${quotaId}`)
        }

      } catch (dbError: any) {
        console.error('Database operation failed:', dbError)
        // Continue execution, do not interrupt user request
      }
    }

    // ============================================
    // 5. Call background removal API
    // ============================================
    const { createImageRemoverService } = await import('@/lib/bg-remover')
    const service = createImageRemoverService()

    const result = await service.removeBackground(image)

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
          null, // quotaId
          providerInfo.name,
          providerInfo.costPerCall
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

    // Return result
    return NextResponse.json({
      success: true,
      data: {
        imageUrl: result.imageUrl,
        provider: result.provider,
      },
      message: 'Background removed successfully'
    })

  } catch (error: any) {
    console.error('Background removal failed:', error)

    return NextResponse.json({
      success: false,
      error: error.message || 'Server error'
    }, { status: 500 })
  }
}
