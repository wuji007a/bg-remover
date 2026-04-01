# Cloudflare D1 数据库初始化指南

由于在非交互式环境中无法使用 wrangler 登录，需要手动完成以下步骤。

## 步骤1：创建 D1 数据库

在你的本地开发环境（支持 wrangler login）中执行：

```bash
cd /path/to/bg-remover
wrangler login
wrangler d1 create bg-remover-db
```

输出示例：
```
✨ Successfully created DB 'bg-remover-db'

[[d1_databases]]
binding = "DB"
database_name = "bg-remover-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

复制 `database_id`，更新 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "bg-remover-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 步骤2：执行数据库初始化

使用以下命令执行 SQL 脚本：

```bash
wrangler d1 execute bg-remover-db --file=./init-d1.sql
```

或者使用 wrangler 的交互式 SQL 模式：

```bash
wrangler d1 execute bg-remover-db --command=$(cat init-d1.sql)
```

## 步骤3：验证数据库

```bash
# 查看所有表
wrangler d1 execute bg-remover-db --command="SELECT name FROM sqlite_master WHERE type='table'"

# 查看产品数据
wrangler d1 execute bg-remover-db --command="SELECT * FROM products"

# 查看表结构
wrangler d1 execute bg-remover-db --command=".schema users"
```

## 步骤4：部署到 Cloudflare Pages

数据库创建和初始化完成后，部署到 Cloudflare Pages：

```bash
npm run build
wrangler pages deploy .vercel/output/static
```

## 数据库表说明

### 1. users - 用户表
存储用户基本信息，包括 Google OAuth 信息。

### 2. user_quota - 用户配额表
存储用户的配额信息，分为免费配额（type=1）和购买配额（type=2）。

### 3. products - 产品表
存储可购买的套餐产品，已初始化3个套餐：
- 单次购买：¥0.5（1次）
- 10次优惠包：¥4（10次）
- 50次超值包：¥15（50次）

### 4. orders - 订单表
存储用户的订单信息，包括支付状态。

### 5. usage_logs - 使用记录表
存储每次 API 调用的记录，包括成本和 API 提供商。

### 6. rate_limits - 限流表
存储用户和 IP 的请求限流信息。

## 备份和恢复

### 备份数据库

```bash
# 导出所有数据
wrangler d1 execute bg-remover-db --command=".dump" > backup.sql

# 导出特定表
wrangler d1 execute bg-remover-db --command="SELECT * FROM users" > users.sql
```

### 恢复数据库

```bash
# 从 SQL 文件恢复
wrangler d1 execute bg-remover-db --file=./backup.sql
```

## 常见问题

### Q: wrangler login 在非交互式环境无法使用？
A: 是的，需要在本地开发环境中使用 wrangler login，然后复制生成的认证文件到服务器。

### Q: 如何查看数据库大小？
A: 目前 D1 不直接提供大小查询，可以通过统计表数据估算：
```bash
wrangler d1 execute bg-remover-db --command="SELECT COUNT(*) as count FROM users"
```

### Q: 如何清空数据库？
A: 删除并重新创建：
```bash
wrangler d1 delete bg-remover-db
wrangler d1 create bg-remover-db
wrangler d1 execute bg-remover-db --file=./init-d1.sql
```

## 环境变量配置

在 Cloudflare Pages 的环境变量中设置：

```env
BG_REMOVER_PROVIDER=clipdrop
BG_REMOVER_API_KEY=your-clipdrop-api-key
```

## 相关文档

- Cloudflare D1 文档：https://developers.cloudflare.com/d1/
- wrangler D1 命令：https://developers.cloudflare.com/workers/wrangler/commands/#d1
