import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://bg-remover-6dp.pages.dev/api/auth/callback'

// 交换 code 换取 tokens
async function exchangeCodeForTokens(code: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return await response.json()
}

// 解码 JWT payload
function decodeJWTPayload(token: string) {
  const [, payload] = token.split('.')
  return JSON.parse(atob(payload))
}

/**
 * Google OAuth 回调
 *
 * 功能：
 * 1. 验证 Google OAuth 回调
 * 2. 创建或更新用户记录
 * 3. 发放 3 次免费配额（仅新用户）
 * 4. 设置 session token
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // 处理错误
  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/?error=missing_code', req.url)
    )
  }

  try {
    // 用 code 换取 tokens
    const tokens = await exchangeCodeForTokens(code)
    const idToken = tokens.id_token

    // 解码 ID Token 获取用户信息
    const payload = decodeJWTPayload(idToken)

    // 验证必要字段
    if (
      !payload.iss ||
      !payload.aud ||
      !payload.exp ||
      !payload.sub
    ) {
      throw new Error('Invalid token structure')
    }

    // 验证签发者和受众
    if (
      payload.iss !== 'https://accounts.google.com' &&
      payload.iss !== 'accounts.google.com'
    ) {
      throw new Error('Invalid issuer')
    }

    if (payload.aud !== GOOGLE_CLIENT_ID) {
      throw new Error('Invalid audience')
    }

    // 验证过期时间
    if (payload.exp < Date.now() / 1000) {
      throw new Error('Token expired')
    }

    // 获取 D1 数据库实例
    const DB = (process.env as any).DB

    if (!DB) {
      console.warn('⏳ D1 数据库未配置，跳过用户创建和配额发放')
    } else {
      try {
        // 创建或更新用户
        const user = await DB.prepare(`
          INSERT INTO users (google_id, email, name, avatar_url)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(google_id) DO UPDATE SET
            email = excluded.email,
            name = excluded.name,
            avatar_url = excluded.avatar_url,
            updated_at = datetime('now')
          RETURNING id
        `).bind(
          payload.sub,
          payload.email,
          payload.name,
          payload.picture
        ).first() as { id: number } | null

        const userId = user!.id

        console.log('✅ 用户数据库 ID:', userId)
        console.log('✅ Google ID:', payload.sub)

        // 检查是否是新用户（是否有免费配额）
        const hasFreeQuota = await DB.prepare(`
          SELECT COUNT(*) as count
          FROM user_quota
          WHERE user_id = ? AND quota_type = 1
        `).bind(userId).first() as { count: number } | null

        // 如果是新用户，发放 3 次免费配额
        if (hasFreeQuota!.count === 0) {
          console.log(`✨ 新用户 ${userId}，发放 3 次免费配额`)

          await DB.prepare(`
            INSERT INTO user_quota (user_id, quota_type, total)
            VALUES (?, 1, 3)
          `).bind(userId).run()
        }

        console.log(`✅ 用户登录成功：${userId} (${payload.email})`)
      } catch (dbError: any) {
        console.error('数据库操作失败:', dbError)
        // 继续执行，不影响用户登录
        userId = null
      }
    }

    // 生成 session token（存储数据库 ID，而不是 Google ID）
    const sessionToken = Buffer.from(
      JSON.stringify({
        userId: userId,  // 使用数据库 ID
        googleId: payload.sub,  // Google ID（保留用于其他用途）
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      })
    ).toString('base64')

    // 重定向到首页，带上 session token
    const response = NextResponse.redirect(new URL('/', req.url))
    response.cookies.set('auth_token', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent('authentication_failed')}`, req.url)
    )
  }
}
