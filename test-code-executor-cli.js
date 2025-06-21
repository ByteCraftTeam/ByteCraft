import readline from 'readline';
import { CodeExecutorTool } from './dist/utils/tools/code-executor.js';

/**
 * 代码执行工具命令行测试器
 */
class CodeExecutorCLI {
  constructor() {
    this.codeExecutor = new CodeExecutorTool();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.supportedLanguages = [
      'python', 'py', 'javascript', 'js', 'node', 'typescript', 'ts',
      'shell', 'bash', 'sh', 'powershell', 'ps1', 'cmd', 'bat',
      'go', 'rust', 'c', 'cpp'
    ];
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
🚀 代码执行工具 CLI 测试器

支持的编程语言：
  ${this.supportedLanguages.join(', ')}

使用方法：
  1. 选择编程语言
  2. 输入代码（支持多行，输入 'END' 结束）
  3. 可选：设置超时时间（秒）
  4. 可选：添加命令行参数
  5. 查看执行结果

命令：
  help    - 显示帮助
  exit    - 退出程序
  test    - 运行预设测试用例
  
`);
  }

  /**
   * 运行预设测试用例
   */
  async runTests() {
    console.log('🧪 运行预设测试用例...\n');

    const testCases = [
      {
        name: 'Python基础计算',
        language: 'python',
        code: `
x = 10
y = 20
result = x + y
print(f"计算结果: {result}")
print("Python测试成功！")
        `.trim()
      },
      {
        name: 'JavaScript数组操作',
        language: 'javascript',
        code: `
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log('数组:', numbers);
console.log('求和:', sum);
console.log('JavaScript测试成功！');
        `.trim()
      },
      {
        name: 'PowerShell系统信息',
        language: 'powershell',
        code: `
Write-Output "PowerShell测试"
Write-Output "当前日期: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output "PowerShell测试成功！"
        `.trim()
      }
    ];

    for (const testCase of testCases) {
      console.log(`📝 测试: ${testCase.name}`);
      console.log(`语言: ${testCase.language}`);
      console.log('代码:');
      console.log('```');
      console.log(testCase.code);
      console.log('```');
      
      try {
        const result = await this.executeCode(testCase.language, testCase.code);
        this.displayResult(result);
      } catch (error) {
        console.error('❌ 测试失败:', error.message);
      }
      
      console.log('─'.repeat(60));
    }
  }

  /**
   * 执行代码
   */
  async executeCode(language, code, timeout = 30, args = [], env = {}) {
    const input = JSON.stringify({
      language,
      code,
      timeout: timeout * 1000, // 转换为毫秒
      args,
      env
    });

    const resultStr = await this.codeExecutor._call(input);
    return JSON.parse(resultStr);
  }

  /**
   * 显示执行结果
   */
  displayResult(result) {
    console.log('\n📊 执行结果:');
    console.log('━'.repeat(50));
    
    if (result.success) {
      console.log('✅ 状态: 成功');
      console.log(`⏱️  执行时间: ${result.executionTime}ms`);
      
      if (result.stdout) {
        console.log('📤 输出:');
        console.log(result.stdout);
      }
      
      if (result.stderr) {
        console.log('⚠️  警告:');
        console.log(result.stderr);
      }
    } else {
      console.log('❌ 状态: 失败');
      console.log(`⏱️  执行时间: ${result.executionTime}ms`);
      
      if (result.error) {
        console.log('💥 错误信息:');
        console.log(result.error);
      }
      
      if (result.stderr) {
        console.log('📤 错误输出:');
        console.log(result.stderr);
      }
      
      if (result.stdout) {
        console.log('📤 标准输出:');
        console.log(result.stdout);
      }
    }
    
    console.log('━'.repeat(50));
  }

  /**
   * 获取用户输入
   */
  async prompt(question) {
    return new Promise(resolve => {
      this.rl.question(question, resolve);
    });
  }

  /**
   * 获取多行代码输入
   */
  async getMultilineCode() {
    console.log('📝 输入代码 (输入 "END" 结束):');
    const lines = [];
    
    while (true) {
      const line = await this.prompt('> ');
      if (line.trim() === 'END') {
        break;
      }
      lines.push(line);
    }
    
    return lines.join('\n');
  }

  /**
   * 交互式代码执行
   */
  async interactiveExecution() {
    while (true) {
      console.log('\n' + '═'.repeat(60));
      
      // 获取语言
      const language = await this.prompt(`💻 选择编程语言 (${this.supportedLanguages.slice(0, 5).join('/')}/help/test/exit): `);
      
      if (language === 'exit') {
        break;
      }
      
      if (language === 'help') {
        this.showHelp();
        continue;
      }
      
      if (language === 'test') {
        await this.runTests();
        continue;
      }
      
      if (!this.supportedLanguages.includes(language.toLowerCase())) {
        console.log(`❌ 不支持的语言: ${language}`);
        console.log(`支持的语言: ${this.supportedLanguages.join(', ')}`);
        continue;
      }

      // 获取代码
      const code = await this.getMultilineCode();
      
      if (!code.trim()) {
        console.log('❌ 代码不能为空');
        continue;
      }

      // 获取超时时间
      const timeoutStr = await this.prompt('⏱️  超时时间(秒，默认30): ');
      const timeout = timeoutStr ? parseInt(timeoutStr) : 30;

      // 获取命令行参数
      const argsStr = await this.prompt('📋 命令行参数(用空格分隔，可选): ');
      const args = argsStr ? argsStr.split(' ').filter(arg => arg.trim()) : [];

      console.log('\n🚀 正在执行代码...');
      
      try {
        const result = await this.executeCode(language, code, timeout, args);
        this.displayResult(result);
      } catch (error) {
        console.error('❌ 执行失败:', error.message);
      }
    }
  }

  /**
   * 启动CLI
   */
  async start() {
    console.log('🎉 欢迎使用代码执行工具 CLI 测试器！');
    this.showHelp();
    
    try {
      await this.interactiveExecution();
    } catch (error) {
      console.error('💥 程序异常:', error.message);
    } finally {
      this.cleanup();
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    console.log('\n👋 感谢使用，再见！');
    this.codeExecutor.cleanup();
    this.rl.close();
  }
}

// 启动CLI
const cli = new CodeExecutorCLI();
cli.start().catch(console.error);

export { CodeExecutorCLI }; 