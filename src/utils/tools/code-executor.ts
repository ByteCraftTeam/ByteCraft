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

  CodeExecutorTool 是一个代码执行工具，支持多种编程语言的安全代码执行，包含超时控制和安全检查功能。下面是一些简单的示例，可以用来调用工具。
  示例 1：
  问题：执行简单的Python计算
  推理：选择python语言→编写计算代码→使用默认超时
  输入：{"language":"python","code":"x = 10\\ny = 20\\nprint('结果:', x + y)"}
  预期输出：{"success": true, "stdout": "结果: 30", "executionTime": 245}
  
  示例 2：
  问题：运行JavaScript代码并传递参数
  推理：选择javascript语言→编写处理参数的代码→传递命令行参数
  输入：{"language":"javascript","code":"console.log('参数:', process.argv.slice(2))","args":["arg1","arg2"]}
  预期输出：{"success": true, "stdout": "参数: ['arg1', 'arg2']"}
  
  示例 3：
  问题：执行TypeScript代码定义类型
  推理：选择typescript语言→编写带类型的代码→使用tsx执行
  输入：{"language":"typescript","code":"interface User { name: string; age: number }\\nconst user: User = { name: 'Alice', age: 30 };\\nconsole.log(user);"}
  预期输出：{"success": true, "stdout": "{ name: 'Alice', age: 30 }"}
  
  ## 思维链调用流程
  问题分析：确定编程语言类型，检查必填参数（language、code），评估代码安全性
  安全检查：扫描危险模式（文件系统操作、网络访问、系统命令、无限循环等）
  参数构造：按格式 {"language":"...","code":"...","timeout":...} 组装JSON
  执行控制：设置超时限制、环境变量、命令行参数等执行上下文
  
  ## 语言支持映射表
  python/py：Python代码执行，支持标准库，自动添加UTF-8编码声明
  javascript/js/node：Node.js环境执行，支持ES6+语法和NPM模块
  typescript/ts：TypeScript代码编译执行，支持类型检查
  shell/bash/sh：Shell脚本执行，跨平台兼容处理
  powershell/ps1：PowerShell脚本执行，Windows原生支持
  go：Go语言代码编译执行
  rust/rs：Rust代码编译执行
  c/cpp/c++：C/C++代码编译执行
  
  ## 安全约束
  危险操作拦截：禁止文件系统破坏性操作（rm -rf, del /s等）
  系统命令限制：阻止系统关机、重启等危险命令
  模块导入检查：限制危险模块使用（subprocess等高危模块）  
  代码长度限制：单次执行代码不超过50KB
  执行时间控制：默认30秒超时，可自定义设置
  
  ## 多场景调用示例
  带环境变量：{"language":"python","code":"import os\\nprint(os.environ.get('MY_VAR'))","env":{"MY_VAR":"test_value"}}
  设置超时：{"language":"javascript","code":"setTimeout(() => console.log('完成'), 1000);","timeout":5000}
  传递参数：{"language":"shell","code":"echo \\"参数: $1 $2\\"","args":["hello","world"]}
  
  ## 错误处理示例
  问题：代码执行返回 "安全检查失败"
  推理：检查代码发现包含危险操作 → 移除危险操作 → 重新构造输入
  问题：执行超时
  推理：代码包含长时间运行逻辑 → 增加timeout参数或优化代码逻辑 → 重新执行
  
  请按照上述示例的推理逻辑和格式要求，生成符合 CodeExecutorTool 接口规范的调用参数。确保输入为合法JSON字符串，且代码通过安全检查。
  `;

  private tempDir: string;
  private logger: any;
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

  // 更新安全检查模式，允许常用模块但阻止危险操作
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
    // 危险的Python操作 - 更精确的匹配
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
    
    // 获取logger实例，如果失败则使用console
    try {
      this.logger = LoggerManager.getInstance().getLogger('code-executor');
    } catch (error) {
      this.logger = {
        info: (...args: any[]) => console.log('[INFO]', ...args),
        error: (...args: any[]) => console.error('[ERROR]', ...args),
        warn: (...args: any[]) => console.warn('[WARN]', ...args),
      };
    }
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
        this.logger.info('JSON解析成功', { parsed: { ...parsed, code: parsed.code?.substring(0, 100) } });
      } catch (parseError) {
        this.logger.error('JSON解析失败', { input: input.substring(0, 200), error: parseError });
        return JSON.stringify({ 
          error: `JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          input: input.substring(0, 200)
        });
      }

      const { language, code, timeout = 30000, args = [], env = {} } = parsed;

      // 验证输入
      if (!language || !code) {
        this.logger.error('缺少必要参数', { language, code: !!code });
        return JSON.stringify({ 
          error: "缺少必要参数: language 和 code" 
        });
      }

      if (!this.supportedLanguages.includes(language.toLowerCase())) {
        this.logger.error('不支持的编程语言', { language, supportedLanguages: this.supportedLanguages });
        return JSON.stringify({ 
          error: `不支持的编程语言: ${language}。支持的语言: ${this.supportedLanguages.join(', ')}` 
        });
      }

      this.logger.info('开始执行代码', { language, codeLength: code.length, timeout, args, env });

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
      this.logger.info('代码执行完成', { success: result.success, executionTime: result.executionTime });
      return JSON.stringify(result);

    } catch (error) {
      this.logger.error('代码执行工具执行失败', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
      return JSON.stringify({ 
        error: `代码执行失败: ${error instanceof Error ? error.message : String(error)}`,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * 安全检查 - 改进版本，更加精确
   */
  private performSecurityCheck(code: string): { safe: boolean; reason?: string } {
    // 检查危险模式
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(code)) {
        return { 
          safe: false, 
          reason: `检测到潜在危险操作: ${pattern.source}` 
        };
      }
    }

    // 检查代码长度
    if (code.length > 50000) {
      return { 
        safe: false, 
        reason: "代码长度超过限制 (50KB)" 
      };
    }

    return { safe: true };
  }

  /**
   * 执行代码 - 改进版本
   */
  private async executeCode(
    language: string, 
    code: string, 
    timeout: number, 
    args: string[], 
    env: Record<string, string>
  ): Promise<any> {
    const startTime = Date.now();
    let tempFile: string | null = null;

    try {
      // 根据语言类型执行代码
      switch (language.toLowerCase()) {
        case 'python':
        case 'py':
          return await this.executePython(code, timeout, args, env);
        
        case 'javascript':
        case 'js':
        case 'node':
          return await this.executeNode(code, timeout, args, env);
        
        case 'typescript':
        case 'ts':
          return await this.executeTypeScript(code, timeout, args, env);
        
        case 'shell':
        case 'bash':
        case 'sh':
          return await this.executeShell(code, timeout, args, env);
        
        case 'powershell':
        case 'ps1':
          return await this.executePowerShell(code, timeout, args, env);
        
        case 'cmd':
        case 'bat':
          return await this.executeCmd(code, timeout, args, env);
        
        case 'go':
          return await this.executeGo(code, timeout, args, env);
        
        case 'rust':
        case 'rs':
          return await this.executeRust(code, timeout, args, env);
        
        case 'c':
        case 'cpp':
        case 'c++':
          return await this.executeC(code, timeout, args, env);
        
        default:
          throw new Error(`语言 ${language} 暂未实现`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    } finally {
      // 清理临时文件
      if (tempFile && fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          // 忽略清理错误
        }
      }
    }
  }

  /**
   * 执行Python代码 - 改进版本
   */
  private async executePython(code: string, timeout: number, args: string[], env: Record<string, string>) {
    // 为Python代码添加UTF-8编码声明
    const pythonCodeWithEncoding = `# -*- coding: utf-8 -*-\n${code}`;
    const tempFile = this.createTempFile(pythonCodeWithEncoding, '.py');
    
    // 在Windows上尝试不同的Python命令
    let pythonCmd = 'python';
    if (os.platform() === 'win32') {
      try {
        await execAsync('python --version', { timeout: 5000 });
        pythonCmd = 'python';
      } catch {
        try {
          await execAsync('python3 --version', { timeout: 5000 });
          pythonCmd = 'python3';
        } catch {
          try {
            await execAsync('py --version', { timeout: 5000 });
            pythonCmd = 'py';
          } catch {
            return {
              success: false,
              error: 'Python未安装或不在PATH中',
              stdout: '',
              stderr: 'Python command not found',
              executionTime: 0
            };
          }
        }
      }
    }
    
    const command = `"${pythonCmd}" "${tempFile}" ${args.join(' ')}`;
    return await this.runCommand(command, timeout, env);
  }

  /**
   * 执行Node.js代码 - 改进版本
   */
  private async executeNode(code: string, timeout: number, args: string[], env: Record<string, string>) {
    const tempFile = this.createTempFile(code, '.js');
    const command = `node "${tempFile}" ${args.join(' ')}`;
    return await this.runCommand(command, timeout, env);
  }

  /**
   * 执行TypeScript代码 - 改进版本
   */
  private async executeTypeScript(code: string, timeout: number, args: string[], env: Record<string, string>) {
    const tempFile = this.createTempFile(code, '.ts');
    
    // 尝试不同的TypeScript执行方式
    try {
      await execAsync('tsx --version', { timeout: 5000 });
      const command = `npx tsx "${tempFile}" ${args.join(' ')}`;
      return await this.runCommand(command, timeout, env);
    } catch {
      try {
        await execAsync('ts-node --version', { timeout: 5000 });
        const command = `npx ts-node "${tempFile}" ${args.join(' ')}`;
        return await this.runCommand(command, timeout, env);
      } catch {
        return {
          success: false,
          error: 'TypeScript执行器未安装 (需要tsx或ts-node)',
          stdout: '',
          stderr: 'TypeScript executor not found',
          executionTime: 0
        };
      }
    }
  }

  /**
   * 执行Shell脚本 - 改进版本
   */
  private async executeShell(code: string, timeout: number, args: string[], env: Record<string, string>) {
    const tempFile = this.createTempFile(code, '.sh');
    
    if (os.platform() === 'win32') {
      // Windows上优先使用Git Bash
      try {
        await execAsync('bash --version', { timeout: 5000 });
        const command = `bash "${tempFile}" ${args.join(' ')}`;
        return await this.runCommand(command, timeout, env);
      } catch {
        // fallback到cmd
        const batFile = this.createTempFile(code.replace(/#!/g, 'REM '), '.bat');
        const command = `"${batFile}" ${args.join(' ')}`;
        return await this.runCommand(command, timeout, env);
      }
    } else {
      // Unix系统
      const command = `chmod +x "${tempFile}" && "${tempFile}" ${args.join(' ')}`;
      return await this.runCommand(command, timeout, env);
    }
  }

  /**
   * 执行PowerShell脚本 - 改进版本
   */
  private async executePowerShell(code: string, timeout: number, args: string[], env: Record<string, string>) {
    const tempFile = this.createTempFile(code, '.ps1');
    const command = `powershell -ExecutionPolicy Bypass -File "${tempFile}" ${args.map(arg => `"${arg}"`).join(' ')}`;
    return await this.runCommand(command, timeout, env);
  }

  /**
   * 执行CMD批处理 - 新增
   */
  private async executeCmd(code: string, timeout: number, args: string[], env: Record<string, string>) {
    const tempFile = this.createTempFile(code, '.bat');
    const command = `"${tempFile}" ${args.join(' ')}`;
    return await this.runCommand(command, timeout, env);
  }

  /**
   * 执行Go代码
   */
  private async executeGo(code: string, timeout: number, args: string[], env: Record<string, string>) {
    const tempFile = this.createTempFile(code, '.go');
    const command = `go run "${tempFile}" ${args.join(' ')}`;
    return await this.runCommand(command, timeout, env);
  }

  /**
   * 执行Rust代码
   */
  private async executeRust(code: string, timeout: number, args: string[], env: Record<string, string>) {
    const tempFile = this.createTempFile(code, '.rs');
    const outputFile = tempFile.replace('.rs', os.platform() === 'win32' ? '.exe' : '');
    const command = `rustc "${tempFile}" -o "${outputFile}" && "${outputFile}" ${args.join(' ')}`;
    return await this.runCommand(command, timeout, env);
  }

  /**
   * 执行C/C++代码
   */
  private async executeC(code: string, timeout: number, args: string[], env: Record<string, string>) {
    const tempFile = this.createTempFile(code, '.c');
    const outputFile = tempFile.replace('.c', os.platform() === 'win32' ? '.exe' : '');
    const command = `gcc "${tempFile}" -o "${outputFile}" && "${outputFile}" ${args.join(' ')}`;
    return await this.runCommand(command, timeout, env);
  }

  /**
   * 运行命令 - 改进版本
   */
  private async runCommand(command: string, timeout: number, env: Record<string, string>) {
    const startTime = Date.now();
    
    try {
      this.logger.info('正在执行命令', { command: command.replace(this.tempDir, '<temp>') });
      
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        env: { ...process.env, ...env },
        cwd: this.tempDir,
        maxBuffer: 1024 * 1024, // 1MB buffer
        encoding: 'utf8'
      });

      const result = {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        executionTime: Date.now() - startTime,
        command: command.replace(this.tempDir, '<temp>')
      };
      
      this.logger.info('命令执行成功', { executionTime: result.executionTime });
      return result;
      
    } catch (error: any) {
      const result = {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        error: error.message,
        executionTime: Date.now() - startTime,
        command: command.replace(this.tempDir, '<temp>'),
        exitCode: error.code
      };
      
      this.logger.error('命令执行失败', { error: error.message, exitCode: error.code });
      return result;
    }
  }

  /**
   * 创建临时文件
   */
  private createTempFile(content: string, extension: string): string {
    const filename = `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${extension}`;
    const filepath = path.join(this.tempDir, filename);
    fs.writeFileSync(filepath, content, 'utf8');
    return filepath;
  }

  /**
   * 确保临时目录存在
   */
  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 清理临时文件
   */
  public cleanup(): void {
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('清理临时文件失败:', error);
    }
  }
}

/**
 * 创建代码执行工具实例
 */
export function createCodeExecutorTool(): CodeExecutorTool {
  return new CodeExecutorTool();
} 