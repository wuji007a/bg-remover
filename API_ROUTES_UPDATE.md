# API 路由更新总结

## 更新日期
2026 年 3 月 30 日

## 更新内容

### 1. 新增文件
- **`env.d.ts`** - D1 数据库类型定义

### 2. 更新的 API 路由

#### `app/api/auth/callback/route.ts`
**功能扩展：**
- ✅ 创建或更新用户记录
- ✅ 新用户自动发放 3 次免费配额
- ✅ Google OAuth 验证和 session token 生成

**关键逻辑：**
```typescript
// 创建或更新用户
INSERT INTO users ... ON CONFLICT(google_id) DO UPDATE ...

// 新用户发放 3 次免费配额
INSERT INTO user_quota (user_id, quota_type, total) VALUES (?, 1, 3)
```

---

#### `app/api/remove-bg/route.ts`
**功能增强：**
- ✅ 用户登录状态检查
- ✅ 用户级别限流（1分钟最多5次请求）
- ✅ IP 级别限流（1分钟最多10次请求）
- ✅ 配额检查和扣减（优先扣除购买额度）
- ✅ 调用背景移除 API
- ✅ 记录使用日志（含成本和 API 提供商）
- ✅ 更新限流计数

**关键逻辑：**
```typescript
// 检查用户限流
SELECT request_count FROM rate_limits WHERE user_id = ? AND window_start > datetime('now', '-1 minute')

// 检查配额
SELECT prepaid, free FROM user_quota WHERE user_id = ?

// 扣减配额（优先购买额度）
UPDATE user_quota SET used = used + 1 WHERE quota_type = 2 ...

// 记录使用日志
INSERT INTO usage_logs (user_id, api_provider, cost) ...
```

---

#### `app/api/quota/consume/route.ts`
**完整实现：**
- ✅ 用户级别限流检查
- ✅ IP 级别限流检查
- ✅ 配额检查（购买额度 + 免费额度）
- ✅ 配额扣减（优先购买额度）
- ✅ 更新限流计数
- ✅ 返回剩余配额

**响应示例：**
```json
{
  "success": true,
  "data": {
    "consumed": 1,
    "quotaId": 123,
    "quotaType": "prepaid",
    "remaining": {
      "prepaid": 9,
      "free": 3,
      "total": 12
    }
  }
}
```

---

#### `app/api/quota/route.ts`
**完整实现：**
- ✅ 查询用户配额（购买额度 + 免费额度）
- ✅ 查询配额详情（用于前端展示）

**响应示例：**
```json
{
  "success": true,
  "data": {
    "prepaid": 10,
    "free": 3,
    "total": 13,
    "details": [
      {
        "id": 123,
        "quota_type": 2,
        "total": 10,
        "used": 0,
        "remaining": 10
      }
    ]
  }
}
```

---

#### `app/api/order/create/route.ts`
**完整实现：**
- ✅ 验证用户登录状态
- ✅ 查询产品信息
- ✅ 检查支付方式
- ✅ 生成订单号
- ✅ 创建订单记录

**支付方式配置：**
- `paypal` - PayPal（即将上线）
- `wechat` - 微信支付（暂未接入）
- `alipay` - 支付宝（暂未接入）

**响应示例：**
```json
{
  "success": true,
  "data": {
    "orderNo": "BG1711845600000abc123",
    "productId": 2,
    "productName": "10次优惠包",
    "quotaAwarded": 10,
    "amount": 4.00,
    "paymentMethod": "paypal",
    "status": 0
  }
}
```

---

#### `app/api/order/callback/route.ts`
**完整实现：**
- ✅ 验证订单号
- ✅ 处理支付成功
- ✅ 发放配额
- ✅ 更新订单状态
- ✅ 更新用户总消费

**支持的状态：**
- `success` / `paid` - 支付成功
- `failed` / `cancelled` - 支付失败

**响应示例：**
```json
{
  "success": true,
  "data": {
    "orderNo": "BG1711845600000abc123",
    "transactionId": "paypal_tx_123",
    "quotaAwarded": 10,
    "amount": 4.00,
    "paidAt": "2026-03-30T14:30:00.000Z"
  }
}
```

---

## D1 数据库集成

### 环境变量访问
```typescript
const DB = (process.env as any).DB
```

### 主要 SQL 操作

#### 1. 用户管理
```sql
-- 创建或更新用户
INSERT INTO users ... ON CONFLICT(google_id) DO UPDATE ...

-- 查询用户
SELECT * FROM users WHERE google_id = ?
```

