# ByteCraft Prompt 系统

这是一个基于 aider 风格的 prompt 系统，为 ByteCraft AI 助手提供结构化的提示词管理。

## 📁 文件结构

```
src/prompts/
├── base-prompts.ts          # 基础提示词类
├── coding-prompts.ts        # 编程模式提示词
├── ask-prompts.ts           # 分析模式提示词  
├── tool-prompts.ts          # 工具使用说明
├── prompt-manager.ts        # 提示词管理器
├── agent-integration.ts     # Agent 集成组件
├── startup.ts               # 启动提示词
├── index.ts                 # 导出入口
├── examples.ts              # 使用示例
├── test.ts                  # 测试文件
└── README.md                # 本文档
```

## 🚀 快速开始

### 基本使用

```typescript
import { createPromptManager, TOOL_NAMES } from './prompts/index.js';

// 创建编程模式的管理器
const promptManager = createPromptManager('coding');

// 生成系统提示词
const systemPrompt = promptManager.formatSystemPrompt({
  language: '中文',
  availableTools: [TOOL_NAMES.FILE_MANAGER, TOOL_NAMES.COMMAND_EXEC],
  finalReminders: ['确保代码安全', '遵循最佳实践']
});

console.log(systemPrompt);
```

### Agent 集成

```typescript
import { createAgentPromptIntegration, presetConfigs } from './prompts/index.js';

// 创建开发者模式的集成
const integration = createAgentPromptIntegration({
  ...presetConfigs.developer,
  projectContext: {
    name: 'MyProject',
    type: 'Web App',
    language: 'TypeScript',
    framework: 'React'
  }
});

// 初始化系统消息
const systemMessage = await integration.initializeSystemMessage(availableTools);

// 格式化文件内容
const filesMessage = integration.formatFilesForChat([
  { path: 'src/app.ts', content: 'console.log("Hello");' }
]);

// 格式化工具执行结果
const result = integration.formatToolResult('file_manager_v2', true, '文件创建成功');
```

## 🛠️ 核心功能

### 1. 多模式支持

- **coding**: 完整的编程功能，可编辑文件、执行命令
- **ask**: 只读分析模式，专注于代码分析和建议
- **help**: 帮助模式，提供使用指导

```typescript
const codingManager = createPromptManager('coding');  // 编程模式
const askManager = createPromptManager('ask');        // 分析模式
const helpManager = createPromptManager('help');      // 帮助模式
```

### 2. 工具描述系统

为每个工具提供详细的使用说明：

```typescript
// 获取文件管理工具的详细说明
const fileHelp = promptManager.getToolDescription(TOOL_NAMES.FILE_MANAGER);

// 获取命令执行工具的说明
const cmdHelp = promptManager.getToolDescription(TOOL_NAMES.COMMAND_EXEC);
```

### 3. 文件内容格式化

智能格式化文件内容，支持语法高亮和只读标记：

```typescript
const files = [
  { path: 'src/app.ts', content: 'export default {}' },
  { path: 'README.md', content: '# My Project', isReadonly: true }
];

const formatted = promptManager.formatFilesContent(files);
```

### 4. 项目上下文

在提示词中包含项目信息：

```typescript
const systemPrompt = promptManager.formatSystemPrompt({
  projectContext: {
    name: 'ByteCraft',
    type: 'AI Assistant', 
    language: 'TypeScript',
    framework: 'Node.js'
  }
});
```

## 🎯 预设配置

系统提供三种预设配置：

### Developer（开发者）
```typescript
const config = presetConfigs.developer;
// 特点：完整编程功能，强调代码质量
```

### Analyst（分析师）  
```typescript
const config = presetConfigs.analyst;
// 特点：只读分析，专注架构评估
```

### Assistant（助手）
```typescript
const config = presetConfigs.assistant;
// 特点：帮助指导，提供使用说明
```

## 🔧 可用工具

