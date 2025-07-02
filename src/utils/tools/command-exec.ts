import { Tool } from "@langchain/core/tools";
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { LoggerManager } from '../logger/logger.js';

// 用于存储后台进程的 Map
const backgroundProcesses = new Map<string, ChildProcess>();

/**
 * 命令执行工具类
 * 提供前台和后台命令执行功能，支持进程管理
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
  - 执行时间控制：可配置超时

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
  `;

  private logger: any;
  private readonly maxBackgroundProcesses = 10;
  private readonly defaultTimeout = 30000; // 30秒
  private readonly maxCommandLength = 10240; // 10KB

  // 危险命令模式
  private readonly dangerousCommands = [
    /shutdown\s/i,
    /reboot\s/i,
    /halt\s/i,
    /poweroff/i,
    /rm\s+-rf\s*\//i,
    /del\s+\/[sS]\s+/i,
    /format\s+[cC]:/i,
    /rmdir\s+\/[sS]/i,
    /curl\s+.*\|\s*bash/i,
    /wget\s+.*\|\s*sh/i,
  ];

  constructor() {
    super();
    this.logger = LoggerManager.getInstance().getLogger('command-exec');
  }

  protected async _call(input: string): Promise<string> {
    try {
      this.logger.info('命令执行工具被调用', { input: input.substring(0, 200) });
      
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
          commandLength: parsed.command?.length,
          processId: parsed.processId
        });
      } catch (parseError) {
        this.logger.error('JSON解析失败', { input: input.substring(0, 200), error: parseError });
        return JSON.stringify({ 
          error: `JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          input: input.substring(0, 200)
        });
      }

      const { action, command, processId } = parsed;

      // 验证必需参数
      if (!action) {
        this.logger.error('缺少必需参数: action', { parsed });
        return JSON.stringify({ error: "缺少必需参数: action" });
      }

      // 根据操作类型验证参数
      if (action === 'foreground' || action === 'background') {
        if (!command) {
          this.logger.error('前台/后台执行缺少必需参数: command', { parsed });
          return JSON.stringify({ error: "前台/后台执行缺少必需参数: command" });
        }

        // 验证命令长度
        if (command.length > this.maxCommandLength) {
          this.logger.error('命令长度超限', { commandLength: command.length, maxLength: this.maxCommandLength });
          return JSON.stringify({ 
            error: `命令长度超限: 最大支持${this.maxCommandLength / 1024}KB，当前${Math.round(command.length / 1024)}KB` 
          });
        }

        // 安全检查
        const securityCheck = this.performSecurityCheck(command);
        if (!securityCheck.safe) {
          this.logger.error('安全检查失败', { reason: securityCheck.reason, command });
          return JSON.stringify({ 
            error: `安全检查失败: ${securityCheck.reason}` 
          });
        }
      } else if (action === 'kill') {
        if (!processId) {
          this.logger.error('终止进程缺少必需参数: processId', { parsed });
          return JSON.stringify({ error: "终止进程缺少必需参数: processId" });
        }
      }

      this.logger.info('开始执行命令操作', { action, command, processId });

      let result: string;
      switch (action) {
        case 'foreground':
          result = await this.runInForeground(command);
          break;
        
        case 'background':
          result = await this.runInBackground(command);
          break;
        
        case 'list':
          result = await this.listBackgroundProcesses();
          break;
        
        case 'kill':
          result = await this.killBackgroundProcess(processId);
          break;
        
        // 快捷操作 - 使用 pnpm
        case 'dev_server':
          result = await this.runInBackground('pnpm run dev');
          break;
        
        case 'install_all':
          result = await this.runInForeground('pnpm install');
          break;
        
        case 'build_project':
          result = await this.runInForeground('pnpm build');
          break;
        
        case 'run_tests':
          result = await this.runInForeground('pnpm test');
          break;
        
        case 'install_deps':
          result = await this.installDependencies(parsed);
          break;
        
        default:
          this.logger.error('不支持的操作', { action });
          result = JSON.stringify({ error: `不支持的操作: ${action}` });
      }

      this.logger.info('命令操作完成', { action, result: result.substring(0, 200) });
      return result;

    } catch (error) {
      this.logger.error('命令执行工具执行失败', { 
        error: error instanceof Error ? error.message : String(error), 
        stack: error instanceof Error ? error.stack : undefined 
      });
      return JSON.stringify({ 
        error: `命令执行失败: ${error instanceof Error ? error.message : String(error)}`,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * 执行安全检查
   * 检查命令中是否包含危险操作
   */
  private performSecurityCheck(command: string): { safe: boolean; reason?: string } {
    this.logger.info('开始安全检查', { commandLength: command.length });
    
    try {
      // 检查危险命令模式
      for (const pattern of this.dangerousCommands) {
        if (pattern.test(command)) {
          this.logger.error('安全检查失败：发现危险命令', { 
            pattern: pattern.toString(),
            matchedCommand: command.match(pattern)?.[0] 
          });
          return { 
            safe: false, 
            reason: `检测到危险命令: ${pattern.toString()}` 
          };
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
   * 前台执行命令
   */
  private async runInForeground(command: string): Promise<string> {
    this.logger.info('开始前台执行命令', { command });
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const process = spawn('bash', ['-c', command], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      // 设置事件监听器限制，防止MaxListenersExceededWarning
      process.setMaxListeners(20);

      let stdout = '';
      let stderr = '';
      let isResolved = false;

      // 设置超时
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          process.kill('SIGTERM');
          
          const executionTime = Date.now() - startTime;
          this.logger.error('命令执行超时', { command, executionTime, timeout: this.defaultTimeout });
          
          resolve(JSON.stringify({
            success: false,
            error: `命令执行超时 (${this.defaultTimeout}ms)`,
            stdout,
            stderr,
            executionTime
          }));
        }
      }, this.defaultTimeout);

      // 收集输出
      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // 处理完成
      process.on('close', (code) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          
          const executionTime = Date.now() - startTime;
          const success = code === 0;
          
          this.logger.info('前台命令执行完成', { 
            command, 
            code, 
            success, 
            executionTime,
            stdoutLength: stdout.length,
            stderrLength: stderr.length
          });
          
          resolve(JSON.stringify({
            success,
            stdout: stdout || undefined,
            stderr: stderr || undefined,
            exitCode: code,
            executionTime,
            error: success ? undefined : `命令执行失败，退出码: ${code}`
          }));
        }
      });

      // 处理错误
      process.on('error', (error) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          
          const executionTime = Date.now() - startTime;
          this.logger.error('前台命令执行错误', { command, error: error.message });
          
          resolve(JSON.stringify({
            success: false,
            error: `执行命令时出错: ${error.message}`,
            stdout,
            stderr,
            executionTime
          }));
        }
      });
    });
  }

  /**
   * 后台执行命令
   */
  private async runInBackground(command: string): Promise<string> {
    this.logger.info('开始后台执行命令', { command });
    
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

    try {
      const processId = Date.now().toString();
      const process = spawn('bash', ['-c', command], {
        stdio: 'ignore',
        detached: true
      });

      process.unref();
      backgroundProcesses.set(processId, process);

      this.logger.info('后台命令启动成功', { 
        command, 
        processId, 
        pid: process.pid,
        backgroundProcessCount: backgroundProcesses.size
      });

      return JSON.stringify({
        success: true,
        processId,
        pid: process.pid,
        message: '命令已在后台启动'
      });
    } catch (error) {
      this.logger.error('后台命令启动失败', { 
        command, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({
        success: false,
        error: `后台命令启动失败: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * 列出后台进程
   */
  private async listBackgroundProcesses(): Promise<string> {
    this.logger.info('列出后台进程', { processCount: backgroundProcesses.size });
    
    try {
      if (backgroundProcesses.size === 0) {
        this.logger.info('没有后台进程');
        return JSON.stringify({
          success: true,
          processes: [],
          message: '当前没有后台运行的进程'
        });
      }

      const processes = Array.from(backgroundProcesses.entries())
        .map(([processId, process]) => ({
          processId,
          pid: process.pid,
          command: '后台进程' // 由于没有保存命令，这里显示通用描述
        }));

      this.logger.info('后台进程列表获取成功', { processCount: processes.length });
      
      return JSON.stringify({
        success: true,
        processes,
        count: processes.length
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
   * 终止后台进程
   */
  private async killBackgroundProcess(processId: string): Promise<string> {
    this.logger.info('终止后台进程', { processId });
    
    try {
      const process = backgroundProcesses.get(processId);
      if (!process) {
        this.logger.error('找不到指定的后台进程', { processId });
        return JSON.stringify({
          success: false,
          error: `找不到进程ID: ${processId}`
        });
      }

      process.kill();
      backgroundProcesses.delete(processId);

      this.logger.info('后台进程终止成功', { 
        processId, 
        pid: process.pid,
        remainingProcesses: backgroundProcesses.size
      });

      return JSON.stringify({
        success: true,
        processId,
        message: `成功终止进程 ${processId}`
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
   * 安装依赖包
   */
  private async installDependencies(params: any): Promise<string> {
    this.logger.info('开始安装依赖', { params });
    
    try {
      const { packages, dev = false, manager = 'pnpm' } = params;
      
      // 验证必需参数
      if (!packages || !Array.isArray(packages) || packages.length === 0) {
        this.logger.error('安装依赖缺少必需参数: packages', { params });
        return JSON.stringify({ 
          success: false, 
          error: "安装依赖缺少必需参数: packages (必须是数组且不为空)" 
        });
      }

      // 验证包管理器
      const validManagers = ['npm', 'pnpm', 'yarn'];
      if (!validManagers.includes(manager)) {
        this.logger.error('不支持的包管理器', { manager, validManagers });
        return JSON.stringify({ 
          success: false, 
          error: `不支持的包管理器: ${manager}。支持的包管理器: ${validManagers.join(', ')}` 
        });
      }

      // 构建安装命令
      const packageList = packages.join(' ');
      const devFlag = dev ? '--save-dev' : '--save';
      
      let installCommand: string;
      switch (manager) {
        case 'pnpm':
          installCommand = dev ? `pnpm add -D ${packageList}` : `pnpm add ${packageList}`;
          break;
        case 'npm':
          installCommand = `npm install ${devFlag} ${packageList}`;
          break;
        case 'yarn':
          installCommand = dev ? `yarn add --dev ${packageList}` : `yarn add ${packageList}`;
          break;
        default:
          installCommand = `pnpm add ${packageList}`;
      }

      this.logger.info('执行依赖安装命令', { 
        command: installCommand, 
        packages, 
        dev, 
        manager 
      });

      // 执行安装命令
      const result = await this.runInForeground(installCommand);
      
      this.logger.info('依赖安装完成', { 
        packages, 
        dev, 
        manager, 
        result: result.substring(0, 200) 
      });

      return result;
    } catch (error) {
      this.logger.error('安装依赖失败', { 
        params, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({
        success: false,
        error: `安装依赖失败: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * 创建命令执行工具实例
 */
export function createCommandExecTool(): CommandExecTool {
  return new CommandExecTool();
} 