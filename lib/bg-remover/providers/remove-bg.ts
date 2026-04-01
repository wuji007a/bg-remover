import { ImageRemoverProvider, ImageRemoverConfig, RemoveResult } from '../types'

export class RemoveBgProvider implements ImageRemoverProvider {
  name = 'remove.bg'
  private readonly baseUrl = 'https://api.remove.bg/v1.0/removebg'
  private readonly cost = 2.2 // 成本：¥2.2/次

  async removeBackground(imageFile: File, config?: ImageRemoverConfig): Promise<RemoveResult> {
    const apiKey = config?.apiKey

    if (!apiKey) {
      throw new Error('API Key 未配置')
    }

    const formData = new FormData()
    formData.append('image_file', imageFile)
    formData.append('size', config?.options?.size || 'auto')

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      
      if (response.status === 402) {
        throw new Error('API 配额已用完')
      }
      if (response.status === 403) {
        throw new Error('API Key 无效')
      }
      
      throw new Error(`remove.bg API 错误: ${errorText}`)
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
