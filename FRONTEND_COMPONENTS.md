# 前端组件和页面开发文档

**创建日期：** 2026 年 3 月 30 日
**状态：** 已完成

---

## ✅ 已创建的组件和页面

### 1. 配额显示组件（QuotaBadge）

**文件路径：** `components/quota-badge.tsx`

**功能：**
- 显示用户剩余配额（购买 + 免费）
- 实时更新配额数据
- 配额状态提示（充足、不足、已用完）
- 低配额时显示快速购买入口

**使用方式：**
```tsx
import QuotaBadge from '@/components/quota-badge'

export default function YourPage() {
  return <QuotaBadge />
}
```

**状态提示：**
- 🟢 绿色：配额充足（> 3 次）
- 🟡 黄色：配额不足（1-3 次）
- 🔴 红色：配额已用完（0 次）

**API 调用：**
```typescript
GET /api/quota

响应：
{
  "success": true,
  "data": {
    "prepaid": 10,    // 购买额度
    "free": 3,        // 免费额度
    "total": 13       // 总额度
  }
}
```

---

### 2. 配额不足弹窗（QuotaModal）

**文件路径：** `components/quota-modal.tsx`

**功能：**
- 配额不足时自动显示
- 展示 3 个套餐（单次、10 次、50 次）
- 支持选择套餐并创建订单
- 跳转到 PayPal 支付（预留）

**使用方式：**
```tsx
import QuotaModal from '@/components/quota-modal'
import { useState } from 'react'

export default function YourPage() {
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false)

  return (
    <div>
      <QuotaModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />

      <button onClick={() => setIsQuotaModalOpen(true)}>
        打开配额弹窗
      </button>
    </div>
  )
}
```

**API 调用：**
```typescript
POST /api/order/create

请求：
{
  "productId": 2,
  "paymentMethod": "paypal"
}

响应：
{
  "success": true,
  "data": {
    "orderNo": "BG1711845600000abc123",
    "productId": 2,
    "productName": "10次优惠包",
    "quotaAwarded": 10,
    "amount": 4.00,
    "status": 0
  }
}
```

---

### 3. 定价页面（Pricing Page）

**文件路径：** `app/pricing/page.tsx`

**功能：**
- 展示 3 个套餐（单次、10 次、50 次）
- 突出推荐套餐（10 次包）
- 显示单次价格和节省金额
- 新用户福利提示
- 安全保障说明

**访问地址：** `/pricing`

**套餐信息：**

| 套餐 | 配额 | 价格 | 单次价格 |
|------|------|------|----------|
| 单次购买 | 1 次 | ¥0.50 | ¥0.50 |
| 10 次优惠包 | 10 次 | ¥4.00 | ¥0.40 |
| 50 次超值包 | 50 次 | ¥15.00 | ¥0.30 |

**设计特点：**
- 使用渐变色头部（橙色到红色）
- 卡片式布局，支持悬停效果
- 推荐套餐使用橙色高亮
- 移动端响应式设计

---

### 4. 使用示例（Usage Example）

**文件路径：** `components/USAGE_EXAMPLE.tsx`

**功能：**
- 展示如何集成配额显示组件和配额不足弹窗
- 展示在上传图片前检查配额的逻辑

**使用方式：**
```tsx
import { useState } from 'react'
import QuotaBadge from '@/components/quota-badge'
import QuotaModal from '@/components/quota-modal'

export default function ExamplePage() {
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false)

  const handleUpload = async () => {
    // 检查配额
    const res = await fetch('/api/quota')
    const data = await res.json()

    if (data.success && data.data.total === 0) {
      // 配额不足，显示弹窗
      setIsQuotaModalOpen(true)
    } else {
      // 配额充足，上传图片
      // TODO: 上传图片逻辑
    }
  }

  return (
    <div>
      {/* 配额显示组件 */}
      <QuotaBadge />

      {/* 配额不足弹窗 */}
      <QuotaModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />

      {/* 上传图片按钮 */}
      <button onClick={handleUpload}>上传图片</button>
    </div>
  )
}
```

