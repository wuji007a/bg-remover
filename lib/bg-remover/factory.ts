import { ProviderType, ProviderConfig, ImageRemoverProvider } from './types'
import { createProvider } from './providers'

export class ImageRemoverService {
  private provider: ImageRemoverProvider
  private config: ProviderConfig

  constructor(config: ProviderConfig) {
    this.config = config
    this.provider = createProvider(config.type)
    
    // 验证配置
    if (!this.provider.validateConfig(config)) {
      throw new Error(`无效的配置: ${config.type}`)
    }
  }

  /**
   * 移除图片背景
   */
  async removeBackground(imageFile: File) {
    return this.provider.removeBackground(imageFile, {
      apiKey: this.config.apiKey,
      options: this.config.options,
    })
  }

  /**
   * 获取当前提供商信息
   */
  getProviderInfo() {
    return {
      name: this.provider.name,
      type: this.config.type,
      cost: this.provider.getCost(),
    }
  }

  /**
   * 切换提供商
   */
  switchProvider(newConfig: ProviderConfig) {
    this.config = newConfig
    this.provider = createProvider(newConfig.type)
    
    if (!this.provider.validateConfig(newConfig)) {
      throw new Error(`无效的配置: ${newConfig.type}`)
    }
  }
}

/**
 * 从环境变量自动创建服务实例
 */
export function createImageRemoverService(): ImageRemoverService {
  // 从环境变量读取提供商配置
  const providerType = process.env.BG_REMOVER_PROVIDER as ProviderType || ProviderType.CLIPDROP
  
  const config: ProviderConfig = {
    type: providerType,
    apiKey: process.env.BG_REMOVER_API_KEY || '',
  }

  return new ImageRemoverService(config)
}
