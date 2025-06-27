# 上下文管理测试套件

这个目录包含 ByteCraft 上下文管理系统的专项测试。

## 📁 文件说明

- `context-manager.test.ts` - 基础上下文管理综合测试
- `sensitive-info-filter.test.ts` - 敏感信息过滤专项测试  
- `truncation-strategies.test.ts` - 三种截断策略对比测试
- `dual-history-curation.test.ts` - 双重历史策划功能测试
- `run-all-tests.ts` - 测试运行器

## 🚀 快速运行

```bash
# 运行所有上下文测试
tsx tests/context/run-all-tests.ts

# 运行特定测试
tsx tests/context/context-manager.test.ts
tsx tests/context/sensitive-info-filter.test.ts
tsx tests/context/truncation-strategies.test.ts
tsx tests/context/dual-history-curation.test.ts
```

## 🧪 测试内容

### 基础功能测试
- ✅ 上下文优化流程
- ✅ 多维度限制检查 
- ✅ 敏感信息过滤
- ✅ 性能基准测试

### 截断策略测试
- 📊 Simple Sliding Window
- 📊 Smart Sliding Window  
- 📊 Importance Based
- 📊 策略性能对比

### 双重历史策划测试
- 🎭 错误响应过滤
- 🎭 中断检测
- 🎭 JSON验证
- 🎭 对话完整性保护

### 敏感信息过滤测试
- 🔒 基础模式过滤
- 🔒 复杂格式识别
- 🔒 误过滤检测
- 🔒 性能影响评估