# ByteCraft CLI
![ByteCraft CLI ](./docs/images/CLI.png)
一个基于 LangChain 的交互式代码助手 CLI 工具，支持流式输出、工具调用和智能对话。

## 项目特性

- **智能对话** - 基于多种AI模型的智能代码助手
- **流式输出** - 实时流式响应，提供更好的交互体验
- **丰富工具** - 支持文件管理、代码执行、搜索等多种工具调用
- **配置管理** - 灵活的 YAML 配置文件系统
- **类型安全** - 完整的 TypeScript 类型定义
- **现代UI** - 基于 Ink.js 的终端 UI 界面
- **会话管理** - 支持会话保存、加载和继续对话
- **性能监控** - 内置性能监控和缓存统计
- **智能搜索** - 支持代码搜索和文件内容搜索

## 项目结构

```
ByteCraft/
├── src/                          # 源代码目录
│   ├── cli.ts                    # CLI 入口文件
│   ├── index.ts                  # 应用入口文件
│   ├── config/                   # 配置管理模块
│   │   └── config.ts            # 配置文件读取和管理
│   ├── types/                    # 类型定义模块
│   │   └── index.ts             # 集中类型定义
│   ├── utils/                    # 工具和工具函数
│   │   ├── agent-loop.ts        # 核心 Agent 循环实现
│   │   ├── interactive-chat.ts  # 交互式聊天实现
│   │   ├── conversation-history.ts # 对话历史管理
│   │   ├── performance-monitor.ts # 性能监控
│   │   ├── simple-checkpoint-saver.ts # 会话保存
│   │   ├── warning-filter.ts    # 警告过滤器
│   │   ├── tools/               # 工具集合
│   │   │   ├── index.ts         # 工具导出
│   │   │   ├── file-manager-tool.ts # 文件管理工具
│   │   │   ├── command-exec.ts  # 命令执行工具
│   │   │   ├── code-executor.ts # 代码执行工具
│   │   │   ├── grep-search.ts   # 搜索工具
│   │   │   └── patch-parser.ts  # 补丁解析工具
│   │   ├── session/             # 会话管理
│   │   ├── logger/              # 日志工具
│   │   └── art/                 # ASCII 艺术
│   ├── ui/                      # 用户界面模块
│   │   ├── app.tsx              # 主应用组件
│   │   ├── index.tsx            # UI 入口文件
│   │   └── components/          # UI 组件
│   │       ├── message-bubble.tsx # 消息气泡组件
│   │       ├── input-box.tsx    # 输入框组件
│   │       ├── chat-interface.tsx # 聊天界面
│   │       ├── welcome-screen.tsx # 欢迎界面
│   │       ├── tool-call-display.tsx # 工具调用显示
│   │       ├── status-message.tsx # 状态消息
│   │       ├── status-bar.tsx   # 状态栏
│   │       ├── memory-manager.tsx # 内存管理
│   │       ├── error-boundary.tsx # 错误边界
│   │       ├── loading-spinner.tsx # 加载动画
│   │       ├── typewriter-text.tsx # 打字机效果
│   │       ├── safe-text.tsx    # 安全文本显示
│   │       ├── tool-history.tsx # 工具历史
│   │       ├── tool-animation.tsx # 工具动画
│   │       └── tool-status-manager.tsx # 工具状态管理
│   └── prompts/                 # 提示词模板
├── dist/                        # 编译输出目录
├── docs/                        # 文档目录
├── tests/                       # 测试目录
├── config.yaml                  # 主配置文件
├── config.yaml.example          # 配置文件示例
├── tsconfig.json               # TypeScript 配置
├── package.json                # 项目依赖和脚本
└── README.md                   # 项目文档
```

## 模块说明

### `src/cli.ts` - CLI 入口
- **功能**: 命令行界面入口，处理各种命令行参数
- **特性**:
  - 支持交互式模式 (`--interactive`)
  - 支持继续对话 (`--continue`)
  - 支持指定会话 (`--session`)
  - 支持单次对话 (`--prompt`)
  - 支持模型选择 (`--model`)
  - 会话管理功能 (列出、删除会话)

### `src/config/` - 配置管理
- **功能**: 管理应用配置，支持 YAML 配置文件
- **主要文件**: `config.ts`
- **特性**:
  - 自动读取 `config.yaml` 文件
  - 支持多个模型配置
  - 类型安全的配置接口
  - 默认配置回退机制
  - 配置验证和错误处理

### `src/types/` - 类型定义
- **功能**: 集中管理所有 TypeScript 类型定义
- **主要文件**: `index.ts`
- **包含类型**:
  - 配置相关类型 (`AppConfig`, `ModelConfig`)
  - AI/LLM 相关类型 (`ChatMessage`, `ChatResponse`)
  - UI 相关类型 (`Message`, `AppState`)
  - 工具相关类型 (`ToolCall`, `ToolResult`)

### `src/utils/agent-loop.ts` - 核心 Agent
- **功能**: 核心 AI 助手实现
- **特性**:
  - 基于 LangChain 的智能对话
  - 流式输出支持
  - 工具调用集成
  - 会话管理
  - 错误处理和重试机制

### `src/utils/tools/` - 工具集合
- **功能**: 各种功能工具的实现
- **主要工具**:
  - **文件管理工具**: 文件读写、目录操作
  - **命令执行工具**: 执行系统命令
  - **代码执行工具**: 执行代码片段
  - **搜索工具**: 文件内容搜索
  - **补丁解析工具**: 解析和应用补丁
