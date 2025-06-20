# AgentLoop 架构设计

## 概述

`AgentLoop` 是一个专门负责处理AI代理交互逻辑的核心类，它将原来在 `InteractiveChat` 中的AI相关功能进行了封装和抽象。

## 架构设计

### 类结构

```
InteractiveChat (UI层)
    ↓
AgentLoop (业务逻辑层)
    ↓
SimpleCheckpointSaver + ConversationHistoryManager (数据层)
    ↓
LangChain Agent + OpenAI Model (AI层)
```

### 职责分离

#### InteractiveChat 类
- **职责**: 用户界面和交互逻辑
- **功能**:
  - 命令行界面管理
  - 用户输入处理
  - 命令解析和执行
  - 用户友好的提示和反馈

#### AgentLoop 类
- **职责**: AI代理的核心业务逻辑
- **功能**:
  - 模型初始化和配置
  - 消息处理和AI响应
  - 会话管理（创建、加载、删除）
  - 对话历史管理
  - 工具集成

## 主要特性

### 1. 模块化设计
- 将AI交互逻辑从UI逻辑中分离
- 便于测试和维护
- 支持不同的UI实现（CLI、Web、API等）

### 2. 会话管理
- 自动会话创建和加载
- 智能会话匹配（支持短ID和标题模糊匹配）
- 会话持久化存储
- 会话元数据管理

### 3. 消息处理
- 流式响应处理
- 自动消息保存
- 对话历史维护
- 错误处理和恢复

### 4. 工具集成
- 天气查询工具
- 可扩展的工具系统
- 工具调用管理

## API 接口

### 核心方法

```typescript
class AgentLoop {
  // 初始化检查
  isReady(): boolean
  
  // 会话管理
  createNewSession(): Promise<string>
  loadSession(sessionId: string): Promise<void>
  loadSessionSmart(input: string): Promise<boolean>
  deleteSession(sessionId: string): Promise<boolean>
  clearCurrentSession(): Promise<void>
  
  // 消息处理
  processMessage(message: string): Promise<string>
  
  // 会话查询
  listSessions(): Promise<SessionMetadata[]>
  getCurrentSessionHistory(): Promise<ConversationMessage[]>
  sessionExists(sessionId: string): Promise<boolean>
  getSessionInfo(sessionId: string): Promise<SessionMetadata | null>
  
  // 状态管理
  getCurrentSessionId(): string | null
  destroy(): void
}
```

## 使用示例

### 基本使用

```typescript
import { AgentLoop } from './agent-loop.js';

const agentLoop = new AgentLoop();

// 创建新会话
const sessionId = await agentLoop.createNewSession();

// 处理消息
const response = await agentLoop.processMessage("你好，请介绍一下自己");

// 获取会话历史
const history = await agentLoop.getCurrentSessionHistory();
```

### 会话管理

```typescript
// 智能加载会话
const success = await agentLoop.loadSessionSmart("abc123"); // 支持短ID
const success2 = await agentLoop.loadSessionSmart("天气"); // 支持标题匹配

// 列出所有会话
const sessions = await agentLoop.listSessions();

// 删除会话
const deleted = await agentLoop.deleteSession("session-id");
```

## 优势

### 1. 可维护性
- 清晰的职责分离
- 模块化的代码结构
- 易于测试和调试

### 2. 可扩展性
- 支持多种UI实现
- 易于添加新功能
- 工具系统可扩展

### 3. 可重用性
- AgentLoop 可以在不同场景中重用
- 支持Web API、桌面应用等

### 4. 错误处理
- 统一的错误处理机制
- 优雅的降级策略
- 详细的错误信息

## 迁移指南

### 从旧版本迁移

1. **导入新类**:
   ```typescript
   import { AgentLoop } from './agent-loop.js';
   ```

2. **替换直接调用**:
   ```typescript
   // 旧方式
   this.model = new ChatOpenAI(...);
   this.agent = createReactAgent(...);
   
   // 新方式
   this.agentLoop = new AgentLoop();
   ```

3. **使用新的API**:
   ```typescript
   // 旧方式
   await this.handleMessage(message);
   
   // 新方式
   const response = await this.agentLoop.processMessage(message);
   ```

## 未来扩展

### 计划中的功能

1. **多模型支持**: 支持不同的AI模型提供商
2. **插件系统**: 可插拔的工具和功能模块
3. **性能优化**: 异步处理和缓存机制
4. **监控和日志**: 详细的性能监控和日志记录
5. **配置管理**: 动态配置和热重载

### 架构演进

- 支持微服务架构
- 分布式会话管理
- 实时协作功能
- 多模态交互支持 