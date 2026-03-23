import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image') as File

    if (!image) {
      return NextResponse.json({ error: '请上传图片' }, { status: 400 })
    }

    const apiKey = process.env.REMOVE_BG_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key 未配置' }, { status: 500 })
    }

    // 转发到 remove.bg API
    const removeBgFormData = new FormData()
    removeBgFormData.append('image_file', image)
    removeBgFormData.append('size', 'auto')

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: removeBgFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('remove.bg API error:', errorText)
      
      if (response.status === 402) {
        return NextResponse.json({ error: 'API 配额已用完' }, { status: 402 })
      }
      if (response.status === 403) {
        return NextResponse.json({ error: 'API Key 无效' }, { status: 403 })
      }
      
      return NextResponse.json({ error: '图片处理失败' }, { status: 500 })
    }

    // 返回处理后的图片
    const resultBuffer = await response.arrayBuffer()
    
    return new NextResponse(resultBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
