/**
 * 背景移除服务公共模块
 * 
 * 使用方式：
 * 
 * 1. 自动从环境变量创建：
 * ```ts
 * import { createImageRemoverService } from '@/lib/bg-remover'
 * const service = createImageRemoverService()
 * const result = await service.removeBackground(imageFile)
 * ```
 * 
 * 2. 手动创建：
 * ```ts
 * import { ImageRemoverService, ProviderType } from '@/lib/bg-remover'
 * const service = new ImageRemoverService({
 *   type: ProviderType.CLIPDROP,
 *   apiKey: 'your-api-key'
 * })
 * const result = await service.removeBackground(imageFile)
 * ```
 * 
 * 3. 切换提供商：
 * ```ts
 * service.switchProvider({
 *   type: ProviderType.REMOVE_BG,
 *   apiKey: 'new-api-key'
 * })
 * ```
 */

export * from './types'
export * from './factory'
export * from './providers'
