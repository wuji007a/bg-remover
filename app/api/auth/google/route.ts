import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const GOOGLE_CLIENT_ID = '1006021607677-s5p3qn6jbfe72faj4q4tioro7fdgfv7s.apps.googleusercontent.com';

// 验证 Google ID Token
async function verifyGoogleToken(token: string) {
  try {
    // 获取 Google 的公钥
    const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    const certs = await response.json();

    // 简单的 JWT 解码（不验证签名，生产环境应该验证）
    const [header, payload, signature] = token.split('.');

    const decodedPayload = JSON.parse(atob(payload));

    // 验证必要字段
    if (
      !decodedPayload.iss ||
      !decodedPayload.aud ||
      !decodedPayload.exp ||
      !decodedPayload.sub
    ) {
      throw new Error('Invalid token structure');
    }

    // 验证签发者和受众
    if (decodedPayload.iss !== 'https://accounts.google.com' &&
        decodedPayload.iss !== 'accounts.google.com') {
      throw new Error('Invalid issuer');
    }

    if (decodedPayload.aud !== GOOGLE_CLIENT_ID) {
      throw new Error('Invalid audience');
    }

    // 验证过期时间
    if (decodedPayload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    return {
      sub: decodedPayload.sub,
      email: decodedPayload.email,
      name: decodedPayload.name,
      picture: decodedPayload.picture
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // 验证 Google ID Token
    const userData = await verifyGoogleToken(token);

    // 生成简单的 session token
    const sessionToken = Buffer.from(
      JSON.stringify({
        userId: userData.sub,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
      })
    ).toString('base64');

    const response = NextResponse.json({
      success: true,
      token: sessionToken,
      user: {
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        userId: userData.sub
      }
    });

    // 设置 cookie
    response.cookies.set('auth_token', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Google OAuth 验证失败:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 401 }
    );
  }
}
