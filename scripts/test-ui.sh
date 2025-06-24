#!/bin/bash

echo "🧪 测试修复后的UI..."
echo "================================"

# 清理之前的进程
pkill -f "npx tsx src/new_ui/index.tsx" 2>/dev/null || true

echo "🚀 启动优化后的UI..."
echo "💡 现在应该能看到正常的AI回复，而不是'回复完成'"
echo ""

# 启动应用
npx tsx src/new_ui/index.tsx 