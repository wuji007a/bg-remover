# BG Remover - 图像背景去除工具

一键去除图片背景的在线工具，基于 Next.js + remove.bg API。

## 功能特性

- ✅ 拖拽上传 / 点击上传
- ✅ 支持 JPG、PNG、WebP 格式
- ✅ 一键去除背景
- ✅ 原图与结果对比预览
- ✅ 棋盘格背景显示透明区域
- ✅ 一键下载 PNG 结果

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的 remove.bg API Key：

```
REMOVE_BG_API_KEY=your_api_key_here
```

> 获取 API Key: https://www.remove.bg/api

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 部署到 Cloudflare Pages

### 方法一：通过 Git 仓库

1. 将代码推送到 GitHub
2. 在 Cloudflare Pages 创建项目，连接仓库
3. 构建命令：`npm run build`
4. 输出目录：`.next`
5. 在环境变量中添加 `REMOVE_BG_API_KEY`

### 方法二：直接部署

```bash
npm install -g wrangler
wrangler pages deploy .next
```

## 项目结构

```
bg-remover/
├── app/
│   ├── page.tsx          # 首页（上传+预览）
│   ├── layout.tsx        # 布局
│   ├── globals.css       # 全局样式
│   └── api/
│       └── remove-bg/
│           └── route.ts  # API 路由
├── tailwind.config.js    # Tailwind 配置
├── next.config.js        # Next.js 配置
└── .env.example          # 环境变量示例
```

## API 说明

### POST /api/remove-bg

接收图片文件，返回去背景后的 PNG 图片。

**请求：**
- Content-Type: multipart/form-data
- Body: image (File)

**响应：**
- Content-Type: image/png

## License

MIT
