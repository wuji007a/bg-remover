# 在 Cloudflare 网页上创建 D1 数据库

**适用于：** 不熟悉命令行，更习惯网页操作的用户
**预计时间：** 5-10 分钟

---

## 🎯 准备工作

开始之前，请确保：
- [ ] 你已经有一个 Cloudflare 账号
- [ ] 你能够访问 https://dash.cloudflare.com
- [ ] 你有 `bg-remover` 项目的文件夹

---

## 步骤 1：登录 Cloudflare Dashboard

1. 打开浏览器，访问：https://dash.cloudflare.com

2. 使用你的 Cloudflare 账号登录（邮箱或 Google 账号）

3. 登录成功后，你会看到 Cloudflare 的主界面

---

## 步骤 2：进入 D1 数据库管理

1. 在左侧导航栏中，找到并点击 **"Workers & Pages"**

2. 进入后，你会看到 Workers 和 Pages 的菜单

3. 在 Workers 菜单下，找到并点击 **"D1"**

   **提示：** D1 的图标是一个小的立方体 🧊

---

## 步骤 3：创建 D1 数据库

1. 点击页面右上角的 **"Create database"** 按钮

2. 填写数据库信息：
   - **Database name（数据库名称）：** `bg-remover-db`
   - **Location（位置）：** 选择离你最近的位置（推荐：`weur` - 西欧）

3. 点击 **"Create database"** 按钮

4. 等待数据库创建完成（通常 10-30 秒）

---

## 步骤 4：获取 Database ID

1. 数据库创建成功后，你会看到数据库详情页面

2. 在页面左侧或顶部，找到 **"Account ID"** 或 **"Database ID"**

3. 复制这个 ID（格式类似：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）

4. **重要：** 将这个 ID 保存到记事本或其他地方，等下要用

---

## 步骤 5：打开 D1 控制台

1. 在数据库详情页面，找到并点击 **"Console"** 标签页

   **提示：** Console 标签页通常在页面中间或右侧

2. 你会看到一个 SQL 编辑框，可以在里面输入 SQL 命令

---

## 步骤 6：复制初始化 SQL 脚本

1. 在你的 `bg-remover` 项目文件夹中，找到 `init-d1.sql` 文件

2. 用文本编辑器（如记事本、VS Code）打开这个文件

3. **选择全部内容：**
   - Windows: `Ctrl + A`
   - Mac: `Command + A`

4. **复制全部内容：**
   - Windows: `Ctrl + C`
   - Mac: `Command + C`

---

## 步骤 7：在 D1 控制台中执行 SQL 脚本

1. 回到 Cloudflare D1 的 Console 标签页

2. **删除编辑框中的任何现有内容**

3. **粘贴你刚才复制的 SQL 脚本：**
   - Windows: `Ctrl + V`
   - Mac: `Command + V`

4. 确认编辑框中是完整的 SQL 脚本（应该有很多行）

5. 点击编辑框右下角的 **"Execute"** 或 **"Run"** 按钮

6. 等待执行完成（通常 5-15 秒）

7. 如果成功，你会看到类似这样的消息：
   ```
   ✨ Successfully executed 6 queries
   ```

---

## 步骤 8：验证数据库

1. 在 SQL 编辑框中，输入以下命令：

   ```sql
   SELECT name FROM sqlite_master WHERE type='table';
   ```

2. 点击 **"Execute"** 按钮

3. 你应该看到以下表名：
   ```
   users
   user_quota
   products
   orders
   usage_logs
   rate_limits
   ```

4. 如果看到了这 6 张表，说明数据库初始化成功！✅

---

## 步骤 9：验证产品数据

1. 在 SQL 编辑框中，输入以下命令：

   ```sql
   SELECT * FROM products;
   ```

2. 点击 **"Execute"** 按钮

