# CommandExecTool v2.0 新功能说明

## 概述

CommandExecTool v2.0 是对原版命令执行工具的重大升级，添加了你所要求的所有功能，同时增强了安全性和易用性。

## 🚀 新增功能

### 1. 依赖安装管理

#### 自动安装开发依赖
```json
{
  "action": "install_deps",
  "packages": ["jest", "@types/jest", "ts-jest"],
  "dev": true,
  "manager": "npm"
}
```

#### 支持的包管理器
- **npm** (默认)
- **pnpm** 
- **yarn**

#### 示例用法
```json
// 安装生产依赖
{
  "action": "install_deps",
  "packages": ["express", "cors", "axios"]
}

// 安装开发依赖 (你要求的Jest测试套件)
{
  "action": "install_deps",
  "packages": ["jest", "@types/jest", "ts-jest"],
  "dev": true
}

// 使用pnpm安装
{
  "action": "install_deps",
  "packages": ["typescript"],
  "manager": "pnpm"
}
```

### 2. 测试运行功能

#### 运行指定测试文件
```json
{
  "action": "run_test",
  "testFile": "project-analyzer.test.ts"
}
```

#### 运行匹配模式的测试
```json
{
  "action": "run_test",
  "testPattern": "*.test.ts"
}
```

#### 运行所有测试
```json
{
  "action": "run_test"
}
```

### 3. 安全的目录管理

#### 🔒 增强的安全检查
- ✅ 禁止使用 `../` 访问上级目录
- ✅ 禁止访问项目外部目录
- ✅ 禁止绝对路径操作
- ✅ 禁止访问系统敏感目录

#### 安全目录切换
```json
// ✅ 允许：切换到项目内部目录
{
  "action": "change_dir",
  "directory": "src"
}

// ✅ 允许：切换到子目录
{
  "action": "change_dir", 
  "directory": "src/utils"
}

// ❌ 禁止：访问上级目录
{
  "action": "change_dir",
  "directory": "../"
}

// ❌ 禁止：绝对路径
{
  "action": "change_dir",
  "directory": "/etc"
}
```

#### 获取当前目录信息
```json
{
  "action": "get_current_dir"
}
```

返回信息包括：
- 当前相对路径
- 绝对路径
- 目录内容列表
- 项目根目录

### 4. 增强的后台服务管理

#### 启动后台HTTP服务器 (你要求的功能)
```json
{
  "action": "background",
  "command": "python3 -m http.server 8080",
  "type": "service"
}
```

#### 进程类型分类
- **service**: 长期运行的服务 (如HTTP服务器)
- **task**: 临时任务
- **build**: 构建过程
- **test**: 测试进程

#### 增强的进程管理
```json
// 列出详细的后台进程信息
{
  "action": "list_processes"
}

// 终止特定进程
{
  "action": "kill_process",
  "processId": "1704067200000"
}

// 终止所有后台进程
{
  "action": "kill_all_processes"
}
```

#### 后台进程信息包括：
- 进程ID和PID
- 完整命令
- 进程类型
- 运行时间
- 工作目录
- 运行状态

### 5. 工作目录控制

#### 在指定目录执行命令
```json
{
  "action": "foreground",
  "command": "ls -la",
  "workingDir": "docs"
}
```

#### 临时目录切换
```json
{
  "action": "change_dir",
  "directory": "tests"
}
```

### 6. 快捷操作

#### 一键启动开发服务器
```json
{
  "action": "dev_server"
}
```

#### 一键构建项目
```json
{
  "action": "build_project"
}
```

#### 一键安装所有依赖
```json
{
  "action": "install_all"
}
```

#### 一键运行所有测试
```json
{
  "action": "run_tests"
}
```

## 🛡️ 安全增强

### 1. 命令安全检查

#### 新增危险命令模式
```regex
/rm\s+-rf\s+\*/i         // 删除所有文件
/chmod\s+777\s+\//i      // 危险权限修改
/sudo\s+rm/i             // 管理员删除
/dd\s+if=/i              // 磁盘操作
/mkfs\./i                // 格式化文件系统
```

#### 目录安全模式
```regex
/\.\./                   // 上级目录
/^\/[^/]/               // 绝对路径
/^~\//                  // 用户目录
/^[a-zA-Z]:\\/          // Windows驱动器路径
```

### 2. 进程限制
- 最大后台进程数：15个 (从10个增加)
- 自动清理僵尸进程
- 进程状态监控

### 3. 执行控制
- 命令长度限制：10KB
- 可配置超时时间
- 详细的错误报告

## 📝 实际使用示例

### 设置开发环境
```bash
# 1. 首先切换到项目目录
cd ByteCraft

# 2. 使用CommandExecTool v2.0安装测试依赖
```

```json
{
  "action": "install_deps",
  "packages": ["jest", "@types/jest", "ts-jest"],
  "dev": true,
  "manager": "npm"
}
```

### 运行测试
```json
{
  "action": "run_test",
  "testFile": "project-analyzer.test.ts"
}
```

### 启动开发环境
```json
// 启动HTTP服务器预览HTML页面
{
  "action": "background",
  "command": "python3 -m http.server 8080",
  "type": "service"
}
```

### 监控和管理
```json
// 查看所有运行的后台服务
{
  "action": "list_processes"
}

// 清理所有后台进程
{
  "action": "kill_all_processes"
}
```

## 🔧 配置选项

### 超时设置
```json
{
  "action": "foreground",
  "command": "npm install",
  "timeout": 120000  // 2分钟超时
}
```

### 工作目录设置
```json
{
  "action": "foreground",
  "command": "npm test",
  "workingDir": "tests"  // 在tests目录执行
}
```

## 🚨 注意事项

### 1. 目录安全
- 所有路径操作都限制在项目根目录内
- 禁止使用 `../` 等路径遍历
- 自动验证目录存在性

### 2. 命令安全
- 自动拦截危险命令
- 详细的安全检查日志
- 命令长度和复杂度限制

### 3. 进程管理
- 后台进程自动分配唯一ID
- 进程状态实时监控
- 异常退出自动清理

### 4. 兼容性
- 支持Windows和Unix系统
- 自动检测包管理器
- 优雅的错误处理

## 📊 与原版对比

| 功能 | 原版 | v2.0 |
|------|------|------|
| 依赖安装 | ❌ | ✅ 支持npm/pnpm/yarn |
| 测试运行 | ❌ | ✅ 集成测试框架 |
| 目录安全 | 基础 | ✅ 增强安全检查 |
| 后台服务 | 基础 | ✅ 类型分类和监控 |
| 进程信息 | 简单 | ✅ 详细状态信息 |
| 工作目录 | ❌ | ✅ 灵活目录管理 |
| 快捷操作 | ❌ | ✅ 一键常用操作 |
| 安全检查 | 基础 | ✅ 全面安全防护 |

## 🎯 主要解决的问题

✅ **依赖管理**: 可以直接通过工具安装jest等测试依赖  
✅ **测试集成**: 支持运行指定测试文件和测试模式  
✅ **目录安全**: 完全防止cd..等危险目录操作  
✅ **后台服务**: 可以启动HTTP服务器等长期运行的服务  
✅ **进程监控**: 详细的后台进程状态和管理  
✅ **工作目录**: 灵活的目录切换和命令执行

这些功能完全满足了你提出的所有需求，同时保持了高度的安全性和易用性。 