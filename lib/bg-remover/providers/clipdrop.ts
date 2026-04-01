import { ImageRemoverProvider, ImageRemoverConfig, RemoveResult } from '../types'

export class ClipDropProvider implements ImageRemoverProvider {
  name = 'clipdrop'
  private readonly baseUrl = 'https://clipdrop-api.co/remove-background/v1'
  private readonly cost = 0.02 // 成本：¥0.02/次（$0.0025）

  async removeBackground(imageFile: File, config?: ImageRemoverConfig): Promise<RemoveResult> {
    const apiKey = config?.apiKey

    if (!apiKey) {
      throw new Error('API Key 未配置')
    }

    const formData = new FormData()
    formData.append('image_file', imageFile)

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      
      if (response.status === 401) {
        throw new Error('API Key 无效')
      }
      if (response.status === 429) {
        throw new Error('API 请求频率超限')
      }
      if (response.status === 400) {
        throw new Error('图片格式或大小不符合要求')
      }
      
      throw new Error(`ClipDrop API 错误: ${errorText}`)
    }

    const buffer = await response.arrayBuffer()

    return {
      buffer,
      contentType: 'image/png',
    }
  }

  validateConfig(config: ImageRemoverConfig): boolean {
    return !!(config?.apiKey && config.apiKey.length > 0)
  }

  getCost(): number {
    return this.cost
  }
}
