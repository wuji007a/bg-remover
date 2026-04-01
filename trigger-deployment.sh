#!/bin/bash

# BG Remover - 触发重新部署脚本

echo "🚀 触发 Cloudflare Pages 重新部署..."
echo ""

cd /root/.openclaw/workspace/bg-remover

# 创建空提交触发部署
git commit --allow-empty -m "Trigger deployment: environment variables configured" && \
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 部署已触发！"
    echo ""
    echo "📦 查看部署状态:"
    echo "   https://dash.cloudflare.com/72eb7500430fb21d1be48258cb32515c/pages/view/bg-remover/deployments"
    echo ""
    echo "⏱️ 部署需要 2-3 分钟，请耐心等待..."
    echo ""
    echo "🌐 部署完成后访问:"
    echo "   https://bg-remover-6dp.pages.dev"
else
    echo ""
    echo "❌ 部署触发失败"
    exit 1
fi
