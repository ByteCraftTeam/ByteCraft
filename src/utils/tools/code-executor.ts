import { Tool } from '@langchain/core/tools';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { LoggerManager } from '../logger/logger.js';

const execAsync = promisify(exec);

/**
 * 代码执行工具类
 * 支持多种编程语言的代码执行，包含安全检查和超时控制
 */
export class CodeExecutorTool extends Tool {
  name = 'code_executor';
  description = `
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
  请按照上述示例的推理逻辑和格式要求，生成符合 CodeExecutorTool 接口规范的调用参数。
  `;

  private tempDir: string;
  private logger: any;
  
  // 支持的语言类型
  private readonly supportedLanguages = [
    'python', 'py',
    'javascript', 'js', 'node',
    'typescript', 'ts',
    'shell', 'bash', 'sh',
    'powershell', 'ps1',
    'cmd', 'bat',
    'go',
    'rust', 'rs',
    'c', 'cpp', 'c++'
  ];

  // 安全检查模式
  private readonly dangerousPatterns = [
    // 文件系统破坏性操作
    /rm\s+-rf\s*\//i,
    /del\s+\/[sS]\s+/i,
    /format\s+[cC]:/i,
    /rmdir\s+\/[sS]/i,
    // 网络危险操作
    /curl\s+.*\|\s*bash/i,
    /wget\s+.*\|\s*sh/i,
    /curl\s+.*\|\s*sh/i,
    // 系统命令
    /shutdown\s/i,
    /reboot\s/i,
    /halt\s/i,
    /poweroff/i,
    // 危险的Python操作
    /subprocess\.call\s*\(\s*['"](?:rm|del|format)/i,
    /os\.system\s*\(\s*['"](?:rm|del|format)/i,
    /exec\s*\(\s*['"](?:rm|del|format)/i,
    /eval\s*\(\s*['"](?:rm|del|format)/i,
    /__import__\s*\(\s*['"]subprocess/i,
    // 危险的Node.js操作
    /require\s*\(\s*['"]child_process['"]\s*\)\.exec\s*\(\s*['"](?:rm|del)/i,
    // 明显的无限循环
    /while\s*\(\s*true\s*\)\s*{[^}]*console\.log/i,
    /for\s*\(\s*;\s*;\s*\)\s*{/i,
  ];

  constructor() {
    super();
    this.tempDir = path.join(os.tmpdir(), 'bytecraft-code-exec');
    this.ensureTempDir();
    
    // 获取logger实例
    this.logger = LoggerManager.getInstance().getLogger('code-executor');
  }

  protected async _call(input: string): Promise<string> {
    try {
      this.logger.info('代码执行工具被调用', { input: input.substring(0, 200) });
      
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
          language: parsed.language,
          codeLength: parsed.code?.length,
          timeout: parsed.timeout,
          argsCount: parsed.args?.length,
          envCount: Object.keys(parsed.env || {}).length
        });
      } catch (parseError) {
        this.logger.error('JSON解析失败', { input: input.substring(0, 200), error: parseError });
        return JSON.stringify({ 
          error: `JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          input: input.substring(0, 200)
        });
      }

      const { language, code, timeout = 30000, args = [], env = {} } = parsed;

      // 验证必需参数
      if (!language) {
        this.logger.error('缺少必需参数: language', { parsed });
        return JSON.stringify({ error: "缺少必需参数: language" });
      }

      if (!code) {
        this.logger.error('缺少必需参数: code', { parsed });
        return JSON.stringify({ error: "缺少必需参数: code" });
      }

      // 验证语言支持
      if (!this.supportedLanguages.includes(language.toLowerCase())) {
        this.logger.error('不支持的编程语言', { language, supportedLanguages: this.supportedLanguages });
        return JSON.stringify({ 
          error: `不支持的编程语言: ${language}。支持的语言: ${this.supportedLanguages.join(', ')}` 
        });
      }

      // 验证代码长度
      if (code.length > 50000) {
        this.logger.error('代码长度超限', { codeLength: code.length, maxLength: 50000 });
        return JSON.stringify({ 
          error: `代码长度超限: 最大支持50KB，当前${Math.round(code.length / 1024)}KB` 
        });
      }

      // 验证超时时间
      if (timeout < 1000 || timeout > 300000) {
        this.logger.error('超时时间无效', { timeout, minTimeout: 1000, maxTimeout: 300000 });
        return JSON.stringify({ 
          error: `超时时间无效: 必须在1-300秒之间，当前${timeout}ms` 
        });
      }

      this.logger.info('开始执行代码', { 
        language, 
        codeLength: code.length, 
        timeout, 
        argsCount: args.length, 
        envCount: Object.keys(env).length 
      });

      // 安全检查
      const securityCheck = this.performSecurityCheck(code);
      if (!securityCheck.safe) {
        this.logger.error('安全检查失败', { reason: securityCheck.reason, code: code.substring(0, 200) });
        return JSON.stringify({ 
          error: `安全检查失败: ${securityCheck.reason}` 
        });
      }

      // 执行代码
      const result = await this.executeCode(language, code, timeout, args, env);
      
      this.logger.info('代码执行完成', { 
        success: result.success, 
        executionTime: result.executionTime,
        stdoutLength: result.stdout?.length,
        stderrLength: result.stderr?.length
      });
      
      return JSON.stringify(result);

    } catch (error) {
      this.logger.error('代码执行工具执行失败', { 
        error: error instanceof Error ? error.message : String(error), 
        stack: error instanceof Error ? error.stack : undefined 
      });
      return JSON.stringify({ 
        error: `代码执行失败: ${error instanceof Error ? error.message : String(error)}`,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * 执行安全检查
   * 检查代码中是否包含危险操作
   */
  private performSecurityCheck(code: string): { safe: boolean; reason?: string } {
    this.logger.info('开始安全检查', { codeLength: code.length });
    
    try {
      // 检查危险模式
      for (const pattern of this.dangerousPatterns) {
        if (pattern.test(code)) {
          this.logger.error('安全检查失败：发现危险模式', { 
            pattern: pattern.toString(),
            matchedCode: code.match(pattern)?.[0] 
          });
          return { 
            safe: false, 
            reason: `检测到危险操作: ${pattern.toString()}` 
          };
        }
      }

      this.logger.info('安全检查通过', { codeLength: code.length });
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
   * 执行代码
   * 根据语言类型选择相应的执行器
   */
  private async executeCode(
    language: string, 
    code: string, 
    timeout: number, 
    args: string[], 
    env: Record<string, string>
  ): Promise<any> {
    this.logger.info('开始执行代码', { 
      language, 
      codeLength: code.length, 
      timeout, 
      argsCount: args.length 
    });

    const startTime = Date.now();
    
    try {
      let result;
      const normalizedLanguage = language.toLowerCase();

      switch (normalizedLanguage) {
        case 'python':
        case 'py':
          result = await this.executePython(code, timeout, args, env);
          break;
        
        case 'javascript':
        case 'js':
        case 'node':
          result = await this.executeNode(code, timeout, args, env);
          break;
        
        case 'typescript':
        case 'ts':
          result = await this.executeTypeScript(code, timeout, args, env);
          break;
        
        case 'shell':
        case 'bash':
        case 'sh':
          result = await this.executeShell(code, timeout, args, env);
          break;
        
        case 'powershell':
        case 'ps1':
          result = await this.executePowerShell(code, timeout, args, env);
          break;
        
        case 'cmd':
        case 'bat':
          result = await this.executeCmd(code, timeout, args, env);
          break;
        
        case 'go':
          result = await this.executeGo(code, timeout, args, env);
          break;
        
        case 'rust':
        case 'rs':
          result = await this.executeRust(code, timeout, args, env);
          break;
        
        case 'c':
        case 'cpp':
        case 'c++':
          result = await this.executeC(code, timeout, args, env);
          break;
        
        default:
          throw new Error(`不支持的语言: ${language}`);
      }

      const executionTime = Date.now() - startTime;
      
      this.logger.info('代码执行成功', { 
        language, 
        executionTime, 
        success: result.success 
      });

      return {
        ...result,
        executionTime,
        language: normalizedLanguage
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error('代码执行失败', { 
        language, 
        executionTime, 
        error: error instanceof Error ? error.message : String(error) 
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        language: language.toLowerCase()
      };
    }
  }

  /**
   * 执行Python代码
   */
  private async executePython(code: string, timeout: number, args: string[], env: Record<string, string>) {
    this.logger.info('执行Python代码', { codeLength: code.length, timeout });
    
    // 添加UTF-8编码声明
    const pythonCode = `# -*- coding: utf-8 -*-\n${code}`;
    const tempFile = this.createTempFile(pythonCode, '.py');
    
    try {
      const command = `python "${tempFile}" ${args.join(' ')}`.trim();
      const result = await this.runCommand(command, timeout, env);
      
      this.logger.info('Python代码执行完成', { 
        success: result.success, 
        stdoutLength: result.stdout?.length 
      });
      
      return result;
    } finally {
      this.cleanupTempFile(tempFile);
    }
  }

  /**
   * 执行Node.js代码
   */
  private async executeNode(code: string, timeout: number, args: string[], env: Record<string, string>) {
    this.logger.info('执行Node.js代码', { codeLength: code.length, timeout });
    
    const tempFile = this.createTempFile(code, '.js');
    
    try {
      const command = `node "${tempFile}" ${args.join(' ')}`.trim();
      const result = await this.runCommand(command, timeout, env);
      
      this.logger.info('Node.js代码执行完成', { 
        success: result.success, 
        stdoutLength: result.stdout?.length 
      });
      
      return result;
    } finally {
      this.cleanupTempFile(tempFile);
    }
  }

  /**
   * 执行TypeScript代码
   */
  private async executeTypeScript(code: string, timeout: number, args: string[], env: Record<string, string>) {
    this.logger.info('执行TypeScript代码', { codeLength: code.length, timeout });
    
    const tempFile = this.createTempFile(code, '.ts');
    
    try {
      // 使用tsx执行TypeScript代码
      const command = `npx tsx "${tempFile}" ${args.join(' ')}`.trim();
      const result = await this.runCommand(command, timeout, env);
      
      this.logger.info('TypeScript代码执行完成', { 
        success: result.success, 
        stdoutLength: result.stdout?.length 
      });
      
      return result;
    } finally {
      this.cleanupTempFile(tempFile);
    }
  }

  /**
   * 执行Shell脚本
   */
  private async executeShell(code: string, timeout: number, args: string[], env: Record<string, string>) {
    this.logger.info('执行Shell脚本', { codeLength: code.length, timeout });
    
    const tempFile = this.createTempFile(code, '.sh');
    
    try {
      // 确保脚本可执行
      fs.chmodSync(tempFile, 0o755);
      const command = `bash "${tempFile}" ${args.join(' ')}`.trim();
      const result = await this.runCommand(command, timeout, env);
      
      this.logger.info('Shell脚本执行完成', { 
        success: result.success, 
        stdoutLength: result.stdout?.length 
      });
      
      return result;
    } finally {
      this.cleanupTempFile(tempFile);
    }
  }

  /**
   * 执行PowerShell脚本
   */
  private async executePowerShell(code: string, timeout: number, args: string[], env: Record<string, string>) {
    this.logger.info('执行PowerShell脚本', { codeLength: code.length, timeout });
    
    const tempFile = this.createTempFile(code, '.ps1');
    
    try {
      const command = `powershell -ExecutionPolicy Bypass -File "${tempFile}" ${args.join(' ')}`.trim();
      const result = await this.runCommand(command, timeout, env);
      
      this.logger.info('PowerShell脚本执行完成', { 
        success: result.success, 
        stdoutLength: result.stdout?.length 
      });
      
      return result;
    } finally {
      this.cleanupTempFile(tempFile);
    }
  }

  /**
   * 执行Windows命令脚本
   */
  private async executeCmd(code: string, timeout: number, args: string[], env: Record<string, string>) {
    this.logger.info('执行Windows命令脚本', { codeLength: code.length, timeout });
    
    const tempFile = this.createTempFile(code, '.bat');
    
    try {
      const command = `cmd /c "${tempFile}" ${args.join(' ')}`.trim();
      const result = await this.runCommand(command, timeout, env);
      
      this.logger.info('Windows命令脚本执行完成', { 
        success: result.success, 
        stdoutLength: result.stdout?.length 
      });
      
      return result;
    } finally {
      this.cleanupTempFile(tempFile);
    }
  }

  /**
   * 执行Go代码
   */
  private async executeGo(code: string, timeout: number, args: string[], env: Record<string, string>) {
    this.logger.info('执行Go代码', { codeLength: code.length, timeout });
    
    const tempFile = this.createTempFile(code, '.go');
    
    try {
      const command = `go run "${tempFile}" ${args.join(' ')}`.trim();
      const result = await this.runCommand(command, timeout, env);
      
      this.logger.info('Go代码执行完成', { 
        success: result.success, 
        stdoutLength: result.stdout?.length 
      });
      
      return result;
    } finally {
      this.cleanupTempFile(tempFile);
    }
  }

  /**
   * 执行Rust代码
   */
  private async executeRust(code: string, timeout: number, args: string[], env: Record<string, string>) {
    this.logger.info('执行Rust代码', { codeLength: code.length, timeout });
    
    const tempFile = this.createTempFile(code, '.rs');
    
    try {
      const command = `rustc "${tempFile}" -o "${tempFile}.exe" && "${tempFile}.exe" ${args.join(' ')}`.trim();
      const result = await this.runCommand(command, timeout, env);
      
      this.logger.info('Rust代码执行完成', { 
        success: result.success, 
        stdoutLength: result.stdout?.length 
      });
      
      return result;
    } finally {
      this.cleanupTempFile(tempFile);
      this.cleanupTempFile(`${tempFile}.exe`);
    }
  }

  /**
   * 执行C/C++代码
   */
  private async executeC(code: string, timeout: number, args: string[], env: Record<string, string>) {
    this.logger.info('执行C/C++代码', { codeLength: code.length, timeout });
    
    const tempFile = this.createTempFile(code, '.c');
    
    try {
      const command = `gcc "${tempFile}" -o "${tempFile}.exe" && "${tempFile}.exe" ${args.join(' ')}`.trim();
      const result = await this.runCommand(command, timeout, env);
      
      this.logger.info('C/C++代码执行完成', { 
        success: result.success, 
        stdoutLength: result.stdout?.length 
      });
      
      return result;
    } finally {
      this.cleanupTempFile(tempFile);
      this.cleanupTempFile(`${tempFile}.exe`);
    }
  }

  /**
   * 运行命令
   * 统一的命令执行接口，支持超时和环境变量
   */
  private async runCommand(command: string, timeout: number, env: Record<string, string>) {
    this.logger.info('运行命令', { command, timeout, envCount: Object.keys(env).length });
    
    return new Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>((resolve) => {
      const startTime = Date.now();
      
      // 合并环境变量
      const processEnv = { ...process.env, ...env };
      
      const child = spawn(command, [], {
        shell: true,
        env: processEnv,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let isResolved = false;

      // 设置超时
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          child.kill('SIGTERM');
          
          const executionTime = Date.now() - startTime;
          this.logger.error('命令执行超时', { command, executionTime, timeout });
          
          resolve({
            success: false,
            error: `命令执行超时 (${timeout}ms)`,
            stdout,
            stderr
          });
        }
      }, timeout);

      // 收集输出
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // 处理完成
      child.on('close', (code) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          
          const executionTime = Date.now() - startTime;
          const success = code === 0;
          
          this.logger.info('命令执行完成', { 
            command, 
            code, 
            success, 
            executionTime,
            stdoutLength: stdout.length,
            stderrLength: stderr.length
          });
          
          resolve({
            success,
            stdout: stdout || undefined,
            stderr: stderr || undefined,
            error: success ? undefined : `命令执行失败，退出码: ${code}`
          });
        }
      });

      // 处理错误
      child.on('error', (error) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          
          this.logger.error('命令执行错误', { command, error: error.message });
          
          resolve({
            success: false,
            error: `命令执行错误: ${error.message}`,
            stdout,
            stderr
          });
        }
      });
    });
  }

  /**
   * 创建临时文件
   */
  private createTempFile(content: string, extension: string): string {
    this.logger.info('创建临时文件', { contentLength: content.length, extension });
    
    const tempFile = path.join(this.tempDir, `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${extension}`);
    
    try {
      fs.writeFileSync(tempFile, content, 'utf8');
      this.logger.info('临时文件创建成功', { tempFile });
      return tempFile;
    } catch (error) {
      this.logger.error('临时文件创建失败', { tempFile, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * 清理临时文件
   */
  private cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.info('临时文件清理成功', { filePath });
      }
    } catch (error) {
      this.logger.error('临时文件清理失败', { filePath, error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * 确保临时目录存在
   */
  private ensureTempDir(): void {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
        this.logger.info('临时目录创建成功', { tempDir: this.tempDir });
      }
    } catch (error) {
      this.logger.error('临时目录创建失败', { tempDir: this.tempDir, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * 清理所有临时文件
   */
  public cleanup(): void {
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
        this.logger.info('临时目录清理成功', { tempDir: this.tempDir });
      }
    } catch (error) {
      this.logger.error('临时目录清理失败', { tempDir: this.tempDir, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

/**
 * 创建代码执行工具实例
 */
export function createCodeExecutorTool(): CodeExecutorTool {
  return new CodeExecutorTool();
} 