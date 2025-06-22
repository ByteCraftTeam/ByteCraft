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
  CommandExecTool 调用指南

  CommandExecTool 是一个命令执行工具，支持前台和后台命令执行，以及进程管理功能。
  
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
  请按照上述示例的推理逻辑和格式要求，生成符合 CommandExecTool 接口规范的调用参数。
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
}

/**
 * 创建命令执行工具实例
 */
export function createCommandExecTool(): CommandExecTool {
  return new CommandExecTool();
} 