import { Tool } from "@langchain/core/tools";
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { LoggerManager } from '../logger/logger.js';
import path from 'path';
import fs from 'fs';

// 后台进程信息接口
interface BackgroundProcessInfo {
  process: ChildProcess;
  command: string;
  startTime: number;
  workingDirectory: string;
  type: 'service' | 'task' | 'build' | 'test';
}

// 用于存储后台进程的 Map
const backgroundProcesses = new Map<string, BackgroundProcessInfo>();

/**
 * 增强版命令执行工具类
 * 提供前台和后台命令执行功能，支持安全的目录管理和进程管理
 */
export class CommandExecTool extends Tool {
  name = "command_exec";
  description = `
  CommandExecTool v2.2 - 跨平台增强版命令执行工具

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
  {"action": "foreground", "command": "ls -la"}                   // 单独命令
  {"action": "foreground", "command": "npm --version"}            // 单独命令
  {"action": "foreground", "command": "npm test"}                 // 单独命令
  {"action": "foreground", "command": "cd ByteCraft && npm test"} // 复合命令：先切换目录再执行
  {"action": "foreground", "command": "cd src && ls -la"}         // 复合命令：先切换目录再执行
  {"action": "foreground", "command": "cd .. && pwd"}             // 支持相对路径，但不能超出项目根目录

  ### 2. 后台服务管理
  启动长期运行的服务，如Web服务器、开发服务器等。
  同样支持单独命令和复合命令格式。
  
  示例：
  {"action": "background", "command": "python3 -m http.server 8080", "type": "service"}  // 单独命令
  {"action": "background", "command": "npm run dev", "type": "service"}                   // 单独命令
  {"action": "background", "command": "cd ByteCraft && npm run dev", "type": "service"}   // 复合命令
  {"action": "background", "command": "npm run build", "type": "build"}                   // 单独命令

  ### 3. 依赖管理
  安装和管理项目依赖。
  
  示例：
  {"action": "install_deps", "packages": ["jest", "@types/jest", "ts-jest"], "dev": true}
  {"action": "install_deps", "packages": ["express", "cors"]}
  {"action": "foreground", "command": "npm install"}

  ### 4. 测试执行
  运行项目测试，支持不同的测试框架。
  
  示例：
  {"action": "run_test", "testFile": "project-analyzer.test.ts"}
  {"action": "run_test", "testPattern": "*.test.ts"}
  {"action": "foreground", "command": "npm test"}

  ### 5. 安全目录管理
  支持安全的目录切换，防止访问项目外部目录。
  
  示例：
  {"action": "change_dir", "directory": "src"}
  {"action": "change_dir", "directory": "tests"}
  {"action": "get_current_dir"}

  ### 6. 进程管理
  管理后台运行的进程。
  
  示例：
  {"action": "list_processes"}
  {"action": "kill_process", "processId": "1704067200000"}
  {"action": "kill_all_processes"}

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
  - 执行时间控制：可配置超时

  ### 进程管理
  - 后台进程数量限制：15个
  - 自动清理僵尸进程
  - 进程状态监控

  ## 📊 快捷操作

  ### 常用开发命令
  {"action": "dev_server"}          // 启动开发服务器
  {"action": "pnpm install"}         // 安装所有依赖
  {"action": "pnpm build"}          // 构建项目
  {"action": "run_tests"}           // 运行所有测试

  ## ⚠️ 注意事项
  - 所有路径都相对于项目根目录
  - 后台服务会自动分配唯一ID
  - 建议为长期运行的服务设置type为"service"
  - 安装依赖时会自动检测项目类型
  - 错误信息会详细显示当前目录和可用目录，避免重复切换
  - 支持智能目录提示，帮助快速定位问题
  - **自动目录重置**：每次工具调用完成后工作目录自动重置到项目根目录，返回结果包含重置状态信息
  - **当前目录跟踪**：返回结果中的 current_directory_after_reset 字段始终为 "."，表示已在根目录
  `;

  private logger: any;
  private readonly maxBackgroundProcesses = 15;
  private readonly defaultTimeout = 30000; // 30秒
  private readonly maxCommandLength = 10240; // 10KB
  private currentWorkingDir: string;
  private readonly projectRoot: string;

