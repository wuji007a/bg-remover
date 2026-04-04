import { ImageRemoverProvider, ImageRemoverConfig, RemoveResult } from '../types'

export class ClipDropProvider implements ImageRemoverProvider {
  name = 'clipdrop'
  private readonly baseUrl = 'https://clipdrop-api.co/remove-background/v1'
  private readonly cost = 0.02 // 成本：¥0.02/次（$0.0025）

  async removeBackground(imageFile: File, config?: ImageRemoverConfig): Promise<RemoveResult> {
    const apiKey = config?.apiKey

    console.log('\n========================================')
    console.log('🎨 ClipDrop API 调用')
    console.log('========================================')
    console.log('  - Base URL:', this.baseUrl)
    console.log('  - API Key:', apiKey?.substring(0, 10) + '...' || '未配置')
    console.log('  - 文件名:', imageFile.name)
    console.log('  - 文件大小:', imageFile.size, 'bytes')

    if (!apiKey) {
      console.error('❌ API Key 未配置')
      throw new Error('API Key 未配置')
    }

    if (apiKey.trim() !== apiKey) {
      console.error('❌ API Key 包含空格')
      throw new Error('API Key 包含空格，请检查环境变量配置')
    }

    const formData = new FormData()
    formData.append('image_file', imageFile)

    console.log('📡 发送请求到 ClipDrop API...')

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey.trim(),
      },
      body: formData,
    })

    console.log('  - 响应状态:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ ClipDrop API 错误:', errorText)
      console.error('  - 状态码:', response.status)

      if (response.status === 401) {
        console.error('  - 原因: API Key 无效或已过期')
        throw new Error('API Key 无效')
      }
      if (response.status === 429) {
        console.error('  - 原因: API 请求频率超限')
        throw new Error('API 请求频率超限')
      }
      if (response.status === 400) {
        console.error('  - 原因: 图片格式或大小不符合要求')
        throw new Error('图片格式或大小不符合要求')
      }

      throw new Error(`ClipDrop API 错误: ${errorText}`)
    }

    const buffer = await response.arrayBuffer()

    console.log('✅ ClipDrop API 调用成功')
    console.log('  - 返回大小:', buffer.byteLength, 'bytes')
    console.log('========================================\n')

    return {
      buffer,
      contentType: 'image/png',
    }
  }

  validateConfig(config: ImageRemoverConfig): boolean {
    const isValid = !!(config?.apiKey && config.apiKey.length > 0)
    console.log('🔍 ClipDrop 配置验证:', isValid ? '✅ 有效' : '❌ 无效')
    if (config?.apiKey) {
      console.log('  - API Key 长度:', config.apiKey.length)
      console.log('  - API Key 格式检查:', config.apiKey.trim() === config.apiKey ? '✅ 无空格' : '❌ 包含空格')
    }
    return isValid
  }

  getCost(): number {
    return this.cost
  }
}
