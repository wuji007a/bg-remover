# API抽象层使用指南

## 快速开始

### 1. 配置环境变量

在 `.env.local` 或 `wrangler.toml` 中配置：

```env
# 选择API提供商
BG_REMOVER_PROVIDER=remove.bg  # 选项: remove.bg, clipdrop

# API Key
BG_REMOVER_API_KEY=your-api-key-here
```

### 2. 切换提供商

**方式一：修改环境变量（推荐）**
```env
# 使用 remove.bg
BG_REMOVER_PROVIDER=remove.bg

# 或使用 ClipDrop
BG_REMOVER_PROVIDER=clipdrop
```

**方式二：运行时切换**
```ts
import { ImageRemoverService, ProviderType } from '@/lib/bg-remover'

const service = new ImageRemoverService({
  type: ProviderType.CLIPDROP,
  apiKey: 'your-api-key'
})

// 切换到其他提供商
service.switchProvider({
  type: ProviderType.REMOVE_BG,
  apiKey: 'another-api-key'
})
```

### 3. 使用抽象层

**在 API Route 中：**
```ts
import { createImageRemoverService } from '@/lib/bg-remover'

const service = createImageRemoverService()
const result = await service.removeBackground(imageFile)

return new NextResponse(result.buffer, {
  headers: {
    'Content-Type': result.contentType,
    'X-Provider': service.getProviderInfo().name,
  },
})
```

**手动创建服务：**
```ts
import { ImageRemoverService, ProviderType } from '@/lib/bg-remover'

const service = new ImageRemoverService({
  type: ProviderType.CLIPDROP,
  apiKey: process.env.BG_REMOVER_API_KEY
})

const result = await service.removeBackground(imageFile)
```

## 测试

### 测试 remove.bg

```bash
node test-api.js test.jpg
```

### 测试 ClipDrop

1. 先注册 ClipDrop API: https://clipdrop.co/apis
2. 获取 API Key
3. 更新环境变量：
```env
BG_REMOVER_PROVIDER=clipdrop
BG_REMOVER_API_KEY=your-clipdrop-api-key
```
4. 运行测试：
```bash
node test-api.js test.jpg
```

## 成本对比

| 提供商 | 单次成本 | 状态 |
|--------|---------|------|
| ClipDrop | ¥0.02/次 | ✅ 推荐 |
| remove.bg | ¥2.2/次 | ✅ 备用 |

## 添加新提供商

只需3步：

1. **创建提供商类**（`lib/bg-remover/providers/your-provider.ts`）：
```ts
import { ImageRemoverProvider, ImageRemoverConfig, RemoveResult } from '../types'

export class YourProvider implements ImageRemoverProvider {
  name = 'your-provider'
  private readonly cost = 0.05

  async removeBackground(imageFile: File, config?: ImageRemoverConfig): Promise<RemoveResult> {
    // 实现你的API调用逻辑
  }

  validateConfig(config: ImageRemoverConfig): boolean {
    return !!(config?.apiKey && config.apiKey.length > 0)
  }

  getCost(): number {
    return this.cost
  }
}
```

2. **注册提供商**（`lib/bg-remover/providers/index.ts`）：
```ts
import { YourProvider } from './your-provider'

export { YourProvider }

export function createProvider(type: ProviderType): ImageRemoverProvider {
  switch (type) {
    case ProviderType.YOUR_PROVIDER:
      return new YourProvider()
    // ...
  }
}
```

3. **更新类型定义**（`lib/bg-remover/types.ts`）：
```ts
export enum ProviderType {
  YOUR_PROVIDER = 'your-provider',
  // ...
}
```

完成！🎉

## 错误处理

抽象层会自动处理常见错误：

```ts
try {
  const result = await service.removeBackground(imageFile)
} catch (error) {
  if (error.message.includes('API Key 无效')) {
    // 处理无效密钥
  } else if (error.message.includes('API 配额已用完')) {
    // 处理配额不足
  } else if (error.message.includes('API 请求频率超限')) {
    // 处理限流
  }
}
```

## 相关文档

- **详细文档：** `/lib/bg-remover/README.md`
- **类型定义：** `/lib/bg-remover/types.ts`
- **实现示例：** `/lib/bg-remover/providers/`

## 问题排查

**问题：找不到模块 `@/lib/bg-remover`**
- 确保 `tsconfig.json` 或 `next.config.js` 配置了路径别名
- 或使用相对路径：`../../../lib/bg-remover`

**问题：API Key 无效**
- 检查环境变量是否正确配置
- 确认 API Key 是否有效且未过期

**问题：无法连接到API**
- 检查网络连接
- 确认 API 服务是否正常运行
- 检查防火墙设置
