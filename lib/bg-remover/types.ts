// 背景移除服务统一的类型定义

export interface ImageRemoverConfig {
  apiKey: string
  // 各个厂商的特殊配置
  options?: Record<string, any>
}

export interface RemoveResult {
  buffer: ArrayBuffer
  contentType: string
  // 可能的额外信息
  metadata?: Record<string, any>
}

export interface ImageRemoverProvider {
  name: string
  /**
   * 移除图片背景
   * @param imageFile 图片文件
   * @param config 配置
   * @returns 处理后的图片
   */
  removeBackground(imageFile: File, config?: ImageRemoverConfig): Promise<RemoveResult>
  
  /**
   * 验证配置是否有效
   */
  validateConfig(config: ImageRemoverConfig): boolean
  
  /**
   * 获取成本（每次调用的成本，单位：元）
   */
  getCost(): number
}

// 提供商类型枚举
export enum ProviderType {
  REMOVE_BG = 'remove.bg',
  CLIPDROP = 'clipdrop',
  SLAZZER = 'slazzer',
  CUSTOM = 'custom'
}

export interface ProviderConfig {
  type: ProviderType
  apiKey: string
  options?: Record<string, any>
}