- **扩展性**: 易于添加新工具

### `src/ui/` - 用户界面
- **功能**: 基于 Ink.js 的终端 UI
- **主要组件**:
  - `app.tsx`: 主应用组件，管理整体状态
  - `message-bubble.tsx`: 消息显示组件
  - `input-box.tsx`: 输入框组件
  - `tool-call-display.tsx`: 工具调用显示
  - `welcome-screen.tsx`: 欢迎界面
  - `status-bar.tsx`: 状态栏显示

## 配置说明

### 配置文件 (`config.yaml`)

```yaml
# ByteCraft AI 助手配置
models:
  deepseek-v3:
    name: "deepseek-v3-250324"
    baseURL: "https://ark.cn-beijing.volces.com/api/v3"
    apiKey: "your-api-key-here"
    streaming: true
  deepseek-r1:
    name: "deepseek-r1"
    baseURL: "https://api.deepseek.com/v1"
    apiKey: "your-api-key-here"
    streaming: true

# 默认模型
defaultModel: "deepseek-v3"

# 工具配置
tools:
  fileManager:
    enabled: true
    maxFileSize: 1048576  # 1MB
  commandExec:
    enabled: true
    allowedCommands: ["ls", "cat", "grep", "find"]
```

### 配置项说明

- `models`: 支持的AI模型配置
  - `name`: 模型名称
  - `baseURL`: API 基础 URL
  - `apiKey`: API 密钥
  - `streaming`: 是否启用流式输出
- `defaultModel`: 默认使用的模型
- `tools`: 工具配置
  - `fileManager`: 文件管理工具配置
  - `commandExec`: 命令执行工具配置

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置 API

复制配置文件示例并填入您的 API 密钥：

```bash
cp config.yaml.example config.yaml
# 编辑 config.yaml，填入您的 API 密钥
```

### 3. 构建项目

```bash
pnpm build
```

### 4. 链接到全局

```bash
pnpm run link
```

### 5. 运行应用

```bash
# 交互式模式
craft

# 继续上次对话
craft -c

# 指定会话
craft -S <session-id>

# 单次对话
craft -p "帮我写一个React组件"

# 指定模型
craft -m deepseek-r1

# 查看帮助
craft --help
```

## 开发指南

### 添加新工具

1. 在 `src/utils/tools/` 目录下创建新工具文件
2. 继承 `Tool` 基类并实现 `_call` 方法
3. 在 `tools/index.ts` 中导出新工具
4. 在 `agent-loop.ts` 中添加到工具列表

示例：

```typescript
import { Tool } from '@langchain/core/tools';

export class MyTool extends Tool {
  name = 'my_tool';
  description = '工具描述';

  protected async _call(input: string): Promise<string> {
    // 工具实现逻辑
    return '工具结果';
  }
}
```

### 使用类型定义

```typescript
import type { Message, AppState } from '@/types/index.js';

// 使用类型
const message: Message = {
  id: 'msg-1',
  type: 'user',
  content: 'Hello',
  timestamp: new Date()
};
```

### 路径映射

项目配置了 TypeScript 路径映射，支持使用 `@` 符号简化导入：

```typescript
// 推荐使用
import { getConfig } from '@/config/config.js';
import type { AppConfig } from '@/types/index.js';

// 而不是相对路径
import { getConfig } from '../../config/config.js';
```

## 脚本说明

- `pnpm start`: 启动应用
- `pnpm dev`: 开发模式（支持热重载）
- `pnpm build`: 构建项目
- `pnpm run link`: 构建并链接到全局
- `pnpm run unlink`: 取消全局链接
- `pnpm performance-report`: 显示性能监控报告
- `pnpm cache-stats`: 显示缓存统计信息
- `pnpm clear-cache`: 清除缓存

## 使用示例

### 基本对话

```bash
craft
# 启动交互式对话模式
```

### 代码生成

```bash
craft -p "帮我写一个React函数组件，实现一个计数器"
```

### 文件操作

```bash
craft -p "创建一个新的TypeScript文件，包含一个用户接口定义"
```

### 继续对话

```bash
craft -c
# 继续上次的对话
```

### 会话管理

```bash
# 列出所有会话
craft --list-sessions

# 删除指定会话
craft --delete-session <session-id>

# 加载指定会话
craft -S <session-id>
```

## 协作指南

### 代码规范

1. **类型安全**: 所有代码必须使用 TypeScript
2. **路径映射**: 使用 `@` 符号进行导入
3. **错误处理**: 完善的错误处理机制
4. **文档注释**: 重要函数和类需要 JSDoc 注释

### 提交规范

- 使用清晰的提交信息
- 每个功能一个分支
- 提交前运行测试

### 开发流程

1. Fork 项目
2. 创建功能分支
3. 实现功能
4. 添加测试
5. 提交 Pull Request

## 技术栈

- **语言**: TypeScript
- **运行时**: Node.js
- **AI 框架**: LangChain
- **UI 框架**: Ink.js + React
- **配置管理**: js-yaml
- **包管理**: pnpm
- **命令行**: meow
- **工具调用**: LangChain Tools

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 贡献

欢迎贡献代码！请查看 [贡献指南](CONTRIBUTING.md) 了解详情。

## 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件
- 参与讨论

---

**ByteCraft CLI** - 让代码开发更智能、更高效！
