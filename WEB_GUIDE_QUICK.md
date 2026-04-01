# 快速指南：在网页上创建 D1 数据库

**5 分钟快速开始**

---

## 🚀 快速步骤（3 分钟核心步骤）

### 1️⃣ 进入 D1 控制台（30 秒）

```
https://dash.cloudflare.com
↓
登录
↓
左侧菜单 → Workers & Pages → D1
↓
点击 "Create database"
```

### 2️⃣ 填写并创建（1 分钟）

```
数据库名称：bg-remover-db
位置：选择最近的（weur）
↓
点击 "Create database"
↓
等待创建完成
```

### 3️⃣ 获取 ID（30 秒）

```
点击数据库名 "bg-remover-db"
↓
找到并复制 "Database ID"
↓
保存到记事本
```

### 4️⃣ 执行 SQL 脚本（1 分钟）

```
打开项目文件夹中的 init-d1.sql
↓
全选复制（Ctrl/Cmd + A, Ctrl/Cmd + C）
↓
回到 Cloudflare D1 页面
↓
点击 "Console" 标签页
↓
粘贴 SQL 脚本（Ctrl/Cmd + V）
↓
点击 "Execute"
```

### 5️⃣ 验证（30 秒）

```
在 SQL 编辑框中输入：
SELECT name FROM sqlite_master WHERE type='table';
↓
点击 "Execute"
↓
看到 6 张表：users, user_quota, products, orders, usage_logs, rate_limits
✅ 成功！
```

---

## 🎯 链接汇总

直接访问这些链接快速开始：

| 步骤 | 链接 |
|------|------|
| 登录 Cloudflare | https://dash.cloudflare.com |
| D1 数据库管理 | https://dash.cloudflare.com/ -> Workers & Pages -> D1 |

---

## 📋 检查清单

完成后检查：

- [ ] 数据库名称：`bg-remover-db`
- [ ] Database ID 已保存
- [ ] SQL 脚本已执行
- [ ] 看到 6 张表
- [ ] 看到 3 个产品
- [ ] `wrangler.toml` 已更新

---

## 💡 提示

**保存 Database ID 的地方：**
- 记事本
- VS Code
- 手机备忘录
- 或直接告诉我

**粘贴 SQL 脚本时：**
- 确保全选
- 确保完全复制
- 确保完全粘贴

**验证时：**
- 先检查表数量
- 再检查产品数据
- 最后检查 Database ID

---

## 🔑 Database ID 长什么样？

格式：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

示例：`72eb7500-430f-21d1-be48-258cb32515c`

**注意：** 每个数据库的 ID 都不一样，你需要复制你自己创建的那个

---

## ⚠️ 常见错误

### 错误 1：点击 "Execute" 没反应
**解决：** 确保编辑框中有内容，点击按钮位置正确

### 错误 2：只看到部分表
**解决：** 重新复制完整的 SQL 脚本并执行

### 错误 3：没有找到 "Console" 标签页
**解决：** 刷新页面，重新进入数据库详情

### 错误 4：Database ID 复制不完整
**解决：** 仔细选择全部字符，不要遗漏

---

## ✅ 成功标志

当你看到这些时，说明成功了：

✅ 点击 "Create database" 后看到 "Successfully created"
✅ 执行 SQL 后看到 "Successfully executed 6 queries"
✅ 查询表时看到 6 张表
✅ 查询产品时看到 3 个套餐

---

## 🎉 完成后

**告诉我你的 Database ID，格式如下：**

```
Database ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

我会帮你：
- 更新 `wrangler.toml` 文件
- 完成数据库集成
- 实现配额系统
- 实现订单系统

---

**快速完成，5 分钟搞定！** 🚀
