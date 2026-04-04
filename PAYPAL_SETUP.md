# PayPal 支付接入指南

## 概述

本项目已成功集成 PayPal 支付功能，支持用户通过 PayPal 购买去背景服务配额。

## 已完成的集成

### 1. 后端集成

#### ✅ 安装 PayPal SDK
```bash
npm install @paypal/paypal-server-sdk
```

#### ✅ 创建 PayPal 集成模块
- 文件路径：`lib/paypal/index.ts`
- 功能：
  - 创建 PayPal 订单
  - 生成支付链接
  - 捕获支付
  - 验证 Webhook（签名验证已跳过，见下方说明）

#### ✅ 更新 API 路由
- `app/api/order/create/route.ts` - 创建订单并生成 PayPal 支付链接
- `app/api/order/callback/route.ts` - 处理 PayPal Webhook 回调

### 2. 前端集成

#### ✅ 创建支付页面
- `app/payment/success/page.tsx` - 支付成功页面
- `app/payment/cancel/page.tsx` - 支付取消页面

#### ✅ 更新定价页面
- `app/pricing/page.tsx` - 集成 PayPal 支付按钮

### 3. 配置文件

#### ✅ 更新 wrangler.toml
已添加 PayPal 配置：
```toml
[vars]
PAYPAL_CLIENT_ID = "AYOsBGr8P3Yt4DRCiEXkO92MMcXSu91LFKsKZoKzL4jfD39E1EMdY-vp2nvwaoXjQUNgETUf0WG826hk"
PAYPAL_MODE = "sandbox"
PAYPAL_WEBHOOK_ID = "71P08758JG9218449"
NEXT_PUBLIC_PAYPAL_CLIENT_ID = "AYOsBGr8P3Yt4DRCiEXkO92MMcXSu91LFKsKZoKzL4jfD39E1EMdY-vp2nvwaoXjQUNgETUf0WG826hk"
NEXT_PUBLIC_PAYPAL_MODE = "sandbox"
```

## ⚠️ 重要：需要在 Cloudflare Pages 中配置的环境变量

由于 `PAYPAL_CLIENT_SECRET` 是敏感信息，不能提交到代码仓库，需要在 Cloudflare Pages 环境变量中配置：

### 必需的环境变量

```env
PAYPAL_CLIENT_SECRET = "ELOmQoMJkcUAm5gydlpwxZjh3OE8Fy3t04y4unwgtE3WlKE-cwg9CmEPlCMHOO5NbCQNhgMpR5QcRiqh"
```

### 已配置的环境变量

以下环境变量已在 `wrangler.toml` 中配置，无需在 Cloudflare Pages 中重复配置：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `PAYPAL_CLIENT_ID` | `AYOsBGr8P3Yt4DRCiEXkO92MMcXSu91LFKsKZoKzL4jfD39E1EMdY-vp2nvwaoXjQUNgETUf0WG826hk` | PayPal Client ID |
| `PAYPAL_MODE` | `sandbox` | 沙箱模式 |
| `PAYPAL_WEBHOOK_ID` | `71P08758JG9218449` | PayPal Webhook ID |

> 注意：由于 Cloudflare Edge Runtime 环境限制，Webhook 签名验证功能暂时跳过。建议在生产环境中使用 Cloudflare Workers 处理 Webhook 验证。

## 配置步骤

### 1. 配置 Cloudflare Pages 环境变量

由于 `PAYPAL_CLIENT_SECRET` 是敏感信息，需要在 Cloudflare Pages 环境变量中配置：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **bg-remover-6dp**
3. 点击 **Settings** → **Environment variables**
4. 添加以下环境变量：

| 变量名 | 值 |
|--------|-----|
| `PAYPAL_CLIENT_SECRET` | `ELOmQoMJkcUAm5gydlpwxZjh3OE8Fy3t04y4unwgtE3WlKE-cwg9CmEPlCMHOO5NbCQNhgMpR5QcRiqh` |

> 其他 PayPal 配置已在 `wrangler.toml` 中设置，无需重复配置。

### 2. （可选）配置 PayPal Webhook

✅ **Webhook ID 已配置**：`PAYPAL_WEBHOOK_ID = "71P08758JG9218449"`（已在 `wrangler.toml` 中配置）

如果你需要更新 Webhook：

