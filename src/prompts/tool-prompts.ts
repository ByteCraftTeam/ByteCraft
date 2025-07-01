export class ToolPrompts {
  // 文件管理工具提示词
  static fileManagerPrompt = `
  FileManagerTool 调用指南

  **🎯 重要原则：直接执行，不要输出代码！**

  这是一个专注于核心文件操作的精简文件管理工具，支持：
  1. 📁 递归读取文件夹所有内容（支持智能忽略）
  2. 📄 读取单个文件内容
  3. 🔧 批量创建文件夹和文件 
  4. 🗑️ 删除文件和目录
  5. ✍️ 写入和创建单个文件
  
  ## 核心功能

  ### 1. 读取文件夹所有内容
  操作：read_folder
  参数：path (必填), recursive (可选，默认true), ignore_patterns (可选，自定义忽略模式)
  
  示例：
  {"input": "{"action": "read_folder", "path": "src", "recursive": true}"}
  {"input": "{"action": "read_folder", "path": ".", "recursive": true, "ignore_patterns": ["*.backup", "old-*"]}"}
  
  返回：完整的文件夹结构，包括所有文件内容
  
  默认忽略的文件和文件夹包括：
  - node_modules, .git, .next, .nuxt, dist, build, coverage 等构建和依赖目录
  - .DS_Store, Thumbs.db, *.log 等系统和日志文件
  - .env, .env.local 等环境配置文件
  - .vscode, .idea 等编辑器配置目录
  - __pycache__, target, bin, obj 等语言特定的构建目录

  ### 2. 读取单个文件内容（支持行号显示）
  操作：read_file
  参数：path (必填), show_line_numbers (可选，默认true)
  
  示例：
  {"input": "{"action": "read_file", "path": "src/index.js"}"}
  {"input": "{"action": "read_file", "path": "src/index.js", "show_line_numbers": false}"}
  
  返回：单个文件的详细信息和内容，包含带行号的内容版本

  ### 3. 批量创建文件夹
  操作：batch_create_folders
  参数：folders (必填，字符串数组)
  
  示例：
  {"input": "{"action": "batch_create_folders", "folders": ["src/components", "src/utils", "tests"]}"}

  ### 4. 批量创建文件并写入内容
  操作：batch_create_files
  参数：files (必填，对象数组，包含path和content)
  
  示例：
  {"input": "{"action": "batch_create_files", "files": [
    {"path": "src/index.js", "content": "console.log('Hello');"},
    {"path": "README.md", "content": "# 项目说明"}
  ]}"}

  ### 5. 创建单个文件
  操作：create_file
  参数：path (必填), content (可选，默认为空字符串), overwrite (可选，默认false)
  
  示例：
  {"input": "{"action": "create_file", "path": "src/new-file.js", "content": "console.log('Hello World');"}"}
  {"input": "{"action": "create_file", "path": "src/existing-file.js", "content": "updated content", "overwrite": true}"}
  
  返回：文件创建结果，包括文件信息

  ### 6. 写入文件内容
  操作：write_file
  参数：path (必填), content (必填), append (可选，默认false - 覆盖写入)
  
  示例：
  {"input": "{"action": "write_file", "path": "src/config.js", "content": "export const config = {};"}"}
  {"input": "{"action": "write_file", "path": "logs/app.log", "content": "New log entry\\n", "append": true}"}
  
  返回：写入操作结果，包括文件大小变化

  
  ### 8. 删除文件或目录
  操作：delete_item
  参数：path (必填), recursive (可选，删除目录时是否递归删除，默认false)
  
  示例：
  {"input": "{"action": "delete_item", "path": "src/temp.js"}"}
  {"input": "{"action": "delete_item", "path": "temp_folder", "recursive": true}"}
  
  返回：删除操作的详细结果

  ### 9. 批量删除文件或目录
  操作：batch_delete
  参数：items (必填，对象数组，包含path和可选的recursive)
  
  示例：
  {"input": "{"action": "batch_delete", "items": [
    {"path": "src/temp1.js"},
    {"path": "temp_folder", "recursive": true},
    {"path": "src/temp2.js"}
  ]}"}

  ## 输入格式
  支持多种输入格式，工具会自动识别并处理：
  
  格式1（推荐）：直接JSON字符串
  格式2（自动处理）：嵌套对象包含input字段
  
  ⚠️ **重要注意事项**：
  - 在传递包含换行符的文件内容时，请使用 \\n 而不是实际的换行符
  - 其他控制字符也需要转义：\\t (Tab), \\r (回车), \\b (退格) 等
  - 工具会自动尝试转义常见的控制字符，但建议主动转义以避免JSON解析错误
  - 如果遇到JSON解析错误，检查内容中是否包含未转义的控制字符
  - 工具会自动检测并处理嵌套的输入格式
  
  ## 安全约束
  补丁要求：必须以 "*** Begin Patch" 开头和 "*** End Patch" 结尾
  批量操作限制：单次批量操作最多支持100个文件
  
  ## 错误处理
  批量操作中，单个文件失败不会影响其他文件的处理，每个文件的结果会单独记录。
  错误示例
- 路径不存在
  输入：{"input": "{\"action\": \"read_file\", \"path\": \"notfound.js\"}"}
  预期输出：{"success": false, "error": "文件不存在"}

- 权限不足
  输入：{"input": "{\"action\": \"delete_item\", \"path\": \"/system/important.txt\"}"}
  预期输出：{"success": false, "error": "权限不足"}
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
  
 支持Windows/Unix双平台的安全命令执行、目录管理、依赖安装、测试运行和后台服务管理。
  进行命令执行时，请注意一下当前目录，在当前目仍要cd这个目录的操作。
  智能错误提示：显示当前目录、可用目录列表，避免重复的目录切换操作。
  
  🔄 **自动目录重置**: 每次工具调用完成后（无论成功还是失败），工作目录会自动重置到项目根目录。返回结果中会包含重置信息。确保每次调用都从项目根目录开始，无需手动执行cd命令。
  
  ## 🚀 核心功能

  ### 1. 前台命令执行
  立即执行命令并等待结果，适用于快速操作。
  **支持两种格式**：
  - 单独命令：直接执行命令
  - 复合命令：支持 "cd directory && command" 格式，自动解析并处理目录切换
  
  示例：
  {"input": "{"action": "foreground", "command": "ls -la"}"}                   // 单独命令
  {"input": "{"action": "foreground", "command": "npm --version"}"}            // 单独命令
  {"input": "{"action": "foreground", "command": "npm test"}"}                 // 单独命令
  {"input": "{"action": "foreground", "command": "cd ByteCraft && npm test"}"} // 复合命令：先切换目录再执行
  {"input": "{"action": "foreground", "command": "cd src && ls -la"}"}         // 复合命令：先切换目录再执行
  {"input": "{"action": "foreground", "command": "cd .. && pwd"}"}             // 支持相对路径，但不能超出项目根目录

  ### 2. 后台服务管理
  启动长期运行的服务，如Web服务器、开发服务器等。
  同样支持单独命令和复合命令格式。
  
  示例：
  {"input": "{"action": "background", "command": "python3 -m http.server 8080", "type": "service"}"}  // 单独命令
  {"input": "{"action": "background", "command": "npm run dev", "type": "service"}"}                   // 单独命令
  {"input": "{"action": "background", "command": "cd ByteCraft && npm run dev", "type": "service"}"}   // 复合命令
  {"input": "{"action": "background", "command": "npm run build", "type": "build"}"}                   // 单独命令

  ### 3. 依赖管理
  安装和管理项目依赖。
  
  示例：
  {"input": "{"action": "install_deps", "packages": ["jest", "@types/jest", "ts-jest"], "dev": true}"}
  {"input": "{"action": "install_deps", "packages": ["express", "cors"]}"}
  {"input": "{"action": "foreground", "command": "npm install"}"}

  ### 4. 测试执行
  运行项目测试，支持不同的测试框架。
  
  示例：
  {"input": "{"action": "run_test", "testFile": "project-analyzer.test.ts"}"}
  {"input": "{"action": "run_test", "testPattern": "*.test.ts"}"}
  {"input": "{"action": "foreground", "command": "npm test"}"}

  ### 5. 安全目录管理
  支持安全的目录切换，防止访问项目外部目录。
  
  示例：
  {"input": "{"action": "change_dir", "directory": "src"}"}
  {"input": "{"action": "change_dir", "directory": "tests"}"}
  {"input": "{"action": "get_current_dir"}"}

  ### 6. 进程管理
  管理后台运行的进程。
  
  示例：
  {"input": "{"action": "list_processes"}"}
  {"input": "{"action": "kill_process", "processId": "1704067200000"}"}
  {"input": "{"action": "kill_all_processes"}"}

  ## 📋 参数说明

  ### 通用参数
  - action (必填): 操作类型
  - workingDir (可选): 工作目录，相对于项目根目录

  ### 前台执行参数
  - command (必填): 要执行的命令
  - timeout (可选): 超时时间，默认30秒

  ### 后台执行参数
  - command (必填): 要执行的命令
  - type (可选): 进程类型 ["service", "task", "build", "test"]

  ### 依赖安装参数
  - packages (必填): 包名数组
  - dev (可选): 是否为开发依赖，默认false
  - manager (可选): 包管理器 ["npm", "pnpm", "yarn"]，默认npm

  ### 测试执行参数
  - testFile (可选): 指定测试文件
  - testPattern (可选): 测试文件模式

  ### 目录管理参数
  - directory (可选): 目标目录

  ## 🛡️ 安全约束

  ### 目录安全
  - 只能切换到项目内部目录
  - 允许使用相对路径（包括 cd ..），但不能超出项目根目录范围
  - 禁止使用绝对路径和访问系统敏感目录

  ### 命令安全
  - 命令长度限制：10KB
  - 危险命令拦截：shutdown, rm -rf /, format等
  - 执行时间控制：可配置超时，默认30秒

  ### 进程管理
  - 后台进程数量限制：15个
  - 自动清理僵尸进程
  - 进程状态监控

  ## 📊 快捷操作

  ### 常用开发命令
  {"input": "{"action": "dev_server"}"}          // 启动开发服务器
  {"input": "{"action": "install_all"}"}         // 安装所有依赖
  {"input": "{"action": "build_project"}"}       // 构建项目
  {"input": "{"action": "run_tests"}"}           // 运行所有测试

  ## ⚠️ 注意事项
  - 所有路径都相对于项目根目录
  - 后台服务会自动分配唯一ID
  - 建议为长期运行的服务设置type为"service"
  - 安装依赖时会自动检测项目类型
  - 错误信息会详细显示当前目录和可用目录，避免重复切换
  - 支持智能目录提示，帮助快速定位问题
  - **自动目录重置**：每次工具调用完成后工作目录自动重置到项目根目录，返回结果包含重置状态信息
  - **当前目录跟踪**：返回结果中的 current_directory_after_reset 字段始终为 "."，表示已在根目录
  
  ## 错误处理
  执行失败时，会返回详细的错误信息，包括错误类型、错误消息和执行时间。
  示例
- 命令超时
  输入：{"input": "{\"action\": \"foreground\", \"command\": \"sleep 60\"}"}
  预期输出：{"success": false, "error": "命令超时"}
- 权限不足
  输入：{"input": "{\"action\": \"foreground\", \"command\": \"cat /etc/shadow\"}"}
  预期输出：{"success": false, "error": "权限不足"}
- 目录不存在
  输入：{"input": "{\"action\": \"change_dir\", \"directory\": \"notfound\"}"}
  预期输出：{"success": false, "error": "目录不存在"}

  请按照上述示例的推理逻辑和格式要求，生成符合 CommandExecTool 接口规范的调用参数。`;

  // 代码执行器工具提示词
  static codeExecutorPrompt = `
  CodeExecutorTool 调用指南

  CodeExecutorTool 是一个代码执行工具，支持多种编程语言的安全代码执行，包含超时控制和安全检查功能。
  
  ## 单语言执行示例
  示例 1：执行Python计算
  输入：{"language":"python","code":"x = 10\\ny = 20\\nprint('结果:', x + y)"}
  预期输出：{"success": true, "stdout": "结果: 30", "executionTime": 245}
  
  示例 2：执行JavaScript代码
  输入：{"language":"javascript","code":"console.log('Hello World');\\nconsole.log('当前时间:', new Date());"}
  预期输出：{"success": true, "stdout": "Hello World\\n当前时间: 2024-01-01T00:00:00.000Z"}
  
  示例 3：执行TypeScript代码
  输入：{"language":"typescript","code":"interface User { name: string; age: number }\\nconst user: User = { name: 'Alice', age: 30 };\\nconsole.log(user);"}
  预期输出：{"success": true, "stdout": "{ name: 'Alice', age: 30 }"}
  
  ## 高级执行示例
  示例 4：带环境变量的执行
  输入：{"language":"python","code":"import os\\nprint('环境变量:', os.environ.get('MY_VAR'))","env":{"MY_VAR":"test_value"}}
  预期输出：{"success": true, "stdout": "环境变量: test_value"}
  
  示例 5：带超时控制的执行
  输入：{"language":"javascript","code":"setTimeout(() => console.log('完成'), 1000);","timeout":5000}
  预期输出：{"success": true, "stdout": "完成"}
  
  示例 6：带命令行参数的执行
  输入：{"language":"shell","code":"echo \\"参数: $1 $2\\"","args":["hello","world"]}
  预期输出：{"success": true, "stdout": "参数: hello world"}
  
  ## 操作参数映射表
  基础参数：
  - language：必填，编程语言类型
  - code：必填，要执行的代码内容
  
  可选参数：
  - timeout：执行超时时间（毫秒），默认30000
  - args：命令行参数数组，默认[]
  - env：环境变量对象，默认{}
  
  ## 支持的语言类型
  - python/py：Python代码执行
  - javascript/js/node：Node.js环境执行
  - typescript/ts：TypeScript代码编译执行
  - shell/bash/sh：Shell脚本执行
  - powershell/ps1：PowerShell脚本执行
  - cmd/bat：Windows命令脚本执行
  - go：Go语言代码编译执行
  - rust/rs：Rust代码编译执行
  - c/cpp/c++：C/C++代码编译执行
  
  ## 安全约束
  - 代码长度限制：单次执行代码不超过50KB
  - 执行时间控制：默认30秒超时，可自定义设置
  - 危险操作拦截：禁止文件系统破坏性操作
  - 系统命令限制：阻止系统关机、重启等危险命令
  - 模块导入检查：限制危险模块使用
  
  ## 错误处理
  执行失败时，会返回详细的错误信息，包括错误类型、错误消息和执行时间。
  请按照上述示例的推理逻辑和格式要求，生成符合 CodeExecutorTool 接口规范的调用参数。`;

  // 文件局部编辑工具提示词
  static fileEditPrompt = `
**🎯 重要原则：直接执行，不要输出代码！**

专用文件局部修改工具，支持多种精确的局部修改操作，避免全量覆写文件。
支持基于行号、文本匹配、正则表达式等多种修改模式，适合批量和复杂场景。

## 核心功能
1. 基于行号的精确修改（edit_by_lines）
   - replace_lines: 替换指定行范围
   - insert_lines: 在指定行号后插入内容
   - delete_lines: 删除指定行范围
   - prepend_lines: 在指定行号前插入内容
2. 基于文本匹配的修改（edit_by_text）
   - replace_text: 替换匹配的文本
   - insert_after_text: 在匹配文本后插入内容
   - insert_before_text: 在匹配文本前插入内容
   - delete_text: 删除匹配的文本
3. 基于正则表达式的修改（edit_by_regex）
   - replace_regex: 正则替换
   - extract_and_replace: 提取匹配部分并替换
4. 批量修改（batch_edit）
   - 支持在一个文件上顺序执行多个修改操作
5. 修改预览（preview_edit）
   - 预览修改结果，显示前后对比

## 典型用法示例
- 替换指定行范围：
  {"input": "{\"action\": \"edit_by_lines\", ...}"}
- 在指定行后插入内容：
  {"input": "{\"action\": \"edit_by_lines\", ...}"}
- 删除指定行范围：
  {"input": "{\"action\": \"edit_by_lines\", ...}"}
- 替换匹配的文本：
  {"input": "{\"action\": \"edit_by_text\", ...}"}
- 正则表达式替换：
  {"input": "{\"action\": \"edit_by_regex\", ...}"}
- 批量修改操作：
  {"input": "{\"action\": \"batch_edit\", ...}"}
- 预览修改：
  {"input": "{\"action\": \"preview_edit\", ...}"}

## 安全特性
- 自动备份：每次修改前自动创建 .backup 文件，支持恢复
- 修改验证：行号边界、文件存在性、文本匹配等多重校验
- 操作记录：详细日志，支持回滚

## 参数说明
- action (必填): 操作类型
- file_path (必填): 文件路径
- create_backup (可选): 是否创建备份，默认true
- 其它参数详见下方语法说明

## 注意事项
- 行号从1开始计数
- 换行符统一用 \n
- 批量操作建议从文件末尾向前，避免行号变化影响
- 建议优先使用相对路径
- 每次修改默认创建备份（除非明确禁用）
- 支持预览和回滚，保障安全

  ### 1. 基于行号的精确修改
  操作：edit_by_lines
  - replace_lines: 替换指定行范围
  - insert_lines: 在指定行号后插入内容
  - delete_lines: 删除指定行范围
  - prepend_lines: 在指定行号前插入内容

  ### 2. 基于文本匹配的修改
  操作：edit_by_text
  - replace_text: 替换匹配的文本
  - insert_after_text: 在匹配文本后插入内容
  - insert_before_text: 在匹配文本前插入内容
  - delete_text: 删除匹配的文本

  ### 3. 基于正则表达式的修改
  操作：edit_by_regex
  - replace_regex: 使用正则表达式替换
  - extract_and_replace: 提取匹配部分并替换

  ### 4. 批量修改操作
  操作：batch_edit
  - 支持在一个文件上执行多个修改操作
  - 按顺序执行，确保操作的一致性

  ### 5. 修改预览和安全检查
  操作：preview_edit
  - 预览修改结果而不实际修改文件
  - 显示修改前后的对比

  ## 详细用法示例

  ### 1. 替换指定行范围
  {"input": "{"action": "edit_by_lines", "file_path": "src/index.js", "operation": "replace_lines", "start_line": 5, "end_line": 8, "content": "// 新的代码块\\nconsole.log('Updated code');\\nconst newVar = 'value';"}"}

  ### 2. 在指定行后插入内容
  {"input": "{"action": "edit_by_lines", "file_path": "src/config.js", "operation": "insert_lines", "line_number": 10, "content": "// 新增配置\\nexport const newConfig = {};"}"}

  ### 3. 删除指定行范围
  {"input": "{"action": "edit_by_lines", "file_path": "src/old.js", "operation": "delete_lines", "start_line": 15, "end_line": 20}"}

  ### 4. 替换匹配的文本
  {"input": "{"action": "edit_by_text", "file_path": "src/app.js", "operation": "replace_text", "old_text": "const oldFunction = () => {\\n  return 'old';\\n}", "new_text": "const newFunction = () => {\\n  return 'new';\\n}", "replace_all": false}"}

  ### 5. 在匹配文本后插入
  {"input": "{"action": "edit_by_text", "file_path": "src/imports.js", "operation": "insert_after_text", "target_text": "import React from 'react';", "content": "\\nimport { useState } from 'react';"}"}

  ### 6. 正则表达式替换
  {"input": "{"action": "edit_by_regex", "file_path": "src/version.js", "operation": "replace_regex", "pattern": "version\\s*=\\s*['\"]([^'\"]+)['\"]", "replacement": "version = '2.0.0'", "flags": "g"}"}

  ### 7. 批量修改操作
  {"input": "{"action": "batch_edit", "file_path": "src/main.js", "operations": [
    {
      "type": "edit_by_lines",
      "operation": "replace_lines, 
      "start_line": 1,
      "end_line": 1,
      "content": "// Updated header comment"
    },
    {
      "type": "edit_by_text",
      "operation": "replace_text",
      "old_text": "oldVariable",
      "new_text": "newVariable", 
      "replace_all": true
    }
  ]}"}

  ### 8. 预览修改
  {"input": "{"action": "preview_edit", "file_path": "src/test.js", "edit_config": {
    "type": "edit_by_lines",
    "operation": "replace_lines",
    "start_line": 5,
    "end_line": 7,
    "content": "console.log('Preview change');"
  }}"}

  ## 安全特性

  ### 自动备份
  - 每次修改前自动创建备份文件（.backup扩展名）
  - 支持恢复到备份版本

  ### 修改验证  
  - 行号边界检查
  - 文件存在性验证
  - 文本匹配验证

  ### 操作记录
  - 详细的修改日志
  - 支持操作回滚

  ## 参数说明

  ### 通用参数
  - action (必填): 操作类型
  - file_path (必填): 要修改的文件路径  
  - create_backup (可选): 是否创建备份，默认true

  ### 基于行号修改的参数
  - operation (必填): 操作类型 [replace_lines, insert_lines, delete_lines, prepend_lines]
  - line_number (插入操作必填): 目标行号
  - start_line, end_line (范围操作必填): 起始和结束行号
  - content (新增内容操作必填): 要插入或替换的内容

  ### 基于文本修改的参数  
  - operation (必填): 操作类型 [replace_text, insert_after_text, insert_before_text, delete_text]
  - old_text, target_text (必填): 要匹配的文本
  - new_text, content (新增内容操作必填): 新的内容
  - replace_all (可选): 是否替换所有匹配，默认false
  - case_sensitive (可选): 是否区分大小写，默认true

  ### 正则表达式修改的参数
  - operation (必填): 操作类型 [replace_regex, extract_and_replace] 
  - pattern (必填): 正则表达式模式
  - replacement (必填): 替换内容
  - flags (可选): 正则表达式标志，默认"g"

  ## 注意事项
  - 行号从1开始计数
  - 换行符使用 \\n 表示
  - 自动处理不同操作系统的换行符
  - 批量操作按顺序执行，建议从文件末尾向前操作以避免行号变化
  - 每次修改都会创建备份文件（除非明确禁用）
  - 支持相对和绝对路径，但建议使用相对路径`;

  // 代码库搜索工具提示词
  static grepSearchPrompt = `
**🎯 重要原则：直接执行，不要输出代码！**

GrepSearchTool 是一个代码库搜索工具，支持正则/文本搜索、递归、上下文显示、排除目录、统计等。

## 示例
输入：{"query":"function ","isRegexp":false,"maxResults":10}
预期输出：{"success":true,"results":[{"file":"src/index.ts","line":12,"text":"function foo() {"}]}

## 操作参数映射表
- query：必填，搜索内容
- isRegexp：可选，是否为正则
- maxResults：可选，最大返回条数
- includePattern/excludePattern：可选，包含/排除文件模式

请根据需求生成符合 GrepSearchTool 接口规范的参数。`;

  // 项目分析工具提示词
  static projectAnalyzerPrompt = `
**🎯 重要原则：直接执行，不要输出代码！**

ProjectAnalyzerTool 用于智能分析项目结构、技术栈和关键内容，帮助快速理解项目全貌。

  这个工具可以智能分析项目，不会读取所有文件，而是：
  1. 📊 扫描项目整体结构和文件分布
  2. 📋 读取关键配置文件（package.json、tsconfig.json、README等）
  3. 🔍 识别并读取重要的入口文件和核心模块
  4. 🧠 根据文件重要性和类型选择性读取代码
  5. 📝 生成详细的项目分析报告

## 功能分组

### 1. 项目结构分析（analyze_structure）
操作：analyze_structure
参数：path (可选，默认为当前目录), max_depth (可选，默认为3)
示例：
{"input": "{\"action\": \"analyze_structure\", \"path\": \".\", \"max_depth\": 3}"}
返回：项目的目录结构、文件类型分布、技术栈识别

### 2. 项目完整分析（full_analysis）
操作：full_analysis
参数：path (可选，默认为当前目录), focus_areas (可选，关注的技术领域)
示例：
{"input": "{\"action\": \"full_analysis\", \"path\": \".\", \"focus_areas\": [\"frontend\", \"backend\", \"ai\"]}"}
返回：完整的项目分析报告，包括：
- 项目概览和技术栈
- 关键文件内容摘要
- 代码架构分析
- 项目特点和建议

### 3. 关键文件分析（analyze_key_files）
操作：analyze_key_files
参数：path (可选，默认为当前目录)
示例：
{"input": "{\"action\": \"analyze_key_files\", \"path\": \".\"}"}
返回：项目中关键文件的内容和分析

## 输入格式
所有输入都是JSON字符串格式。`;

  /**
   * 获取工具的详细使用说明
   */
  static getToolPrompt(toolName: string): string {
    switch (toolName) {
      case 'file_manager_v2':
      case 'fileManagerV2':
        return this.fileManagerPrompt;
      case 'command_exec':
      case 'commandExec':
        return this.commandExecPrompt;
      case 'code_executor':
      case 'codeExecutor':
        return this.codeExecutorPrompt;
      case 'file_edit':
      case 'fileEdit':
        return this.fileEditPrompt;
      case 'grep_search':
      case 'grepSearch':
        return this.grepSearchPrompt;
      case 'project_analyzer':
      case 'projectAnalyzer':
        return this.projectAnalyzerPrompt;
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

🗂️  **file_manager_v2** - 文件管理
   递归读取、批量创建、精确修改、删除文件和目录

✏️  **file_edit** - 文件局部编辑
   基于行号、文本、正则的精确修改和批量预览

🔍 **grep_search** - 代码库搜索
   正则/文本搜索、递归、上下文显示、排除目录、统计

📊 **project_analyzer** - 项目分析
   智能分析项目结构、关键文件、技术栈和生成报告

⚡ **command_exec** - 命令执行  
   执行前台和后台命令，管理进程

🔧 **code_executor** - 代码执行
   在沙箱环境中执行多种语言的代码

使用时请按照 JSON 格式提供参数，确保参数完整正确。
`;
  }
}