  // 危险命令模式 - 增强版
  private readonly dangerousCommands = [
    /shutdown\s/i,
    /reboot\s/i,
    /halt\s/i,
    /poweroff/i,
    /rm\s+-rf\s*\//i,
    /rm\s+-rf\s+\*/i,
    /del\s+\/[sS]\s+/i,
    /format\s+[cC]:/i,
    /rmdir\s+\/[sS]/i,
    /curl\s+.*\|\s*bash/i,
    /wget\s+.*\|\s*sh/i,
    /chmod\s+777\s+\//i,
    /chown\s+.*\s+\//i,
    /sudo\s+rm/i,
    /dd\s+if=/i,
    /mkfs\./i
  ];

  // 危险目录模式 - 只阻止绝对路径和用户目录，允许相对路径包括 ..
  private readonly dangerousDirectories = [
    /^\/[^/]/,      // Unix绝对路径 (以/开头)
    /^~\//,         // 用户目录
    /^\\[^\\]/,     // Windows绝对路径 (以\开头)
    /^[a-zA-Z]:\\/  // Windows驱动器路径 (如C:\)
  ];

  constructor() {
    super();
    this.logger = LoggerManager.getInstance().getLogger('command-exec-v2');
    this.projectRoot = process.cwd();
    this.currentWorkingDir = this.projectRoot;
    
    this.logger.info('命令执行工具v2初始化', { 
      projectRoot: this.projectRoot,
      currentWorkingDir: this.currentWorkingDir
    });
  }

