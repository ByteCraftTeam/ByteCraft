export class ToolPrompts {
  // 文件管理工具提示词
  static fileManagerPrompt = `
## 文件管理工具使用指南

### 基本操作
\`\`\`json
// 读取文件
{"action": "read", "path": "src/components/Button.tsx"}

// 写入文件（会覆盖原内容）
{"action": "write", "path": "src/utils/helper.ts", "content": "export const helper = () => {}"}

// 创建新文件
{"action": "create", "path": "src/components/NewComponent.tsx", "content": "import React from 'react';\\n\\nexport const NewComponent = () => {\\n  return <div>New Component</div>;\\n};"}

// 删除文件
{"action": "delete", "path": "temp/old-file.js"}

// 读取目录结构
{"action": "list", "path": "src/components"}

// 检查文件是否存在
{"action": "exists", "path": "src/config.ts"}
\`\`\`

### 注意事项
- 使用相对于项目根目录的路径
- 写入前建议先读取现有内容
- 创建文件时确保目录存在
- JSON 字符串中的换行符使用 \\n
- 大文件操作时注意性能`;

  // 命令执行工具提示词  
  static commandExecPrompt = `
## 命令执行工具使用指南

### 前台执行（等待结果）
\`\`\`json
{"action": "foreground", "command": "npm test"}
{"action": "foreground", "command": "ls -la src/"}
{"action": "foreground", "command": "git status"}
{"action": "foreground", "command": "node --version"}
\`\`\`

### 后台执行（不等待结果）
\`\`\`json
{"action": "background", "command": "npm run dev"}
{"action": "background", "command": "python server.py"}
{"action": "background", "command": "npm run watch"}
\`\`\`

### 进程管理
\`\`\`json
// 列出后台进程
{"action": "list"}

// 终止后台进程
{"action": "kill", "processId": "1234567890"}

// 获取进程状态
{"action": "status", "processId": "1234567890"}
\`\`\`

### 安全限制
- 禁止系统关机/重启命令
- 禁止危险的删除操作
- 命令长度限制 10KB
- 后台进程数量限制 10 个
- 禁止访问敏感系统目录`;

  // 代码执行器工具提示词
  static codeExecutorPrompt = `
## 代码执行器使用指南

### 支持的语言
\`\`\`json
// JavaScript/Node.js
{"language": "javascript", "code": "console.log('Hello World');"}

// TypeScript 
{"language": "typescript", "code": "const greeting: string = 'Hello';\\nconsole.log(greeting);"}

// Python
{"language": "python", "code": "print('Hello World')"}

// Shell 脚本
{"language": "shell", "code": "echo 'Hello World'"}
\`\`\`

### 执行选项
\`\`\`json
// 设置工作目录
{"language": "javascript", "code": "console.log(process.cwd());", "workingDir": "./src"}

// 设置环境变量
{"language": "javascript", "code": "console.log(process.env.NODE_ENV);", "env": {"NODE_ENV": "development"}}

// 设置超时时间（毫秒）
{"language": "python", "code": "import time; time.sleep(2); print('done')", "timeout": 5000}
\`\`\`

### 安全考虑
- 代码在沙箱环境中执行
- 网络访问受限
- 文件系统访问限制在项目目录
- 执行时间限制 30 秒
- 内存使用限制`;

  // 网络搜索工具提示词
  static webSearchPrompt = `
## 网络搜索工具使用指南

### 基本搜索
\`\`\`json
// 简单关键词搜索
{"query": "TypeScript React hooks 最佳实践"}

// 技术问题搜索
{"query": "Node.js memory leak debugging"}

// 具体错误搜索
{"query": "TypeError Cannot read property of undefined"}
\`\`\`

### 高级搜索
\`\`\`json
// 限制搜索范围
{"query": "React performance optimization", "domain": "react.dev"}

// 指定时间范围
{"query": "Next.js 14 新特性", "timeRange": "recent"}

// 搜索特定类型
{"query": "JavaScript async await tutorial", "type": "documentation"}
\`\`\`

### 搜索技巧
- 使用具体的技术术语
- 包含版本号信息
- 添加 "tutorial" 或 "example" 获取示例
- 使用 "vs" 比较不同方案
- 包含错误信息的关键部分`;

  // 天气工具提示词（示例）
  static weatherPrompt = `
## 天气查询工具使用指南

### 基本查询
\`\`\`json
// 查询指定城市天气
{"city": "北京"}
{"city": "Shanghai"}
{"city": "New York"}

// 查询当前位置天气
{"useCurrentLocation": true}
\`\`\`

### 详细信息
- 返回当前温度、湿度、风速
- 提供未来几天的天气预报
- 包含天气状况描述
- 支持中英文城市名称`;
  /**
   * 获取工具的详细使用说明
   */
  static getToolPrompt(toolName: string): string {
    switch (toolName) {
      case 'file_manager':
      case 'fileManager':
        return this.fileManagerPrompt;
      case 'command_exec':
      case 'commandExec':
        return this.commandExecPrompt;
      case 'code_executor':
      case 'codeExecutor':
        return this.codeExecutorPrompt;
      case 'web_search':
      case 'webSearch':
        return this.webSearchPrompt;
      case 'weather':
        return this.weatherPrompt;
      default:
        return `工具 "${toolName}" 的使用说明暂不可用。`;
    }
  }

  /**
   * 获取所有可用工具的简要描述
   */
  static getAllToolsDescription(): string {
    return `
可用工具列表：

🗂️  **file_manager** - 文件管理
   读取、写入、创建、删除文件和目录

⚡ **command_exec** - 命令执行  
   执行前台和后台命令，管理进程

🔧 **code_executor** - 代码执行
   在沙箱环境中执行多种语言的代码

🌐 **web_search** - 网络搜索
   搜索最新的技术信息和解决方案

🌤️  **weather** - 天气查询
   获取实时天气信息和预报

使用时请按照 JSON 格式提供参数，确保参数完整正确。
`;
  }
}
