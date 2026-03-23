import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value ||
                req.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

    // 检查是否过期
    if (decoded.exp && decoded.exp < Date.now()) {
      return NextResponse.json(
        { success: false, error: 'Token expired' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        userId: decoded.userId
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid token' },
      { status: 401 }
    );
  }
}
