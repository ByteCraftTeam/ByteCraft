# 🚀 ByteCraft 对话持久化快速开始

## 快速体验

### 1. 启动新会话
```bash
# 直接启动（自动创建新会话）
pnpm start

# 或指定初始消息
pnpm start "帮我写一个React组件"
```

### 2. 会话管理命令
```bash
# 继续最近的对话
pnpm start -c

# 加载指定会话
pnpm start -S <会话ID前8位>

# 列出所有会话
pnpm start --list-sessions

# 删除指定会话  
pnpm start --delete-session <完整会话ID>
```

### 3. 交互式命令

在对话中输入斜杠命令：

```bash
/new                    # 创建新会话
/save "项目讨论"        # 保存并命名当前会话
/load abc12345          # 加载会话（支持ID前缀）
/list                   # 列出所有会话
/delete abc12345        # 删除会话
/history                # 显示当前会话历史
/help                   # 显示帮助
```

## 文件位置

对话历史保存在：
```
.bytecraft/conversations/
├── <会话ID>/
│   ├── metadata.json    # 会话信息
│   └── messages.jsonl   # 对话记录
```

## Claude Code兼容性

✅ **完全兼容** - 可以直接使用Claude Code的对话文件

```bash
# 复制Claude Code的对话文件到ByteCraft
cp ~/.claude/projects/your-project/*.jsonl .bytecraft/conversations/new-session/messages.jsonl
```

## 示例工作流

### 场景1：日常编程助手
```bash
# 1. 启动新的编程会话
pnpm start

# 2. 在对话中
你: 帮我设计一个用户认证系统
AI: [详细回复...]

# 3. 保存会话
/save "用户认证系统设计"

# 4. 第二天继续
pnpm start -c
```

### 场景2：多项目管理
```bash
# 列出所有项目会话
pnpm start --list-sessions

# 输出示例：
# 1. 用户认证系统设计 (ID: abc12345...)
# 2. 前端组件开发 (ID: def67890...)  
# 3. 数据库优化讨论 (ID: ghi11111...)

# 切换到特定项目
pnpm start -S abc12345
```

### 场景3：团队协作
```bash
# 导出会话给团队成员
cp .bytecraft/conversations/abc12345/messages.jsonl ./team-discussion.jsonl

# 团队成员导入会话
mkdir -p .bytecraft/conversations/abc12345
cp team-discussion.jsonl .bytecraft/conversations/abc12345/messages.jsonl
```

## 高级用法

### 编程接口使用
```typescript
import { ConversationHistoryManager } from '@/utils/conversation-history.js';

const manager = new ConversationHistoryManager();

// 创建新会话
const sessionId = await manager.createSession('API设计讨论');

// 添加消息
await manager.addMessage(sessionId, 
  manager.createMessage('user', '设计一个RESTful API')
);

// 获取所有消息
const messages = await manager.getMessages(sessionId);
```

### 自定义存储位置
```typescript
const manager = new ConversationHistoryManager({
  historyDir: '/custom/path/conversations'
});
```

## 故障排除

### 常见问题

**Q: 会话加载失败**
```bash
# 检查会话是否存在
ls .bytecraft/conversations/

# 验证JSONL格式
cat .bytecraft/conversations/<sessionId>/messages.jsonl | jq .
```

**Q: 权限问题**
```bash
# 确保目录权限
chmod -R 755 .bytecraft/
```

**Q: 找不到会话**
```bash
# 列出所有会话查看正确ID
pnpm start --list-sessions
```

## 性能提示

- ✅ 会话自动按更新时间排序
- ✅ 支持大型会话（测试过10,000条消息）
- ✅ 增量加载，只读取需要的部分
- ✅ 异步操作，不阻塞UI

## 数据安全

- 🔒 本地存储，数据不上传
- 🔒 标准JSON格式，易于备份
- 🔒 支持版本控制（git ignore .bytecraft/）
- 🔒 与Claude Code完全兼容

## 下一步

1. **备份重要会话**: `cp -r .bytecraft/ backup/`
2. **配置版本控制**: 添加 `.bytecraft/` 到 `.gitignore`
3. **探索高级功能**: 查看 `docs/CONVERSATION_PERSISTENCE.md`
4. **自定义配置**: 参考 `docs/TECHNICAL_IMPLEMENTATION.md`

开始享受持久化的AI对话体验吧！ 🎉