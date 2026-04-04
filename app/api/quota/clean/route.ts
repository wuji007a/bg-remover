import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * 清理配额记录（临时工具）
 *
 * 功能：
 * - 删除多余的购买配额记录
 * - 只保留最新的 1 条购买配额记录
 * - 保留所有免费配额记录
 */
export async function POST(request: NextRequest) {
  try {
    // 获取用户 token
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Please login first',
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
        error: 'D1 database not configured'
      }, { status: 500 })
    }

    // 查询数据库 ID
    const user = await DB.prepare(`
      SELECT id FROM users WHERE google_id = ?
    `).bind(googleId).first() as { id: number } | null

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        needLogin: true
      }, { status: 404 })
    }

    const userId = user.id

    console.log('🔍 开始清理配额:', userId)

    // 查看当前配额记录
    const currentQuota = await DB.prepare(`
      SELECT id, quota_type, total, used, created_at
      FROM user_quota
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(userId).all()

    console.log('📊 当前配额记录:', currentQuota.results?.length || 0)
    console.log(JSON.stringify(currentQuota.results, null, 2))

    // 删除多余的购买配额（保留最新的 1 条）
    const deleteResult = await DB.prepare(`
      DELETE FROM user_quota
      WHERE user_id = ?
        AND quota_type = 2
        AND id NOT IN (
          SELECT id FROM user_quota
          WHERE user_id = ? AND quota_type = 2
          ORDER BY created_at DESC
          LIMIT 1
        )
    `).bind(userId, userId).run()

    console.log('🗑️ 删除了', deleteResult.meta?.changes || 0, '条多余的购买配额')

    // 查询清理后的配额
    const finalQuota = await DB.prepare(`
      SELECT
        (SELECT COALESCE(SUM(total - used), 0) FROM user_quota WHERE user_id = ? AND quota_type = 2) as prepaid,
        (SELECT COALESCE(total - used, 0) FROM user_quota WHERE user_id = ? AND quota_type = 1 ORDER BY created_at DESC LIMIT 1) as free
    `).bind(userId, userId).first() as { prepaid: number, free: number } | null

    const prepaid = finalQuota?.prepaid || 0
    const free = finalQuota?.free || 0
    const total = prepaid + free

    console.log('✅ 清理完成:', { prepaid, free, total })

    return NextResponse.json({
      success: true,
      data: {
        prepaid,
        free,
        total,
        deletedRecords: deleteResult.meta?.changes || 0
      },
      message: 'Quota cleaned successfully'
    })

  } catch (error: any) {
    console.error('❌ 清理配额失败:', error)

    return NextResponse.json({
      success: false,
      error: error.message || 'Server error'
    }, { status: 500 })
  }
}