| 工具名称 | 标识符 | 功能描述 |
|---------|--------|----------|
| 文件管理器 | `file_manager_v2` | 递归读取、批量创建、精确修改、删除 |
| 命令执行器 | `command_exec` | 执行前台和后台命令 |
| 代码执行器 | `code_executor` | 在沙箱中执行代码 |
| 网络搜索 | `web_search` | 搜索最新技术信息 |
| 天气查询 | `weather` | 获取天气信息 |

## 📝 工具使用格式

### 文件管理工具
```json
// 读取文件
{"action": "read", "path": "src/app.ts"}

// 写入文件
{"action": "write", "path": "src/app.ts", "content": "console.log('hello');"}

// 创建文件
{"action": "create", "path": "src/new.ts", "content": "export {}"}

// 删除文件
{"action": "delete", "path": "temp/old.js"}
```

### 命令执行工具
```json
// 前台执行
{"action": "foreground", "command": "npm test"}

// 后台执行
{"action": "background", "command": "npm run dev"}

// 列出进程
{"action": "list"}

// 终止进程
{"action": "kill", "processId": "12345"}
```

## 🧪 测试

运行测试以验证系统功能：

```typescript
import { runAllTests } from './prompts/test.js';

runAllTests();
```

测试包括：
- ✅ 基础功能测试
- ✅ 工具描述测试  
- ✅ 文件格式化测试
- ✅ 模式切换测试
- ✅ 集成功能测试
- ✅ 项目上下文测试

## 📚 示例

查看 `examples.ts` 文件获取更多使用示例：

```typescript
import { runAllExamples } from './prompts/examples.js';

runAllExamples();
```

## 🤝 集成到现有系统

### 1. 在 Agent 中使用

```typescript
import { createAgentPromptIntegration } from './prompts/index.js';

class Agent {
  private promptIntegration;
  
  constructor() {
    this.promptIntegration = createAgentPromptIntegration({
      mode: 'coding',
      language: '中文'
    });
  }
  
  async initialize() {
    const systemMessage = await this.promptIntegration.initializeSystemMessage(tools);
    // 设置为第一条消息
    this.messages = [{ role: 'system', content: systemMessage }];
  }
}
```

### 2. 处理工具调用

```typescript
// 检查权限
if (this.promptIntegration.canPerformAction('edit')) {
  // 执行文件编辑
}

// 格式化结果
const result = this.promptIntegration.formatToolResult(
  'file_manager_v2', 
  success, 
  result, 
  error
);
```

## 🎨 自定义

### 创建自定义提示词类

```typescript
import { BasePrompts } from './prompts/base-prompts.js';

class CustomPrompts extends BasePrompts {
  mainSystem = `你是一个专门的...`;
  
  systemReminder = `特殊规则：...`;
}
```

### 扩展工具描述

```typescript
import { ToolPrompts } from './prompts/tool-prompts.js';

// 添加新工具的描述
ToolPrompts.customToolPrompt = `## 自定义工具...`;
```

## 🔒 安全考虑

- 命令执行有安全限制，禁止危险操作
- 代码执行在沙箱环境中进行
- 文件访问限制在项目目录内
- 工具调用需要明确的权限检查

## 📈 性能优化

- 提示词模板预编译
- 工具描述缓存
- 智能的文件语言检测
- 支持大文件的分块处理

## 🔧 配置选项

```typescript
interface PromptOptions {
  language?: string;           // 回复语言
  platform?: string;          // 运行平台
  availableTools?: string[];   // 可用工具列表
  finalReminders?: string[];   // 最终提醒
  projectContext?: {           // 项目上下文
    name: string;
    type: string;
    language: string;
    framework?: string;
  };
}
```

## 🆕 版本历史

- **v1.0.0**: 初始版本，基于 aider 风格设计
  - 多模式支持
  - 工具描述系统
  - Agent 集成功能
  - 完整的测试套件

## 📞 支持

如有问题或建议，请：
1. 查看测试文件了解用法
2. 参考示例代码
3. 检查工具配置和权限
4. 提交 Issue 或 PR

---

**ByteCraft Prompt 系统** - 让 AI 助手更智能、更可靠、更易用！
