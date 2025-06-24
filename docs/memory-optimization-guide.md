# ByteCraft 内存优化指南

## 🎯 问题描述

原始问题：Terminal 崩溃，出现 `EXC_CRASH (SIGABRT)` 错误，主要由以下原因导致：
- 内存堆损坏 (`free_list_checksum_botch`)
- 过度的 JSON 序列化/反序列化
- 定时器内存泄漏
- 无限循环的 JSON 解析
- 频繁的状态更新

## 🚀 优化措施

### 1. **React 组件优化**

#### MessageBubble 组件
- ✅ 使用 `React.memo` 包装组件
- ✅ 使用 `useMemo` 缓存计算结果
- ✅ 限制内容长度和行数
- ✅ 安全的 JSON 解析（防止无限循环）

```typescript
// 安全的JSON解析，限制递归深度
function safeJsonParse(content: string, maxDepth: number = 3): string {
  // 防止无限循环的安全解析
}
```

#### ToolAnimation 组件
- ✅ 定时器清理和节流
- ✅ 限制更新频率
- ✅ 内存安全检查

### 2. **内存管理系统**

#### MemoryManager 组件
- ✅ 自动清理过期消息
- ✅ 限制最大消息数量
- ✅ 定期垃圾回收
- ✅ 监控内存使用

```typescript
// 清理策略
const maxMessages = 1000;
const cleanupInterval = 300000; // 5分钟
```

### 3. **应用级优化**

#### 工具调用优化
- ✅ 替换 `Set` 为 `Map` 提供时间戳管理
- ✅ 定期清理工具调用历史
- ✅ 安全的 JSON 序列化（大小限制）

```typescript
// 安全的工具签名生成
function generateToolSignature(toolName: string, args: any): string {
  const argKeys = args && typeof args === 'object' ? Object.keys(args).join(',') : '';
  return `${toolName}-${argKeys}-${timestamp}`;
}
```

#### 状态管理优化
- ✅ 增加防抖时间（50ms）
- ✅ 错误边界保护
- ✅ 组件卸载清理

### 4. **系统级优化**

#### Node.js 垃圾回收
- ✅ 内存限制：2GB
- ✅ 暴露垃圾回收 API
- ✅ 优化垃圾回收间隔

```bash
export NODE_OPTIONS="
  --max-old-space-size=2048
  --expose-gc
  --optimize-for-size
  --memory-reducer
"
```

## 🛠️ 使用方法

### 普通启动
```bash
npm run dev:new-ui
```

### 内存优化启动
```bash
./scripts/run-with-gc.sh
```

### 手动清理
在应用中使用命令：
```
/clear    # 清理缓存和内存
/new      # 新建会话（自动清理）
```

## 📊 性能指标

### 内存使用
- **消息限制**: 1000条（自动清理）
- **工具历史**: 100条（5分钟过期）
- **单行长度**: 10,000字符（自动截断）
- **JSON大小**: 1024字节限制

### 更新频率
- **流式更新**: 50ms 防抖
- **进度条**: 400ms 间隔
- **动画**: 1200ms 间隔

### 垃圾回收
- **自动清理**: 每5分钟
- **强制GC**: 每10分钟
- **内存限制**: 2GB

## 🔧 故障排除

### 如果仍然崩溃
1. 降低消息限制 (`maxMessages: 500`)
2. 增加清理频率 (`cleanupInterval: 120000`)
3. 禁用动画和进度条
4. 使用更严格的内存限制

### 监控工具
```bash
# 查看内存使用
top -pid $(pgrep -f "node.*bytecraft")

# 监控垃圾回收
node --trace-gc your-app.js
```

## 🎁 新增功能

### 内存管理命令
- `/clear` - 手动清理内存
- `/memory` - 显示内存统计
- 自动清理提示

### 性能监控
- 实时消息计数
- 工具执行统计
- 内存使用警告

## 📈 预期效果

1. **稳定性**: 消除内存崩溃
2. **性能**: 减少50%的内存使用
3. **响应性**: 降低UI卡顿
4. **可靠性**: 长时间运行稳定

通过这些优化措施，您的 ByteCraft 应用将更稳定、更高效地运行，同时避免了原来的内存管理问题。 