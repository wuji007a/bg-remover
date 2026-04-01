# 背景移除服务公共模块

## 功能特性

✅ **统一接口** - 所有API提供商使用相同的调用方式
✅ **易于切换** - 通过配置快速切换不同的API提供商
✅ **类型安全** - 完整的TypeScript类型定义
✅ **成本追踪** - 自动计算每次调用的成本
✅ **错误处理** - 统一的错误处理和状态码映射

## 支持的提供商

| 提供商 | 类型标识 | 成本 | 状态 |
|--------|----------|------|------|
| remove.bg | `remove.bg` | ¥2.2/次 | ✅ 已实现 |
| ClipDrop | `clipdrop` | ¥0.02/次 | ✅ 已实现 |
| Slazzer | `slazzer` | - | 🚧 预留接口 |

## 使用方式

### 方式一：自动从环境变量创建（推荐）

在 `.env` 或 `wrangler.toml` 中配置：

```env
# 选择提供商类型
BG_REMOVER_PROVIDER=clipdrop

# API Key
BG_REMOVER_API_KEY=your-api-key-here
```

然后在代码中：

```ts
import { createImageRemoverService } from '@/lib/bg-remover'

const service = createImageRemoverService()
const result = await service.removeBackground(imageFile)
```

### 方式二：手动创建服务实例

```ts
import { ImageRemoverService, ProviderType } from '@/lib/bg-remover'

const service = new ImageRemoverService({
  type: ProviderType.CLIPDROP,
  apiKey: 'your-api-key',
  options: {
    // 提供商特定的配置
  }
})

const result = await service.removeBackground(imageFile)
```

### 方式三：动态切换提供商

```ts
import { ImageRemoverService, ProviderType } from '@/lib/bg-remover'

const service = new ImageRemoverService({
  type: ProviderType.CLIPDROP,
  apiKey: 'clipdrop-api-key',
})

// 使用 ClipDrop 处理
const result1 = await service.removeBackground(imageFile)

// 切换到 remove.bg
service.switchProvider({
  type: ProviderType.REMOVE_BG,
  apiKey: 'remove-bg-api-key',
})

// 使用 remove.bg 处理
const result2 = await service.removeBackground(imageFile)
```

## 环境变量配置

### 使用 ClipDrop

```env
BG_REMOVER_PROVIDER=clipdrop
BG_REMOVER_API_KEY=your-clipdrop-api-key
```

### 使用 remove.bg

```env
BG_REMOVER_PROVIDER=remove.bg
BG_REMOVER_API_KEY=your-remove-bg-api-key
```

### 使用 Cloudflare Pages

在 `wrangler.toml` 中：

```toml
[vars]
BG_REMOVER_PROVIDER = "clipdrop"
BG_REMOVER_API_KEY = "your-api-key"
```

## API 集成示例

### 在 API Route 中使用

```ts
import { createImageRemoverService } from '@/lib/bg-remover'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image') as File

    const service = createImageRemoverService()
    const result = await service.removeBackground(image)

    return new NextResponse(result.buffer, {
      headers: {
        'Content-Type': result.contentType,
        'X-Provider': service.getProviderInfo().name,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
```

## 添加新的提供商

### 1. 创建提供商类

在 `lib/bg-remover/providers/` 下创建新文件，例如 `slazzer.ts`：

```ts
import { ImageRemoverProvider, ImageRemoverConfig, RemoveResult } from '../types'

export class SlazzerProvider implements ImageRemoverProvider {
  name = 'slazzer'
  private readonly baseUrl = 'https://api.slazzer.com/v1.0/remove-bg'
  private readonly cost = 1.0 // 成本：¥1.0/次

  async removeBackground(imageFile: File, config?: ImageRemoverConfig): Promise<RemoveResult> {
    // 实现调用逻辑
  }

  validateConfig(config: ImageRemoverConfig): boolean {
    // 验证配置
  }

  getCost(): number {
    return this.cost
  }
}
```

### 2. 注册提供商

在 `lib/bg-remover/providers/index.ts` 中：

```ts
import { SlazzerProvider } from './slazzer'

export { SlazzerProvider }

export function createProvider(type: ProviderType): ImageRemoverProvider {
  switch (type) {
    case ProviderType.REMOVE_BG:
      return new RemoveBgProvider()
    case ProviderType.CLIPDROP:
      return new ClipDropProvider()
    case ProviderType.SLAZZER: // 新增
      return new SlazzerProvider()
    default:
      throw new Error(`不支持的提供商类型: ${type}`)
  }
}
```

### 3. 更新类型定义

在 `lib/bg-remover/types.ts` 中确保 `ProviderType` 包含新类型：

```ts
export enum ProviderType {
  REMOVE_BG = 'remove.bg',
  CLIPDROP = 'clipdrop',
  SLAZZER = 'slazzer', // 已存在
  CUSTOM = 'custom'
}
```

## 文件结构

```
lib/bg-remover/
├── index.ts           # 统一导出
├── types.ts           # 类型定义
├── factory.ts         # 工厂函数
├── README.md          # 本文档
└── providers/
    ├── index.ts       # 提供商管理
    ├── remove-bg.ts   # remove.bg 实现
    └── clipdrop.ts    # ClipDrop 实现
```

## 优势

1. **解耦** - API 调用逻辑与具体提供商解耦
2. **可测试** - 可以轻松 mock 不同的提供商进行测试
3. **可维护** - 新增提供商只需实现接口，不影响现有代码
4. **可扩展** - 支持自定义提供商实现
5. **成本透明** - 每个提供商明确标注成本

## 注意事项

- API Key 需要在环境变量中配置，不要硬编码
- 不同的 API 提供商可能有不同的限制（图片大小、格式等）
- 成本计算仅供参考，实际以 API 提供商为准
