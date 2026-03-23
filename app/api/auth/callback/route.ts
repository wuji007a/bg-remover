import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://bg-remover-6dp.pages.dev/api/auth/callback';

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
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return await response.json();
}

// 解码 JWT payload
function decodeJWTPayload(token: string) {
  const [, payload] = token.split('.');
  return JSON.parse(atob(payload));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // 处理错误
  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/?error=missing_code', req.url)
    );
  }

  try {
    // 用 code 换取 tokens
    const tokens = await exchangeCodeForTokens(code);
    const idToken = tokens.id_token;

    // 解码 ID Token 获取用户信息
    const payload = decodeJWTPayload(idToken);

    // 验证必要字段
    if (
      !payload.iss ||
      !payload.aud ||
      !payload.exp ||
      !payload.sub
    ) {
      throw new Error('Invalid token structure');
    }

    // 验证签发者和受众
    if (
      payload.iss !== 'https://accounts.google.com' &&
      payload.iss !== 'accounts.google.com'
    ) {
      throw new Error('Invalid issuer');
    }

    if (payload.aud !== GOOGLE_CLIENT_ID) {
      throw new Error('Invalid audience');
    }

    // 验证过期时间
    if (payload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    // 生成 session token
    const sessionToken = Buffer.from(
      JSON.stringify({
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      })
    ).toString('base64');

    // 重定向到首页，带上 session token
    const response = NextResponse.redirect(new URL('/', req.url));
    response.cookies.set('auth_token', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent('authentication_failed')}`, req.url)
    );
  }
}
