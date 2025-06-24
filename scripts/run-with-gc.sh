#!/bin/bash

# ByteCraft 内存优化运行脚本
# 使用垃圾回收参数和内存限制来防止内存问题

echo "🚀 启动 ByteCraft - 内存优化模式"
echo "================================"

# 检查 Node.js 版本
NODE_VERSION=$(node -v)
echo "📦 Node.js 版本: $NODE_VERSION"

# 垃圾回收和内存优化参数
export NODE_OPTIONS="
  --max-old-space-size=2048
  --max-semi-space-size=256
  --expose-gc
  --optimize-for-size
  --memory-reducer
  --gc-interval=1000
  --max-old-space-size=2048
"

echo "🧹 垃圾回收参数已设置"
echo "💾 最大内存限制: 2GB"
echo "🔧 优化模式: 已启用"
echo ""

# 启动应用程序
echo "🎯 正在启动应用程序..."
exec npm run dev:new-ui 