# Cloudflare 部署配置指南

## ✅ 已完成的配置

1. **环境变量已设置**
   ```bash
   CLOUDFLARE_API_TOKEN=cfat_xx5VI9sRe2eqVLOxNka7T0wwRgetAUppg8TWYIUl59e87c55
   CLOUDFLARE_ACCOUNT_ID=72eb7500430fb21d1be48258cb32515c
   ```

2. **wrangler.toml 已配置**
   - Account ID: 72eb7500430fb21d1be48258cb32515c
   - Project name: bg-remover
   - D1 数据库绑定已设置

3. **认证已验证**
   - 账号: Wuji007a@gmail.com
   - 状态: ✅ 已认证

---

## 📋 下一步部署步骤

### 选项 1: 通过 Cloudflare Dashboard 部署（推荐）

1. **访问 Cloudflare Pages**
   ```
   https://dash.cloudflare.com/72eb7500430fb21d1be48258cb32515c/pages
   ```

2. **连接到 GitHub**
   - 点击 "Create a project"
   - 选择 "Connect to Git"
   - 选择你的 GitHub 仓库 (wuji007a/bg-remover)

3. **配置构建设置**
   ```
   Framework preset: Next.js
   Build command: npm run build
   Build output directory: .vercel/output/static
   ```

4. **设置环境变量** (在 Settings → Environment variables)
   ```
   BG_REMOVER_PROVIDER=remove.bg
   BG_REMOVER_API_KEY=<你的remove.bg key>
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=835493865520-or4cr6o94eb0uock65d52oto4g943d2e.apps.googleusercontent.com
   ```

5. **部署**
   - 点击 "Save and Deploy"
   - Cloudflare 会自动构建和部署

---

### 选项 2: 使用 Wrangler 手动部署

如果token有足够权限，可以使用以下命令：

```bash
# 1. 构建项目
cd /root/.openclaw/workspace/bg-remover
npm run build

# 2. 部署到 Cloudflare Pages
wrangler pages deploy .vercel/output/static --project-name=bg-remover
```

---

## 🔧 需要完成的配置

### 1. 创建 D1 数据库

```bash
# 创建数据库
wrangler d1 create bg-remover-db

# 记录输出的 database_id，然后更新 wrangler.toml:
# database_id = "你的database_id"

# 初始化数据库（如果需要）
wrangler d1 execute bg-remover-db --file=./init-d1.sql
```

### 2. 获取 Remove.bg API Key

1. 访问: https://www.remove.bg/api

2. 注册账号

3. 获取免费 API key (每月 50 张免费额度)

4. 在 Cloudflare Pages 环境变量中设置:
   ```
   BG_REMOVER_API_KEY=你的key
   ```

---

## 🚀 快速部署检查清单

- [ ] GitHub 仓库已创建
- [ ] 代码已推送到 GitHub
- [ ] Cloudflare Pages 项目已创建
- [ ] 构建设置已配置 (Next.js)
- [ ] 环境变量已设置
- [ ] Remove.bg API key 已配置
- [ ] D1 数据库已创建 (可选)
- [ ] 首次部署成功

---

## 📊 当前项目状态

- **项目路径**: `/root/.openclaw/workspace/bg-remover`
- **框架**: Next.js 14 + TypeScript
- **部署平台**: Cloudflare Pages
- **构建输出**: `.vercel/output/static`
- **认证状态**: ✅ 已认证

---

## 🔄 常用命令

```bash
# 查看登录状态
wrangler whoami

# 列出 Pages 项目
wrangler pages project list

# 列出 D1 数据库
wrangler d1 list

# 查看部署日志
wrangler pages deployment tail --project-name=bg-remover

# 本地开发
cd /root/.openclaw/workspace/bg-remover
npm run dev
```

---

**下一步**: 建议使用选项 1 (Dashboard 部署)，更简单直接！
