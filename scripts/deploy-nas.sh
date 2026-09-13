#!/usr/bin/env bash
set -e

echo "🚀 [1/3] 本地 Mac 秒级生产编译 (Next.js Standalone)..."
npm run build

echo "📦 [2/3] 同步编译产物与配置至 NAS..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='/node_modules' \
  --exclude='data' \
  --exclude='.env*.local' \
  ./ nas:/share/CACHEDEV1_DATA/Container/ai-radar/

echo "⚡ [3/3] NAS 容器极速热重载 (已跳过 NAS 端慢速重编译)..."
ssh nas "cd /share/CACHEDEV1_DATA/Container/ai-radar && export PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/bin:\$PATH && docker compose up -d --build ai-radar && (docker network connect ai-radar_default antigravity-manager 2>/dev/null || true)"

echo "✅ 部署完成！全程耗时仅数秒。"