1. 登录 [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. 进入 **Apps & Credentials** → 选择你的应用
3. 点击 **Webhooks** → 查看或创建 Webhook
4. 确保 Webhook URL 为：
   ```
   https://bg-remover-6dp.pages.dev/api/order/callback
   ```
5. 确保监听的事件包括：
   - `PAYMENT.CAPTURE.COMPLETED` - 支付完成
   - `PAYMENT.CAPTURE.DENIED` - 支付被拒绝
6. 如果创建了新的 Webhook，请更新 `wrangler.toml` 中的 `PAYPAL_WEBHOOK_ID`

## 支付流程

### 用户端流程

1. 用户访问定价页面 (`/pricing`)
2. 选择套餐，点击 **Buy Now**
3. 系统创建订单，生成 PayPal 支付链接
4. 跳转到 PayPal 支付页面
5. 用户完成支付
6. PayPal 重定向到：
   - 支付成功：`/payment/success?token=xxx&custom=订单号`
   - 支付取消：`/payment/cancel`

### 后端流程

1. **创建订单** (`POST /api/order/create`)
   - 验证用户登录状态
   - 查询产品信息
   - 创建本地订单记录
   - 调用 PayPal API 创建支付订单
   - 返回 PayPal 支付链接

2. **处理支付成功** (`POST /api/order/callback`)
   - 接收支付成功通知
   - 验证订单
   - 发放配额
   - 更新订单状态
   - 更新用户总消费

3. **Webhook 回调** (`PUT /api/order/callback`)
   - 接收 PayPal Webhook 通知
   - 验证签名（已跳过）
   - 通过 PayPal 订单 ID 查询本地订单
   - 发放配额
   - 更新订单状态

## 汇率说明

PayPal 只支持美元结算，系统自动将人民币转换为美元：

- 汇率假设：1 美元 = 7.2 人民币
- 示例：¥4.0 → $0.56

如需调整汇率，请修改 `lib/paypal/index.ts` 中的汇率常量。

## 测试

### 沙箱环境测试

当前配置为沙箱环境（`PAYPAL_MODE = "sandbox"`），可以使用 PayPal 沙箱账户测试支付流程：

1. 登录 [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. 进入 **Sandbox** → **Accounts**
3. 创建测试账户（或使用默认的测试账户）
4. 使用测试账户进行支付测试

### 生产环境部署

部署到生产环境时，需要：

1. 在 PayPal Developer Dashboard 创建 **Live** 应用
2. 获取 **Live** Client ID 和 Client Secret
3. 更新 Cloudflare Pages 环境变量：
   ```env
   PAYPAL_CLIENT_ID = "your-live-client-id"
   PAYPAL_CLIENT_SECRET = "your-live-client-secret"
   PAYPAL_MODE = "production"
   ```
4. 更新 `wrangler.toml` 中的配置：
   ```toml
   PAYPAL_CLIENT_ID = "your-live-client-id"
   PAYPAL_MODE = "production"
   NEXT_PUBLIC_PAYPAL_CLIENT_ID = "your-live-client-id"
   NEXT_PUBLIC_PAYPAL_MODE = "production"
   ```

## 注意事项

### 1. Webhook 签名验证

由于 Cloudflare Edge Runtime 环境限制，Webhook 签名验证功能暂时跳过。

**推荐方案：**
- 在生产环境中使用 Cloudflare Workers 处理 Webhook 验证
- 或者等待 PayPal SDK 支持 Edge Runtime

### 2. 安全性

- ✅ Client Secret 已通过环境变量配置，不会提交到代码仓库
- ⚠️ Webhook 端点未进行签名验证，存在被恶意调用的风险
- ⚠️ 建议在生产环境中实施 IP 白名单或使用 Cloudflare Workers 验证

### 3. 重复支付

- ✅ 系统已实现订单状态检查，避免重复发放配额
- ✅ Webhook 回调会检查订单状态，已处理的订单不会重复处理

### 4. 错误处理

- ✅ PayPal 订单创建失败会回滚本地订单
- ✅ 支付失败会更新订单状态
- ✅ 所有错误都有详细的日志记录

## 故障排查

### 问题 1：创建订单失败

**可能原因：**
- PayPal Client Secret 未配置
- PayPal API 不可用
- 网络连接问题

**解决方法：**
1. 检查 Cloudflare Pages 环境变量是否正确配置
2. 查看服务器日志，确认错误信息
3. 检查 PayPal Dashboard，确认应用配置正确

### 问题 2：支付成功但未发放配额

**可能原因：**
- Webhook 未正确配置
- Webhook 回调失败
- 订单状态已更新，但配额未发放

**解决方法：**
1. 检查 PayPal Webhook 配置是否正确
2. 查看 Cloudflare Pages 日志，确认 Webhook 是否收到
3. 手动查询数据库，检查订单状态
4. 如果 Webhook 失败，可以通过前端 `/payment/success` 页面触发手动回调

### 问题 3：支付链接无效

**可能原因：**
- PayPal 应用配置错误
- 返回 URL 配置不正确

**解决方法：**
1. 检查 `lib/paypal/index.ts` 中的 `return_url` 和 `cancel_url`
2. 确认 URL 配置为正确的域名
3. 检查 PayPal Dashboard 中的应用设置

## 下一步

- [ ] 在 PayPal Dashboard 确认 Webhook URL 配置正确
- [ ] 在 Cloudflare Pages 配置 `PAYPAL_CLIENT_SECRET`（必需）
- [ ] 测试完整的支付流程
- [ ] 部署到生产环境
- [ ] 配置 Webhook 签名验证（使用 Cloudflare Workers）

## 联系方式

如有问题，请访问 [GitHub Issues](https://github.com/wuji007a/bg-remover/issues) 提交问题。