---

## 🎨 UI 框架和依赖

### 已使用的图标库

```bash
npm install lucide-react
```

### Tailwind CSS

所有组件都使用 Tailwind CSS 进行样式设计。

---

## 🔧 集成到首页

### 方法 1：在导航栏中添加配额显示

```tsx
// app/layout.tsx 或 app/page.tsx

import QuotaBadge from '@/components/quota-badge'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex justify-between items-center p-4">
        <div className="text-xl font-bold">bg-remover</div>
        <QuotaBadge />
      </nav>
      {children}
    </div>
  )
}
```

### 方法 2：在上传区域上方添加配额显示

```tsx
// app/page.tsx

import QuotaBadge from '@/components/quota-badge'
import QuotaModal from '@/components/quota-modal'

export default function Home() {
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false)

  const handleFileUpload = async (file: File) => {
    // 检查配额
    const res = await fetch('/api/quota')
    const data = await res.json()

    if (data.success && data.data.total === 0) {
      setIsQuotaModalOpen(true)
      return
    }

    // 配额充足，上传图片
    const formData = new FormData()
    formData.append('image', file)

    const uploadRes = await fetch('/api/remove-bg', {
      method: 'POST',
      body: formData,
    })

    if (uploadRes.ok) {
      // 处理成功，刷新配额显示
      window.location.reload()
    }
  }

  return (
    <div>
      <header className="flex justify-between items-center p-4">
        <h1>bg-remover</h1>
        <QuotaBadge />
      </header>

      <main>
        {/* 上传区域 */}
        <input
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileUpload(file)
          }}
        />
      </main>

      {/* 配额不足弹窗 */}
      <QuotaModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />
    </div>
  )
}
```

---

## 📱 响应式设计

所有组件都支持移动端响应式设计：

- **配额显示组件：** 在小屏幕上自动调整布局
- **配额不足弹窗：** 在小屏幕上使用单列布局
- **定价页面：** 在移动端使用单列，桌面端使用三列

---

## ⚠️ 注意事项

### 1. 配额刷新

配额数据会在以下情况下刷新：
- 页面加载时
- 上传图片成功后

如需实时刷新，可以使用 SWR 或 React Query 进行数据轮询。

### 2. 支付集成

当前配额不足弹窗中预留了 PayPal 支付接口，需要完成以下工作：

```tsx
// TODO: 跳转到 PayPal 支付页面
const handlePurchase = async (productId: number) => {
  const res = await fetch('/api/order/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId,
      paymentMethod: 'paypal',
    }),
  })

  const data = await res.json()

  if (data.success) {
    // 跳转到 PayPal 支付页面
    // 实际代码：
    // window.location.href = data.data.paymentUrl
    alert('订单创建成功！订单号：' + data.data.orderNo)
  }
}
```

### 3. 产品数据

当前使用硬编码的产品数据，实际应该从 API 获取：

```typescript
// TODO: 从 API 获取产品数据
const res = await fetch('/api/products')
const data = await res.json()
```

---

## 🎯 下一步工作

### 立即可做

1. **集成到首页**
   - 在导航栏中添加配额显示组件
   - 在上传区域上方添加配额显示
   - 在上传图片前检查配额

2. **优化用户体验**
   - 添加加载状态
   - 添加错误提示
   - 添加成功提示

### 后续优化

3. **实现 PayPal 支付**
   - 集成 PayPal REST API
   - 处理支付回调
   - 更新订单状态

4. **添加用户设置页面**
   - 查看使用历史
   - 查看订单记录
   - 修改个人资料

---

## 📄 相关文件

- `components/quota-badge.tsx` - 配额显示组件
- `components/quota-modal.tsx` - 配额不足弹窗
- `app/pricing/page.tsx` - 定价页面
- `components/USAGE_EXAMPLE.tsx` - 使用示例
- `API_ROUTES_UPDATE.md` - API 路由文档
- `TECHNICAL_PLAN.md` - 完整技术方案

---

*最后更新：2026 年 3 月 30 日*
*状态：✅ 已完成*
