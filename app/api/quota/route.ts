import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * 查询用户配额
 *
 * 返回用户的配额信息：
 * - prepaid: 购买额度
 * - free: 免费额度
 * - total: 总额度
 */
export async function GET(request: NextRequest) {
  try {
    // 获取用户 token
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        needLogin: true
      }, { status: 401 })
    }

    // 解码 token 获取用户 ID（这是 Google ID）
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
    const googleId = decoded.userId

    // 获取 D1 数据库实例
    const DB = (process.env as any).DB

    if (!DB) {
      return NextResponse.json({
        success: false,
        error: 'D1 数据库未配置'
      }, { status: 500 })
    }

    // 通过 Google ID 查询数据库 ID
    const user = await DB.prepare(`
      SELECT id FROM users WHERE google_id = ?
    `).bind(googleId).first() as { id: number } | null

    if (!user) {
      return NextResponse.json({
        success: false,
        error: '用户不存在，请重新登录',
        needLogin: true
      }, { status: 404 })
    }

    const userId = user.id  // 数据库 ID（整数）

    // 查询配额
    const quota = await DB.prepare(`
      SELECT
        (SELECT COALESCE(SUM(total - used), 0) FROM user_quota WHERE user_id = ? AND quota_type = 2) as prepaid,
        (SELECT COALESCE(total - used, 0) FROM user_quota WHERE user_id = ? AND quota_type = 1 ORDER BY created_at DESC LIMIT 1) as free
    `).bind(userId, userId).first() as { prepaid: number, free: number } | null

    const prepaid = quota?.prepaid || 0
    const free = quota?.free || 0
    const total = prepaid + free

    // 查询配额详情（用于前端展示）
    const quotaDetails = await DB.prepare(`
      SELECT
        id,
        quota_type,
        total,
        used,
        total - used as remaining,
        created_at,
        expire_at
      FROM user_quota
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(userId).all()

    return NextResponse.json({
      success: true,
      data: {
        prepaid,
        free,
        total,
        details: quotaDetails.results
      }
    })

  } catch (error: any) {
    console.error('Error:', error)

    return NextResponse.json({
      success: false,
      error: error.message || '服务器错误'
    }, { status: 500 })
  }
}