#### 2. 配额管理
```sql
-- 查询配额
SELECT
  (SELECT SUM(total - used) FROM user_quota WHERE user_id = ? AND quota_type = 2) as prepaid,
  (SELECT total - used FROM user_quota WHERE user_id = ? AND quota_type = 1) as free

-- 扣减配额
UPDATE user_quota SET used = used + 1 WHERE id = ...

-- 发放配额
INSERT INTO user_quota (user_id, quota_type, total) VALUES (?, 2, ?)
```

#### 3. 订单管理
```sql
-- 创建订单
INSERT INTO orders (order_no, user_id, product_id, amount, quota_awarded, payment_method) ...

-- 查询订单
SELECT * FROM orders WHERE order_no = ?

-- 更新订单状态
UPDATE orders SET status = 1, paid_at = datetime('now') WHERE id = ?
```

#### 4. 使用记录
```sql
-- 记录使用
INSERT INTO usage_logs (user_id, api_provider, cost) ...
```

#### 5. 限流控制
```sql
-- 检查用户限流
SELECT request_count FROM rate_limits WHERE user_id = ? AND window_start > datetime('now', '-1 minute')

-- 检查 IP 限流
SELECT request_count FROM rate_limits WHERE ip_address = ? AND window_start > datetime('now', '-1 minute')

-- 更新限流计数
INSERT INTO rate_limits (user_id, ip_address, request_count, window_start) ...
ON CONFLICT(user_id, window_start) DO UPDATE SET request_count = request_count + 1
```

---

## 错误处理

### HTTP 状态码
- `200` - 成功
- `400` - 请求参数错误
- `401` - 未授权（需要登录）
- `402` - 配额不足（需要购买）
- `403` - API Key 无效
- `404` - 资源不存在
- `429` - 请求过于频繁（限流）
- `500` - 服务器错误
- `503` - 服务不可用（支付方式未启用）

### 错误响应格式
```json
{
  "success": false,
  "error": "错误信息",
  "needLogin": true,     // 可选，提示需要登录
  "needPay": true,       // 可选，提示需要购买
  "rateLimited": true,   // 可选，提示限流
  "retryAfter": 60       // 可选，重试时间（秒）
}
```

---

## 下一步

### 立即可做
1. 在 Cloudflare Dashboard 执行 SQL 脚本（21 步）
2. 配置环境变量：
   - `BG_REMOVER_PROVIDER` = "remove.bg"
   - `BG_REMOVER_API_KEY` = 你的 remove.bg API Key
   - `GOOGLE_CLIENT_SECRET` = `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`
3. 部署到 Cloudflare Pages
4. 测试所有 API 路由

### 待开发
5. 前端页面（定价页面、配额显示、配额不足弹窗）
6. Cron 定时任务（每日用量统计）
7. 支付集成（PayPal）

---

## 注意事项

1. **D1 数据库访问：** 在 Cloudflare Pages 的 Edge Runtime 中，D1 数据库通过 `process.env.DB` 访问
2. **事务处理：** 目前未使用事务，如有需要可以添加
3. **错误容错：** 数据库操作失败不会中断用户请求，但会记录日志
4. **限流配置：** 通过环境变量配置限流阈值：
   - `RATE_LIMIT_USER_PER_MINUTE` = 5
   - `RATE_LIMIT_IP_PER_MINUTE` = 10
5. **成本追踪：** 每次使用记录都会记录成本，目前 remove.bg 成本为 ¥0.05/次

---

## 测试建议

### 测试流程
1. 用户登录（Google OAuth）
2. 检查新用户是否获得 3 次免费配额
3. 调用去背景 API（3 次）
4. 检查配额是否正确扣减
5. 检查第 4 次请求是否返回 402（配额不足）
6. 创建订单（模拟支付）
7. 调用支付回调
8. 检查配额是否正确发放
9. 测试限流（1分钟内发送 6 次请求）

### 测试命令
```bash
# 查询配额
curl https://bg-remover-6dp.pages.dev/api/quota \
  -H "Cookie: auth_token=YOUR_TOKEN"

# 扣减配额
curl -X POST https://bg-remover-6dp.pages.dev/api/quota/consume \
  -H "Cookie: auth_token=YOUR_TOKEN"

# 创建订单
curl -X POST https://bg-remover-6dp.pages.dev/api/order/create \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -d '{"productId": 2, "paymentMethod": "paypal"}'
```

---

*最后更新：2026 年 3 月 30 日*
