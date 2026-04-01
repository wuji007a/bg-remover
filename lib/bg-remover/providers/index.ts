import { RemoveBgProvider } from './remove-bg'
import { ClipDropProvider } from './clipdrop'
import { ProviderType, ImageRemoverProvider } from '../types'

export { RemoveBgProvider, ClipDropProvider }

/**
 * 根据提供商类型创建对应的实例
 */
export function createProvider(type: ProviderType): ImageRemoverProvider {
  switch (type) {
    case ProviderType.REMOVE_BG:
      return new RemoveBgProvider()
    case ProviderType.CLIPDROP:
      return new ClipDropProvider()
    default:
      throw new Error(`不支持的提供商类型: ${type}`)
  }
}

/**
 * 获取所有支持的提供商
 */
export function getSupportedProviders(): ProviderType[] {
  return [
    ProviderType.REMOVE_BG,
    ProviderType.CLIPDROP,
  ]
}
