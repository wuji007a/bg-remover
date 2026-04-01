# 快速开始：D1 数据库创建

## 问题说明

当前环境（非交互式服务器）无法使用 `wrangler login`，因此无法直接创建 D1 数据库。

## 解决方案

在你的**本地开发环境**（支持 wrangler login）中执行以下步骤。

---

## 步骤1：准备环境

```bash
# 1. 确保安装了 Node.js 和 wrangler
node --version  # 应该是 v16 或更高
wrangler --version  # 应该是 v4.0 或更高

# 2. 克隆或进入项目目录
cd /path/to/bg-remover
```

---

## 步骤2：登录 Cloudflare

```bash
# 登录（会打开浏览器）
wrangler login
```

登录成功后，你应该看到：
```
✨ Successfully logged in
```

---

## 步骤3：创建 D1 数据库

```bash
# 创建数据库
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

**重要：** 复制 `database_id` 的值！

---

## 步骤4：更新 wrangler.toml

打开项目中的 `wrangler.toml` 文件，找到 D1 数据库绑定部分：

```toml
[[d1_databases]]
binding = "DB"
database_name = "bg-remover-db"
database_id = ""  # 粘贴你复制的 database_id
```

将 `database_id` 的值更新为你刚才复制的内容。

---

## 步骤5：初始化数据库

```bash
# 执行初始化 SQL 脚本
wrangler d1 execute bg-remover-db --file=./init-d1.sql
```

输出示例：
```
✨ Successfully executed the query on 'bg-remover-db'
```

---

## 步骤6：验证数据库

```bash
# 查看所有表
wrangler d1 execute bg-remover-db --command="SELECT name FROM sqlite_master WHERE type='table'"

# 查看产品数据
wrangler d1 execute bg-remover-db --command="SELECT * FROM products"

# 查看用户表结构
wrangler d1 execute bg-remover-db --command=".schema users"
```

应该看到 6 张表：
1. users
2. user_quota
3. products
4. orders
5. usage_logs
6. rate_limits

---

## 步骤7：部署到 Cloudflare Pages

```bash
# 构建项目
npm run build

# 部署
wrangler pages deploy .vercel/output/static
```

---

## 步骤8：配置环境变量

在 Cloudflare Pages 的设置中添加环境变量：

```env
BG_REMOVER_PROVIDER=clipdrop
BG_REMOVER_API_KEY=your-clipdrop-api-key
```

---

## 常见问题

### Q: wrangler login 失败？
A: 确保：
- 已安装 Node.js v16 或更高
- 已安装最新版本的 wrangler：`npm install -g wrangler`
- 网络连接正常

### Q: 创建数据库失败？
A: 检查：
- Cloudflare 账户是否已创建
- 是否有 D1 权限
- 账户额度是否充足

### Q: 执行 SQL 脚本失败？
A: 检查：
- SQL 文件路径是否正确
- SQL 语法是否正确
- 数据库是否已创建

---

## 数据库表说明

### users - 用户表
存储用户基本信息，包括 Google OAuth 信息。

### user_quota - 用户配额表
存储用户的配额信息，分为免费配额（type=1）和购买配额（type=2）。

### products - 产品表
存储可购买的套餐产品，已初始化3个套餐：
- 单次购买：¥0.5（1次）
- 10次优惠包：¥4（10次）
- 50次超值包：¥15（50次）

### orders - 订单表
存储用户的订单信息，包括支付状态。

### usage_logs - 使用记录表
存储每次 API 调用的记录，包括成本和 API 提供商。

### rate_limits - 限流表
存储用户和 IP 的请求限流信息。

---

## 验证清单

创建完成后，请验证以下项目：

- [ ] D1 数据库已创建
- [ ] `wrangler.toml` 中的 `database_id` 已更新
- [ ] SQL 初始化脚本已执行
- [ ] 6 张表已创建
- [ ] 产品数据已初始化（3个套餐）
- [ ] 项目已构建
- [ ] 项目已部署到 Cloudflare Pages
- [ ] 环境变量已配置

---

## 下一步

数据库创建完成后，继续以下工作：

1. **注册 ClipDrop API**
   - 访问：https://clipdrop.co/apis
   - 获取 API Key

2. **实现 D1 数据库集成**
   - 修改 `app/api/quota/consume/route.ts`
   - 修改 `app/api/quota/route.ts`
   - 修改 `app/api/order/create/route.ts`
   - 修改 `app/api/order/callback/route.ts`

3. **扩展 OAuth 回调**
   - 发放 3 次免费额度
   - 创建用户记录

---

**完成时间：** 预计 10-15 分钟

**需要帮助？** 参考 `D1_SETUP_GUIDE.md` 获取更详细的说明。