  protected async _call(input: string): Promise<string> {
    try {
      this.logger.info('命令执行工具v2被调用', { input: input.substring(0, 200) });
      
      // 输入验证
      if (!input || typeof input !== 'string') {
        this.logger.error('无效的输入', { input, type: typeof input });
        return JSON.stringify({ 
          error: `无效的输入: 期望字符串，但收到 ${typeof input}`,
          received: input
        });
      }

      let parsed;
      try {
        parsed = JSON.parse(input);
        this.logger.info('JSON解析成功', { 
          action: parsed.action,
          commandLength: parsed.command?.length
        });
      } catch (parseError) {
        this.logger.error('JSON解析失败', { input: input.substring(0, 200), error: parseError });
        return JSON.stringify({ 
          error: `JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          input: input.substring(0, 200)
        });
      }

      const { action } = parsed;
      if (!action) {
        this.logger.error('缺少必需参数: action', { parsed });
        return JSON.stringify({ error: "缺少必需参数: action" });
      }

      // 设置工作目录
      if (parsed.workingDir) {
        const dirResult = await this.changeWorkingDirectory(parsed.workingDir);
        if (!dirResult.success) {
          return JSON.stringify(dirResult);
        }
      }

      this.logger.info('开始执行命令操作', { action, currentWorkingDir: this.currentWorkingDir });

      let result: string;
      switch (action) {
        case 'foreground':
          result = await this.runInForeground(parsed.command, parsed.timeout);
          break;
        
        case 'background':
          result = await this.runInBackground(parsed.command, parsed.type);
          break;
        
        case 'install_deps':
          result = await this.installDependencies(parsed.packages, parsed.dev, parsed.manager);
          break;
        
        case 'run_test':
          result = await this.runTest(parsed.testFile, parsed.testPattern);
          break;
        
        case 'change_dir':
          result = JSON.stringify(await this.changeWorkingDirectory(parsed.directory));
          break;
        
        case 'get_current_dir':
          result = JSON.stringify(await this.getCurrentDirectory());
          break;
        
        case 'list_processes':
          result = await this.listBackgroundProcesses();
          break;
        
        case 'kill_process':
          result = await this.killBackgroundProcess(parsed.processId);
          break;
        
        case 'kill_all_processes':
          result = await this.killAllBackgroundProcesses();
          break;

        // 快捷操作
        case 'dev_server':
          result = await this.startDevServer();
          break;
        
        case 'build_project':
          result = await this.buildProject();
          break;
        
        case 'install_all':
          result = await this.installAllDependencies();
          break;
        
        case 'run_tests':
          result = await this.runAllTests();
          break;
        
        default:
          this.logger.error('不支持的操作', { action });
          result = JSON.stringify({ error: `不支持的操作: ${action}` });
      }

      this.logger.info('命令操作完成', { action, result: result.substring(0, 200) });
      
      // 自动重置工作目录到项目根目录
      const resetResult = this.resetToProjectRoot();
      
      // 在返回结果中添加重置信息，让大模型知道已经回到根目录
      let parsedResult;
      try {
        parsedResult = JSON.parse(result);
        parsedResult.directory_reset = resetResult;
        parsedResult.current_directory_after_reset = '.';
        parsedResult.notice = '⚠️ 工作目录已自动重置到项目根目录';
        result = JSON.stringify(parsedResult, null, 2);
      } catch (e) {
        // 如果解析失败，直接返回原结果
      }
      
      return result;

    } catch (error) {
      this.logger.error('命令执行工具执行失败', { 
        error: error instanceof Error ? error.message : String(error), 
        stack: error instanceof Error ? error.stack : undefined 
      });
      
      // 即使出错也要重置工作目录
      const resetResult = this.resetToProjectRoot();
      
      return JSON.stringify({ 
        error: `命令执行失败: ${error instanceof Error ? error.message : String(error)}`,
        stack: error instanceof Error ? error.stack : undefined,
        directory_reset: resetResult,
        current_directory_after_reset: '.',
        notice: '⚠️ 工作目录已自动重置到项目根目录'
      });
    }
  }

  /**
   * 增强的安全检查
   */
  private performSecurityCheck(command: string): { safe: boolean; reason?: string } {
    this.logger.info('开始安全检查', { commandLength: command.length });
    
    try {
      // 检查命令长度
      if (command.length > this.maxCommandLength) {
        return { 
          safe: false, 
          reason: `命令长度超限: 最大支持${this.maxCommandLength / 1024}KB` 
        };
      }

      // 检查危险命令模式
      for (const pattern of this.dangerousCommands) {
        if (pattern.test(command)) {
          this.logger.error('安全检查失败：发现危险命令', { 
            pattern: pattern.toString(),
            matchedCommand: command.match(pattern)?.[0] 
          });
          return { 
            safe: false, 
            reason: `检测到危险命令模式: ${pattern.toString()}` 
          };
        }
      }

      // 检查目录操作安全性
      const cdMatch = command.match(/cd\s+([^\s;&|]+)/i);
      if (cdMatch) {
        const targetDir = cdMatch[1];
        for (const pattern of this.dangerousDirectories) {
          if (pattern.test(targetDir)) {
            return { 
              safe: false, 
              reason: `危险的目录操作: ${targetDir}` 
            };
          }
        }
      }

      this.logger.info('安全检查通过', { commandLength: command.length });
      return { safe: true };
    } catch (error) {
      this.logger.error('安全检查过程中发生错误', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return { 
        safe: false, 
        reason: `安全检查失败: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * 安全的目录切换
   */
  private async changeWorkingDirectory(directory?: string): Promise<any> {
    const currentRelativeDir = path.relative(this.projectRoot, this.currentWorkingDir) || '.';
    
    try {
      if (!directory) {
        // 回到项目根目录
        this.currentWorkingDir = this.projectRoot;
        this.logger.info('切换到项目根目录', { currentWorkingDir: this.currentWorkingDir });
        return { 
          success: true, 
          currentDir: path.relative(this.projectRoot, this.currentWorkingDir) || '.',
          message: '已切换到项目根目录'
        };
      }

      // 安全检查
      for (const pattern of this.dangerousDirectories) {
        if (pattern.test(directory)) {
          this.logger.error('目录切换安全检查失败', { directory, pattern: pattern.toString() });
          return { 
            success: false, 
            error: `不安全的目录路径: ${directory}`,
            currentDir: currentRelativeDir,
            message: `当前目录: ${currentRelativeDir}，尝试切换到不安全的路径: ${directory}`
          };
        }
      }

      // 计算目标路径 - 支持相对路径包括 cd ..
      const targetPath = path.resolve(this.currentWorkingDir, directory);
      
      // 确保目标路径在项目根目录内（允许 cd .. 但不能超出项目根目录）
      const relativePath = path.relative(this.projectRoot, targetPath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        this.logger.error('目录切换超出项目范围', { 
          directory, 
          targetPath, 
          relativePath,
          projectRoot: this.projectRoot,
          explanation: '允许使用 cd .. 但不能超出项目根目录范围'
        });
        return { 
          success: false, 
          error: `目录路径超出项目范围: ${directory}`,
          currentDir: currentRelativeDir,
          projectRoot: this.projectRoot,
          message: `当前目录: ${currentRelativeDir}，路径 "${directory}" 会超出项目根目录范围。支持 cd .. 但不能访问项目外部目录。`
        };
      }

      // 检查目录是否存在
      if (!fs.existsSync(targetPath)) {
        // 列出当前目录的内容以帮助调试
        const currentDirContents = fs.readdirSync(this.currentWorkingDir)
          .filter(item => fs.statSync(path.join(this.currentWorkingDir, item)).isDirectory())
          .slice(0, 10); // 只显示前10个目录
        
        this.logger.error('目标目录不存在', { directory, targetPath, currentDirContents });
        return { 
          success: false, 
          error: `目录不存在: ${directory}`,
          currentDir: currentRelativeDir,
          availableDirectories: currentDirContents,
          message: `当前目录: ${currentRelativeDir}，目标目录 "${directory}" 不存在。可用的子目录: ${currentDirContents.length > 0 ? currentDirContents.join(', ') : '无'}`
        };
      }

      // 检查是否为目录
      const stats = fs.statSync(targetPath);
      if (!stats.isDirectory()) {
        this.logger.error('目标路径不是目录', { directory, targetPath });
        return { 
          success: false, 
          error: `不是有效的目录: ${directory}`,
          currentDir: currentRelativeDir,
          message: `当前目录: ${currentRelativeDir}，"${directory}" 存在但不是目录`
        };
      }

      this.currentWorkingDir = targetPath;
      this.logger.info('目录切换成功', { 
        directory, 
        currentWorkingDir: this.currentWorkingDir,
        relativePath 
      });

      return { 
        success: true, 
        currentDir: relativePath || '.',
        absolutePath: targetPath,
        previousDir: currentRelativeDir,
        message: `已从 ${currentRelativeDir} 切换到目录: ${relativePath || '.'}`
      };
    } catch (error) {
      this.logger.error('目录切换失败', { 
        directory, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return { 
        success: false, 
        error: `目录切换失败: ${error instanceof Error ? error.message : String(error)}`,
        currentDir: currentRelativeDir,
        message: `当前目录: ${currentRelativeDir}，切换到 "${directory}" 时发生错误`
      };
    }
  }

  /**
   * 获取当前目录信息
   */
  private async getCurrentDirectory(): Promise<any> {
    try {
      const relativePath = path.relative(this.projectRoot, this.currentWorkingDir);
      const contents = fs.readdirSync(this.currentWorkingDir);
      
      return {
        success: true,
        currentDir: relativePath || '.',
        absolutePath: this.currentWorkingDir,
        projectRoot: this.projectRoot,
        contents: contents.slice(0, 20), // 只显示前20个项目
        totalItems: contents.length
      };
    } catch (error) {
      this.logger.error('获取当前目录信息失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return {
        success: false,
        error: `获取目录信息失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 重置工作目录到项目根目录
   * 每次工具调用完成后自动执行，确保下次调用时从根目录开始
   */
  private resetToProjectRoot(): any {
    const previousDir = path.relative(this.projectRoot, this.currentWorkingDir) || '.';
    
    if (this.currentWorkingDir !== this.projectRoot) {
      this.currentWorkingDir = this.projectRoot;
      this.logger.info('自动重置工作目录到项目根目录', { 
        previousDir,
        currentDir: '.',
        projectRoot: this.projectRoot
      });
      
      return {
        was_reset: true,
        previous_directory: previousDir,
        current_directory: '.',
        message: `工作目录已从 "${previousDir}" 重置到项目根目录 "."`
      };
    } else {
      return {
        was_reset: false,
        current_directory: '.',
        message: '工作目录已经在项目根目录'
      };
    }
  }

  /**
   * 检测操作系统并返回合适的shell配置
   */
  private getShellConfig(): { shell: string; args: string[] } {
    const platform = process.platform;
    
    if (platform === 'win32') {
      // Windows系统使用PowerShell或cmd
      return {
        shell: 'powershell.exe',
        args: ['-Command']
      };
    } else {
      // Unix系统使用bash
      return {
        shell: 'bash',
        args: ['-c']
      };
    }
  }

  /**
   * 解析并处理复合命令 (如 cd directory && command)
   */
  private parseCompositeCommand(command: string): { workingDir?: string; cleanCommand: string } {
    // 匹配 cd directory && command 模式
    const cdPattern = /^\s*cd\s+([^\s&]+)\s*&&\s*(.+)$/i;
    const match = command.match(cdPattern);
    
    if (match) {
      const [, directory, remainingCommand] = match;
      return {
        workingDir: directory,
        cleanCommand: remainingCommand.trim()
      };
    }
    
    return { cleanCommand: command };
  }

  /**
   * 前台执行命令 - 增强版
   */
  private async runInForeground(command: string, timeout?: number): Promise<string> {
    if (!command) {
      return JSON.stringify({ 
        success: false, 
        error: "缺少必需参数: command" 
      });
    }

    // 解析复合命令
    const { workingDir, cleanCommand } = this.parseCompositeCommand(command);
    
    // 如果有目录切换，先切换目录
    if (workingDir) {
      const dirResult = await this.changeWorkingDirectory(workingDir);
      if (!dirResult.success) {
        return JSON.stringify(dirResult);
      }
    }

    // 安全检查
    const securityCheck = this.performSecurityCheck(cleanCommand);
    if (!securityCheck.safe) {
      return JSON.stringify({ 
        success: false, 
        error: `安全检查失败: ${securityCheck.reason}` 
      });
    }

    this.logger.info('开始前台执行命令', { 
      originalCommand: command,
      cleanCommand, 
      workingDir: workingDir || 'current',
      currentWorkingDir: this.currentWorkingDir,
      timeout: timeout || this.defaultTimeout
    });
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timeoutMs = timeout || this.defaultTimeout;
      
      // 获取适合当前系统的shell配置
      const shellConfig = this.getShellConfig();
      
      const childProcess = spawn(shellConfig.shell, [...shellConfig.args, cleanCommand], {
        stdio: ['inherit', 'pipe', 'pipe'],
        cwd: this.currentWorkingDir,
        shell: process.platform === 'win32' // 在Windows上启用shell模式
      });

      childProcess.setMaxListeners(20);

      let stdout = '';
      let stderr = '';
      let isResolved = false;

      // 设置超时
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          childProcess.kill('SIGTERM');
          
          const executionTime = Date.now() - startTime;
          this.logger.error('命令执行超时', { command: cleanCommand, executionTime, timeout: timeoutMs });
          
          const currentRelativeDir = path.relative(this.projectRoot, this.currentWorkingDir) || '.';
          resolve(JSON.stringify({
            success: false,
            error: `命令执行超时 (${timeoutMs}ms)`,
            stdout,
            stderr,
            executionTime,
            workingDir: currentRelativeDir,
            currentDirectory: this.currentWorkingDir,
            message: `命令在目录 "${currentRelativeDir}" 中执行超时 (${timeoutMs}ms)`
          }));
        }
      }, timeoutMs);

      // 收集输出
      childProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // 处理完成
      childProcess.on('close', (code: number | null) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          
          const executionTime = Date.now() - startTime;
          const success = code === 0;
          
          this.logger.info('前台命令执行完成', { 
            command: cleanCommand, 
            code, 
            success, 
            executionTime,
            stdoutLength: stdout.length,
            stderrLength: stderr.length,
            workingDir: this.currentWorkingDir
          });
          
          const currentRelativeDir = path.relative(this.projectRoot, this.currentWorkingDir) || '.';
          resolve(JSON.stringify({
            success,
            stdout: stdout || undefined,
            stderr: stderr || undefined,
            exitCode: code,
            executionTime,
            workingDir: currentRelativeDir,
            currentDirectory: this.currentWorkingDir,
            projectRoot: this.projectRoot,
            error: success ? undefined : `命令执行失败，退出码: ${code}`,
            message: success ? `命令在目录 "${currentRelativeDir}" 中执行成功` : `命令在目录 "${currentRelativeDir}" 中执行失败，退出码: ${code}`
          }));
        }
      });

      // 处理错误
      childProcess.on('error', (error: Error) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          
          const executionTime = Date.now() - startTime;
          this.logger.error('前台命令执行错误', { command: cleanCommand, error: error.message });
          
          const currentRelativeDir = path.relative(this.projectRoot, this.currentWorkingDir) || '.';
          resolve(JSON.stringify({
            success: false,
            error: `执行命令时出错: ${error.message}`,
            stdout,
            stderr,
            executionTime,
            workingDir: currentRelativeDir,
            currentDirectory: this.currentWorkingDir,
            message: `命令在目录 "${currentRelativeDir}" 中执行时发生错误: ${error.message}`
          }));
        }
      });
    });
  }

  /**
   * 后台执行命令 - 增强版
   */
  private async runInBackground(command: string, type: string = 'task'): Promise<string> {
    if (!command) {
      return JSON.stringify({ 
        success: false, 
        error: "缺少必需参数: command" 
      });
    }

    // 解析复合命令
    const { workingDir, cleanCommand } = this.parseCompositeCommand(command);
    
    // 如果有目录切换，先切换目录
    if (workingDir) {
      const dirResult = await this.changeWorkingDirectory(workingDir);
      if (!dirResult.success) {
        return JSON.stringify(dirResult);
      }
    }

    // 安全检查
    const securityCheck = this.performSecurityCheck(cleanCommand);
    if (!securityCheck.safe) {
      return JSON.stringify({ 
        success: false, 
        error: `安全检查失败: ${securityCheck.reason}` 
      });
    }

    // 检查后台进程数量限制
    if (backgroundProcesses.size >= this.maxBackgroundProcesses) {
      this.logger.error('后台进程数量超限', { 
        currentCount: backgroundProcesses.size, 
        maxCount: this.maxBackgroundProcesses 
      });
      return JSON.stringify({ 
        success: false, 
        error: `后台进程数量超限: 最多支持${this.maxBackgroundProcesses}个后台进程` 
      });
    }

    this.logger.info('开始后台执行命令', { 
      originalCommand: command,
      cleanCommand, 
      type,
      workingDir: workingDir || 'current',
      currentWorkingDir: this.currentWorkingDir
    });

    try {
      const processId = Date.now().toString();
      
      // 获取适合当前系统的shell配置
      const shellConfig = this.getShellConfig();
      
      const childProcess = spawn(shellConfig.shell, [...shellConfig.args, cleanCommand], {
        stdio: 'ignore',
        detached: true,
        cwd: this.currentWorkingDir,
        shell: process.platform === 'win32' // 在Windows上启用shell模式
      });

      childProcess.unref();
      
      const processInfo: BackgroundProcessInfo = {
        process: childProcess,
        command: cleanCommand,
        startTime: Date.now(),
        workingDirectory: this.currentWorkingDir,
        type: type as any
      };
      
      backgroundProcesses.set(processId, processInfo);

      // 监听进程退出
      childProcess.on('exit', (code) => {
        this.logger.info('后台进程退出', { processId, code, command: cleanCommand });
        backgroundProcesses.delete(processId);
      });

      this.logger.info('后台命令启动成功', { 
        originalCommand: command,
        cleanCommand, 
        processId, 
        pid: childProcess.pid,
        type,
        workingDir: this.currentWorkingDir,
        backgroundProcessCount: backgroundProcesses.size
      });

      const currentRelativeDir = path.relative(this.projectRoot, this.currentWorkingDir) || '.';
      return JSON.stringify({
        success: true,
        processId,
        pid: childProcess.pid,
        type,
        command: cleanCommand,
        originalCommand: command,
        workingDir: currentRelativeDir,
        currentDirectory: this.currentWorkingDir,
        startTime: processInfo.startTime,
        message: `命令已在目录 "${currentRelativeDir}" 中的后台启动 (类型: ${type})`
      });
    } catch (error) {
      this.logger.error('后台命令启动失败', { 
        command, 
        error: error instanceof Error ? error.message : String(error) 
      });
      const currentRelativeDir = path.relative(this.projectRoot, this.currentWorkingDir) || '.';
      return JSON.stringify({
        success: false,
        error: `后台命令启动失败: ${error instanceof Error ? error.message : String(error)}`,
        workingDir: currentRelativeDir,
        currentDirectory: this.currentWorkingDir,
        message: `在目录 "${currentRelativeDir}" 中启动后台命令失败: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * 安装依赖
   */
  private async installDependencies(packages: string[], dev: boolean = false, manager: string = 'npm'): Promise<string> {
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return JSON.stringify({ 
        success: false, 
        error: "缺少必需参数: packages (非空数组)" 
      });
    }

    // 验证包管理器
    const validManagers = ['npm', 'pnpm', 'yarn'];
    if (!validManagers.includes(manager)) {
      return JSON.stringify({ 
        success: false, 
        error: `不支持的包管理器: ${manager}，支持的管理器: ${validManagers.join(', ')}` 
      });
    }

    // 构建安装命令
    let command: string;
    switch (manager) {
      case 'npm':
        command = `npm install ${dev ? '--save-dev' : ''} ${packages.join(' ')}`;
        break;
      case 'pnpm':
        command = `pnpm add ${dev ? '-D' : ''} ${packages.join(' ')}`;
        break;
      case 'yarn':
        command = `yarn add ${dev ? '--dev' : ''} ${packages.join(' ')}`;
        break;
      default:
        command = `npm install ${dev ? '--save-dev' : ''} ${packages.join(' ')}`;
    }

    this.logger.info('开始安装依赖', { packages, dev, manager, command });

    return await this.runInForeground(command, 120000); // 2分钟超时
  }

  /**
   * 运行测试
   */
  private async runTest(testFile?: string, testPattern?: string): Promise<string> {
    let command: string;

    if (testFile) {
      // 运行指定测试文件
      command = `npm test -- ${testFile}`;
    } else if (testPattern) {
      // 运行匹配模式的测试
      command = `npm test -- --testPathPattern="${testPattern}"`;
    } else {
      // 运行所有测试
      command = 'npm test';
    }

    this.logger.info('开始运行测试', { testFile, testPattern, command });

    return await this.runInForeground(command, 180000); // 3分钟超时
  }

  /**
   * 列出后台进程 - 增强版
   */
  private async listBackgroundProcesses(): Promise<string> {
    this.logger.info('列出后台进程', { processCount: backgroundProcesses.size });
    
    try {
      if (backgroundProcesses.size === 0) {
        this.logger.info('没有后台进程');
        return JSON.stringify({
          success: true,
          processes: [],
          count: 0,
          message: '当前没有后台运行的进程'
        });
      }

      const processes = Array.from(backgroundProcesses.entries())
        .map(([processId, info]) => ({
          processId,
          pid: info.process.pid,
          command: info.command,
          type: info.type,
          startTime: info.startTime,
          duration: Date.now() - info.startTime,
          workingDirectory: path.relative(this.projectRoot, info.workingDirectory) || '.',
          isRunning: !info.process.killed
        }));

      this.logger.info('后台进程列表获取成功', { processCount: processes.length });
      
      return JSON.stringify({
        success: true,
        processes,
        count: processes.length,
        summary: {
          services: processes.filter(p => p.type === 'service').length,
          tasks: processes.filter(p => p.type === 'task').length,
          builds: processes.filter(p => p.type === 'build').length,
          tests: processes.filter(p => p.type === 'test').length
        }
      });
    } catch (error) {
      this.logger.error('列出后台进程失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({
        success: false,
        error: `列出后台进程失败: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * 终止后台进程 - 增强版
   */
  private async killBackgroundProcess(processId: string): Promise<string> {
    if (!processId) {
      return JSON.stringify({ 
        success: false, 
        error: "缺少必需参数: processId" 
      });
    }

    this.logger.info('终止后台进程', { processId });
    
    try {
      const processInfo = backgroundProcesses.get(processId);
      if (!processInfo) {
        this.logger.error('找不到指定的后台进程', { processId });
        return JSON.stringify({
          success: false,
          error: `找不到进程ID: ${processId}`
        });
      }

      processInfo.process.kill('SIGTERM');
      backgroundProcesses.delete(processId);

      this.logger.info('后台进程终止成功', { 
        processId, 
        pid: processInfo.process.pid,
        command: processInfo.command,
        duration: Date.now() - processInfo.startTime,
        remainingProcesses: backgroundProcesses.size
      });

      return JSON.stringify({
        success: true,
        processId,
        pid: processInfo.process.pid,
        command: processInfo.command,
        duration: Date.now() - processInfo.startTime,
        message: `成功终止进程 ${processId} (${processInfo.type})`
      });
    } catch (error) {
      this.logger.error('终止后台进程失败', { 
        processId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({
        success: false,
        error: `终止进程失败: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * 终止所有后台进程
   */
  private async killAllBackgroundProcesses(): Promise<string> {
    this.logger.info('终止所有后台进程', { processCount: backgroundProcesses.size });
    
    try {
      if (backgroundProcesses.size === 0) {
        return JSON.stringify({
          success: true,
          message: '没有需要终止的后台进程',
          killedCount: 0
        });
      }

      const processesToKill = Array.from(backgroundProcesses.entries());
      let killedCount = 0;
      let errors: string[] = [];

      for (const [processId, processInfo] of processesToKill) {
        try {
          processInfo.process.kill('SIGTERM');
          backgroundProcesses.delete(processId);
          killedCount++;
          
          this.logger.info('终止后台进程', { 
            processId, 
            command: processInfo.command,
            type: processInfo.type
          });
        } catch (error) {
          const errorMsg = `终止进程 ${processId} 失败: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          this.logger.error('终止单个后台进程失败', { processId, error: errorMsg });
        }
      }

      return JSON.stringify({
        success: errors.length === 0,
        killedCount,
        totalCount: processesToKill.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `成功终止 ${killedCount}/${processesToKill.length} 个后台进程`
      });
    } catch (error) {
      this.logger.error('终止所有后台进程失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({
        success: false,
        error: `终止所有后台进程失败: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  // 快捷操作方法

  /**
   * 启动开发服务器
   */
  private async startDevServer(): Promise<string> {
    this.logger.info('启动开发服务器');
    
    // 检查是否有现有的开发服务器
    const existingDevServer = Array.from(backgroundProcesses.values())
      .find(info => info.type === 'service' && 
            (info.command.includes('dev') || info.command.includes('serve')));
    
    if (existingDevServer) {
      return JSON.stringify({
        success: false,
        error: '开发服务器已经在运行',
        existingProcess: {
          command: existingDevServer.command,
          pid: existingDevServer.process.pid,
          duration: Date.now() - existingDevServer.startTime
        }
      });
    }

    // 尝试不同的开发服务器命令
    const devCommands = ['npm run dev', 'yarn dev', 'pnpm dev', 'npm start'];
    
    for (const command of devCommands) {
      try {
        // 检查命令是否存在
        const checkResult = await this.runInForeground(`${command.split(' ')[0]} --version`, 5000);
        const checkData = JSON.parse(checkResult);
        
        if (checkData.success) {
          return await this.runInBackground(command, 'service');
        }
      } catch (error) {
        // 继续尝试下一个命令
        continue;
      }
    }

    return JSON.stringify({
      success: false,
      error: '未找到可用的开发服务器命令，请检查 package.json 中的 scripts'
    });
  }

  /**
   * 构建项目
   */
  private async buildProject(): Promise<string> {
    this.logger.info('构建项目');
    
    const buildCommands = ['npm run build', 'yarn build', 'pnpm build'];
    
    for (const command of buildCommands) {
      try {
        const checkResult = await this.runInForeground(`${command.split(' ')[0]} --version`, 5000);
        const checkData = JSON.parse(checkResult);
        
        if (checkData.success) {
          return await this.runInBackground(command, 'build');
        }
      } catch (error) {
        continue;
      }
    }

    return JSON.stringify({
      success: false,
      error: '未找到可用的构建命令，请检查 package.json 中的 scripts'
    });
  }

  /**
   * 安装所有依赖
   */
  private async installAllDependencies(): Promise<string> {
    this.logger.info('安装所有依赖');
    
    return await this.runInForeground('pnpm install', 180000); // 3分钟超时
  }

  /**
   * 运行所有测试
   */
  private async runAllTests(): Promise<string> {
    this.logger.info('运行所有测试');
    
    return await this.runInForeground('pnpm test', 300000); // 5分钟超时
  }
}

/**
 * 创建命令执行工具实例
 */
export function createCommandExecTool(): CommandExecTool {
  return new CommandExecTool();
} 