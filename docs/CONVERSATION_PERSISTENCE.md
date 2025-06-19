# 对话持久化功能

ByteCraft现在支持JSONL格式的对话持久化，与Claude Code的格式完全兼容。

## 功能特性

### 🔄 会话管理
- **创建新会话**: 每次启动都可以创建新的对话会话
- **加载历史会话**: 通过会话ID恢复之前的对话
- **会话列表**: 查看所有保存的会话
- **会话删除**: 删除不需要的会话

### 💾 持久化存储
- **JSONL格式**: 兼容Claude Code的JSONL消息格式
- **自动保存**: 每条消息自动保存到文件
- **元数据管理**: 会话标题、创建时间、消息数量等信息
- **目录结构**: 每个会话独立的目录和文件

## 命令行使用

### 基本命令

```bash
# 启动交互式模式（自动创建新会话）
craft

# 启动并加载指定会话
craft -S <sessionId>

# 继续最近的对话
craft -c

# 列出所有会话
craft --list-sessions

# 删除指定会话
craft --delete-session <sessionId>
```

### 交互式命令

在交互模式下，支持以下命令：

```bash
/new                    # 创建新会话
/save <title>           # 保存当前会话并设置标题
/load <sessionId>       # 加载指定会话
/list                   # 列出所有会话
/delete <sessionId>     # 删除指定会话
/history                # 显示当前会话历史
/help                   # 显示帮助信息
```

## 文件结构

```
.bytecraft/
└── conversations/
    ├── <sessionId-1>/
    │   ├── metadata.json    # 会话元数据
    │   └── messages.jsonl   # 对话消息（JSONL格式）
    ├── <sessionId-2>/
    │   ├── metadata.json
    │   └── messages.jsonl
    └── ...
```

## JSONL消息格式

每条消息以JSONL格式保存，兼容Claude Code：

```json
{
  "parentUuid": null,
  "isSidechain": false,
  "userType": "external",
  "cwd": "/current/working/directory",
  "sessionId": "uuid-of-session",
  "version": "1.0.0",
  "type": "user",
  "message": {
    "role": "user",
    "content": "用户输入的内容"
  },
  "uuid": "unique-message-id",
  "timestamp": "2025-06-19T07:11:35.704Z"
}
```

## 会话元数据格式

```json
{
  "sessionId": "uuid-of-session",
  "title": "会话标题",
  "created": "2025-06-19T07:00:00.000Z",
  "updated": "2025-06-19T07:11:35.704Z",
  "messageCount": 10,
  "cwd": "/current/working/directory"
}
```

## 编程接口

### ConversationHistoryManager

```typescript
import { ConversationHistoryManager } from '@/utils/conversation-history.js';

const manager = new ConversationHistoryManager();

// 创建新会话
const sessionId = await manager.createSession('我的会话');

// 添加消息
const message = manager.createMessage('user', '你好');
await manager.addMessage(sessionId, message);

// 获取消息历史
const messages = await manager.getMessages(sessionId);

// 列出所有会话
const sessions = await manager.listSessions();
```

### SimpleCheckpointSaver

```typescript
import { SimpleCheckpointSaver } from '@/utils/simple-checkpoint-saver.js';

const saver = new SimpleCheckpointSaver();

// 创建会话并保存消息
const sessionId = await saver.createSession('测试会话');
await saver.saveMessage(sessionId, 'user', '用户消息');
await saver.saveMessage(sessionId, 'assistant', 'AI回复');
```

## 与Claude Code的兼容性

- ✅ **消息格式**: 完全兼容Claude Code的JSONL格式
- ✅ **字段结构**: parentUuid, sessionId, uuid, timestamp等字段
- ✅ **文件导入**: 可以直接导入Claude Code的对话文件
- ✅ **格式导出**: 生成的文件可以在Claude Code中使用

## 最佳实践

1. **定期备份**: 重要对话建议定期备份`.bytecraft/conversations`目录
2. **会话命名**: 使用有意义的会话标题便于管理
3. **清理会话**: 定期删除不需要的会话节省存储空间
4. **格式保持**: 不要手动修改JSONL文件，使用提供的API接口

## 故障排除

### 常见问题

1. **会话加载失败**
   - 检查sessionId是否正确
   - 确认`.bytecraft/conversations`目录权限

2. **消息保存失败**
   - 检查磁盘空间
   - 确认目录写入权限

3. **格式不兼容**
   - 使用提供的API而不是手动编辑文件
   - 检查JSON格式是否正确

### 调试模式

```bash
# 启用详细日志
DEBUG=bytecraft:* craft

# 查看会话目录
ls -la .bytecraft/conversations/

# 检查JSONL文件格式
cat .bytecraft/conversations/<sessionId>/messages.jsonl | jq .
```