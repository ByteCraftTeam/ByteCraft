export class ToolPrompts {
  // 文件管理工具提示词
  static fileManagerPrompt = `
  FileManagerTool 调用指南

  **🎯 重要原则：直接执行，不要输出代码！**
  
  FileManagerTool 是一个文件管理工具，提供文件的增删改查、补丁应用等功能，支持单文件和批量操作。
  
  **使用策略：**
  - 理解需求后立即调用工具执行操作
  - 不要先输出代码内容供用户查看
  - 直接修改/创建文件，然后报告结果
  - 提供简洁的执行状态说明
  
  ## 单文件操作示例
  示例 1：查看项目根目录文件
  输入：{"input": "{"action":"list","path":"."}"}
  预期输出：{"success": true, "path": ".", "contents": [...]}
  
  示例 2：读取单个文件
  输入：{"input": "{"action":"read","path":"src/index.js"}"}
  预期输出：{"success": true, "content": "...", "size": 542}
  
  示例 3：写入单个文件
  输入：{"input": "{"action":"write","path":"README.md","content":"# 项目说明"}"}
  预期输出：{"success": true, "message": "文件写入成功"}
  
  ## 批量操作示例
  示例 4：批量读取文件
  输入：{"input": "{"action":"batch_read","paths":["src/index.js","README.md","package.json"]}"}
  预期输出：{"success": true, "results": [{"path":"src/index.js","content":"...","success":true}, ...]}
  
  示例 5：批量删除文件
  输入：{"input": "{"action":"batch_delete","paths":["temp1.txt","temp2.txt","temp3.txt"]}"}
  预期输出：{"success": true, "results": [{"path":"temp1.txt","success":true}, ...]}
  
  示例 6：批量写入文件
  输入：{"input": "{"action":"batch_write","files":[{"path":"file1.txt","content":"内容1"},{"path":"file2.txt","content":"内容2"}]}"}
  预期输出：{"success": true, "results": [{"path":"file1.txt","success":true}, ...]}
  
  示例 7：批量创建目录
  输入：{"input": "{"action":"batch_create_directory","paths":["dir1","dir2/subdir","dir3"]}"}
  预期输出：{"success": true, "results": [{"path":"dir1","success":true}, ...]}
  
  ## 操作参数映射表
  单文件操作：
  - list：必填 action, path；可选 recursive
  - read：必填 action, path；可选 encoding
  - write：必填 action, path, content；可选 encoding
  - delete：必填 action, path
  - rename：必填 action, path, new_path
  - create_directory：必填 action, path；可选 recursive
  - apply_patch：必填 action, patch
  
  批量操作：
  - batch_read：必填 action, paths；可选 encoding
  - batch_delete：必填 action, paths
  - batch_write：必填 action, files（数组，每个元素包含path和content）；可选 encoding
  - batch_create_directory：必填 action, paths；可选 recursive
  
  ## 安全约束
  补丁要求：必须以 "*** Begin Patch" 开头和 "*** End Patch" 结尾
  批量操作限制：单次批量操作最多支持100个文件
  
  ## 错误处理
  批量操作中，单个文件失败不会影响其他文件的处理，每个文件的结果会单独记录。
  请按照上述示例的推理逻辑和格式要求，生成符合 FileManagerTool 接口规范的调用参数。`;

  // 命令执行工具提示词  
  static commandExecPrompt = `
CommandExecTool 调用指南

  **🎯 重要原则：直接执行，不要输出代码！**
  
  CommandExecTool 是一个命令执行工具，支持前台和后台命令执行，以及进程管理功能。
  
  **使用策略：**
  - 理解需求后立即调用工具执行命令
  - 不要先输出命令供用户查看
  - 直接执行命令，然后报告结果
  - 提供简洁的执行状态说明
  
  ## 前台执行示例
  示例 1：执行简单命令
  输入：{"action":"foreground","command":"ls -la"}
  预期输出：{"success": true, "stdout": "total 1234\\ndrwxr-xr-x...", "stderr": "", "exitCode": 0}
  
  示例 2：执行带参数的命令
  输入：{"action":"foreground","command":"echo 'Hello World' && date"}
  预期输出：{"success": true, "stdout": "Hello World\\nMon Jan 1 12:00:00 UTC 2024", "stderr": "", "exitCode": 0}
  
  ## 后台执行示例
  示例 3：后台启动进程
  输入：{"action":"background","command":"sleep 60 && echo 'Background task completed'"}
  预期输出：{"success": true, "processId": "1704067200000", "message": "命令已在后台启动"}
  
  示例 4：后台启动服务
  输入：{"action":"background","command":"python -m http.server 8080"}
  预期输出：{"success": true, "processId": "1704067200001", "message": "命令已在后台启动"}
  
  ## 进程管理示例
  示例 5：列出后台进程
  输入：{"action":"list"}
  预期输出：{"success": true, "processes": [{"processId": "1704067200000", "pid": 12345, "command": "sleep 60"}]}
  
  示例 6：终止后台进程
  输入：{"action":"kill","processId":"1704067200000"}
  预期输出：{"success": true, "message": "成功终止进程 1704067200000"}
  
  ## 操作参数映射表
  前台执行：
  - action：必填，"foreground"
  - command：必填，要执行的命令
  
  后台执行：
  - action：必填，"background"
  - command：必填，要在后台执行的命令
  
  进程管理：
  - action：必填，"list" 或 "kill"
  - processId：当action为"kill"时必填，进程ID
  
  ## 安全约束
  - 命令长度限制：单次执行命令不超过10KB
  - 执行时间控制：前台命令默认30秒超时
  - 危险命令拦截：禁止系统关机、重启等危险命令
  - 后台进程限制：最多同时运行10个后台进程
  
  ## 错误处理
  执行失败时，会返回详细的错误信息，包括错误类型、错误消息和执行时间。
  请按照上述示例的推理逻辑和格式要求，生成符合 CommandExecTool 接口规范的调用参数。`;

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
