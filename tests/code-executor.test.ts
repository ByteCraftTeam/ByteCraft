import { CodeExecutorTool } from '../src/utils/tools/code-executor.js';
import fs from 'fs';
import path from 'path';

/**
 * 代码执行工具测试类
 */
class CodeExecutorTest {
  private codeExecutor: CodeExecutorTool;

  constructor() {
    this.codeExecutor = new CodeExecutorTool();
  }

  private async callTool(input: object): Promise<any> {
    const result = await (this.codeExecutor as any)._call(JSON.stringify(input));
    return JSON.parse(result);
  }

  private assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`断言失败: ${message}`);
    }
    console.log(`✅ ${message}`);
  }

  /**
   * 测试Python代码执行
   */
  async testPythonExecution() {
    console.log('🧪 测试Python代码执行...');

    const pythonCode = `
print("Hello from Python!")
x = 10
y = 20
print("计算结果: " + str(x + y))
`;

    const result = await this.callTool({
      language: 'python',
      code: pythonCode
    });

    this.assert(result.success === true, 'Python代码执行成功');
    this.assert(result.stdout.includes('Hello from Python!'), 'Python输出正确');
    this.assert(result.stdout.includes('计算结果: 30'), 'Python计算正确');
  }

  /**
   * 测试JavaScript代码执行
   */
  async testJavaScriptExecution() {
    console.log('🧪 测试JavaScript代码执行...');

    const jsCode = `
console.log("Hello from Node.js!");
const x = 15;
const y = 25;
console.log(\`计算结果: \${x + y}\`);
`;

    const result = await this.callTool({
      language: 'javascript',
      code: jsCode
    });

    this.assert(result.success === true, 'JavaScript代码执行成功');
    this.assert(result.stdout.includes('Hello from Node.js!'), 'JavaScript输出正确');
    this.assert(result.stdout.includes('计算结果: 40'), 'JavaScript计算正确');
  }

  /**
   * 测试TypeScript代码执行
   */
  async testTypeScriptExecution() {
    console.log('🧪 测试TypeScript代码执行...');

    const tsCode = `
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const message = greet("TypeScript");
console.log(message);

const numbers: number[] = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log(\`数组和: \${sum}\`);
`;

    const result = await this.callTool({
      language: 'typescript',
      code: tsCode
    });

    this.assert(result.success === true, 'TypeScript代码执行成功');
    this.assert(result.stdout.includes('Hello, TypeScript!'), 'TypeScript输出正确');
    this.assert(result.stdout.includes('数组和: 15'), 'TypeScript计算正确');
  }

  /**
   * 测试Shell脚本执行
   */
  async testShellExecution() {
    console.log('🧪 测试Shell脚本执行...');

    const shellCode = `
echo "Hello from Shell!"
date_str=$(date +"%Y-%m-%d")
echo "今天的日期: $date_str"
`;

    const result = await this.callTool({
      language: 'shell',
      code: shellCode
    });

    this.assert(result.success === true, 'Shell脚本执行成功');
    this.assert(result.stdout.includes('Hello from Shell!'), 'Shell输出正确');
  }

  /**
   * 测试PowerShell脚本执行
   */
  async testPowerShellExecution() {
    console.log('🧪 测试PowerShell脚本执行...');

    const psCode = `
Write-Output "Hello from PowerShell!"
$date = Get-Date -Format "yyyy-MM-dd"
Write-Output "今天的日期: $date"
`;

    const result = await this.callTool({
      language: 'powershell',
      code: psCode
    });

    this.assert(result.success === true, 'PowerShell脚本执行成功');
    this.assert(result.stdout.includes('Hello from PowerShell!'), 'PowerShell输出正确');
  }

  /**
   * 测试命令行参数
   */
  async testCommandLineArgs() {
    console.log('🧪 测试命令行参数...');

    const pythonCode = `
import sys
print("参数数量: " + str(len(sys.argv)))
for i, arg in enumerate(sys.argv):
    print("参数 " + str(i) + ": " + arg)
`;

    const result = await this.callTool({
      language: 'python',
      code: pythonCode,
      args: ['arg1', 'arg2', '测试参数']
    });

    this.assert(result.success === true, '带参数的代码执行成功');
    this.assert(result.stdout.includes('arg1'), '参数传递正确');
    this.assert(result.stdout.includes('测试参数'), '中文参数传递正确');
  }

  /**
   * 测试环境变量
   */
  async testEnvironmentVariables() {
    console.log('🧪 测试环境变量...');

    const pythonCode = `
import os
test_var = os.environ.get('TEST_VAR', 'Not found')
print("TEST_VAR: " + test_var)
`;

    const result = await this.callTool({
      language: 'python',
      code: pythonCode,
      env: { TEST_VAR: 'Hello Environment!' }
    });

    this.assert(result.success === true, '带环境变量的代码执行成功');
    this.assert(result.stdout.includes('Hello Environment!'), '环境变量传递正确');
  }

  /**
   * 测试超时控制
   */
  async testTimeout() {
    console.log('🧪 测试超时控制...');

    const pythonCode = `
import time
print("开始执行...")
time.sleep(5)  # 睡眠5秒
print("执行完成")
`;

    const result = await this.callTool({
      language: 'python',
      code: pythonCode,
      timeout: 2000  // 2秒超时
    });

    this.assert(result.success === false, '超时控制工作正常');
    this.assert(result.error && result.error.includes('timeout'), '正确识别超时错误');
  }

  /**
   * 测试安全检查
   */
  async testSecurityCheck() {
    console.log('🧪 测试安全检查...');

    // 测试危险的Python代码
    const dangerousPythonCode = `
import os
os.system("rm -rf /")
`;

    const result1 = await this.callTool({
      language: 'python',
      code: dangerousPythonCode
    });

    this.assert(result1.error !== undefined, '正确拒绝危险的Python代码');
    this.assert(result1.error.includes('安全检查失败'), '安全检查消息正确');

    // 测试危险的Shell代码
    const dangerousShellCode = `rm -rf /`;

    const result2 = await this.callTool({
      language: 'shell',
      code: dangerousShellCode
    });

    this.assert(result2.error !== undefined, '正确拒绝危险的Shell代码');

    // 测试无限循环
    const infiniteLoopCode = `
while(true) {
  console.log("无限循环");
}
`;

    const result3 = await this.callTool({
      language: 'javascript',
      code: infiniteLoopCode
    });

    this.assert(result3.error !== undefined, '正确拒绝无限循环代码');
  }

  /**
   * 测试错误处理
   */
  async testErrorHandling() {
    console.log('🧪 测试错误处理...');

    // 测试语法错误
    const syntaxErrorCode = `
print("缺少括号"
`;

    const result1 = await this.callTool({
      language: 'python',
      code: syntaxErrorCode
    });

    this.assert(result1.success === false, '正确处理语法错误');
    this.assert(result1.stderr || result1.error, '包含错误信息');

    // 测试不支持的语言
    const result2 = await this.callTool({
      language: 'unsupported',
      code: 'print("test")'
    });

    this.assert(result2.error !== undefined, '正确处理不支持的语言');
    this.assert(result2.error.includes('不支持的编程语言'), '错误信息正确');

    // 测试缺少参数
    const result3 = await this.callTool({
      language: 'python'
      // 缺少code参数
    });

    this.assert(result3.error !== undefined, '正确处理缺少参数');
    this.assert(result3.error.includes('缺少必要参数'), '错误信息正确');
  }

  /**
   * 测试输出长度限制
   */
  async testOutputLimit() {
    console.log('🧪 测试输出长度限制...');

    const longOutputCode = `
for i in range(1000):
    print("这是第 " + str(i) + " 行输出，用于测试长输出处理")
`;

    const result = await this.callTool({
      language: 'python',
      code: longOutputCode
    });

    // 即使输出很长，也应该能正确处理（有缓冲区限制）
    this.assert(result.success === true || result.error, '正确处理长输出');
  }

  /**
   * 清理方法
   */
  cleanup() {
    this.codeExecutor.cleanup();
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🚀 开始运行代码执行工具测试...\n');

    try {
      await this.testPythonExecution();
      await this.testJavaScriptExecution();
      await this.testTypeScriptExecution();
      
      // 在Windows上测试PowerShell，在Unix上测试Shell
      if (process.platform === 'win32') {
        await this.testPowerShellExecution();
      } else {
        await this.testShellExecution();
      }
      
      await this.testCommandLineArgs();
      await this.testEnvironmentVariables();
      await this.testTimeout();
      await this.testSecurityCheck();
      await this.testErrorHandling();
      await this.testOutputLimit();

      console.log('\n🎉 所有测试通过！代码执行工具工作正常。');
    } catch (error) {
      console.error('\n❌ 测试失败:', error);
      throw error;
    } finally {
      this.cleanup();
    }
  }
}

/**
 * 主测试函数
 */
async function testCodeExecutor() {
  const test = new CodeExecutorTest();
  await test.runAllTests();
}

// 直接执行测试
testCodeExecutor().catch(console.error);

export { testCodeExecutor, CodeExecutorTest }; 