3. 你应该看到 3 个产品：
   ```
   id: 1, name: 单次购买, quota_count: 1, price: 0.5, cost: 0.05
   id: 2, name: 10次优惠包, quota_count: 10, price: 4.0, cost: 0.5
   id: 3, name: 50次超值包, quota_count: 50, price: 15.0, cost: 2.5
   ```

4. 如果看到了这 3 个产品，说明数据初始化成功！✅

---

## 步骤 10：更新项目配置

### 方法 A：如果你能访问 wrangler 命令行（推荐）

1. 在 `bg-remover` 项目文件夹中，打开 `wrangler.toml` 文件

2. 找到 D1 数据库绑定部分：

   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "bg-remover-db"
   database_id = ""  # 在这里粘贴你的 Database ID
   ```

3. 将你在**步骤 4**中复制的 Database ID 粘贴到 `database_id = ""` 的引号中

4. 保存文件

### 方法 B：如果你无法修改 wrangler.toml

1. 告诉我你的 Database ID，我会帮你更新 `wrangler.toml` 文件

---

## 步骤 11：配置环境变量（可选但推荐）

如果你要使用 ClipDrop API 而不是 remove.bg：

1. 在 `bg-remover` 项目文件夹中，打开 `.env.local` 文件

2. 修改或添加以下内容：

   ```env
   BG_REMOVER_PROVIDER=clipdrop
   BG_REMOVER_API_KEY=your-clipdrop-api-key-here
   ```

3. 保存文件

**提示：** 如果还没有 ClipDrop API Key，可以先使用 remove.bg（已经测试通过）

---

## ✅ 完成检查

创建完成后，请确认以下项目：

- [ ] D1 数据库已创建（名称：`bg-remover-db`）
- [ ] 已获取并保存 Database ID
- [ ] SQL 脚本已执行成功
- [ ] 6 张表已创建（users, user_quota, products, orders, usage_logs, rate_limits）
- [ ] 产品数据已初始化（3 个套餐）
- [ ] `wrangler.toml` 中的 `database_id` 已更新
- [ ] （可选）环境变量已配置

如果所有项目都完成了，恭喜你！🎉 D1 数据库创建成功！

---

## 🚀 下一步

数据库创建完成后，你可以：

1. **测试 API**
   ```bash
   npm run dev
   ```
   访问 http://localhost:3000 测试应用

2. **部署到 Cloudflare Pages**
   ```bash
   npm run build
   wrangler pages deploy .vercel/output/static
   ```

3. **继续开发其他功能**
   - 配额系统
   - 订单系统
   - 支付集成
   - 前端页面

---

## 💡 常见问题

### Q1：我找不到 "Workers & Pages" 菜单
A: 在左侧导航栏中向下滚动，通常在底部附近

### Q2：点击 "Create database" 没有反应
A: 刷新页面，或者尝试使用不同的浏览器

### Q3：SQL 脚本执行失败
A: 确保你复制了完整的 SQL 脚本，包括所有的表创建语句

### Q4：我看不到 6 张表
A: 检查 SQL 脚本是否完全复制和粘贴，然后重新执行

### Q5：Database ID 在哪里？
A: 在数据库详情页面，通常在页面顶部或左侧，格式类似：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Q6：我忘记了 Database ID
A: 回到 Cloudflare Dashboard → Workers & Pages → D1，点击你的数据库名称，就可以看到

---

## 📞 需要帮助？

如果遇到问题：

1. **检查步骤：** 确保你按照所有步骤操作
2. **刷新页面：** 有时候刷新页面可以解决问题
3. **更换浏览器：** 尝试使用 Chrome、Firefox 或 Edge
4. **查看错误信息：** 仔细阅读 Cloudflare 显示的错误信息

---

## 🎓 相关资源

- Cloudflare D1 文档：https://developers.cloudflare.com/d1/
- Cloudflare Dashboard：https://dash.cloudflare.com
- SQL 教程：https://www.w3schools.com/sql/

---

**祝你创建成功！** 🚀

如果完成了，告诉我 Database ID，我会继续帮你完成后续的集成工作。
