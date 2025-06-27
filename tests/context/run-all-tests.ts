#!/usr/bin/env tsx

/**
 * 运行所有上下文管理测试的主入口文件
 * 可以单独运行特定测试或运行完整测试套件
 */

import { runAllContextManagerTests } from './context-manager.test.js';
import { runSensitiveInfoFilterTests } from './sensitive-info-filter.test.js';
import { runTruncationStrategyTests } from './truncation-strategies.test.js';
import { runDualHistoryCurationTests } from './dual-history-curation.test.js';

/**
 * 解析命令行参数
 */
function parseArguments(): { testSuite?: string; help?: boolean } {
  const args = process.argv.slice(2);
  const result: { testSuite?: string; help?: boolean } = {};
  
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg.startsWith('--test=')) {
      result.testSuite = arg.split('=')[1];
    } else if (!arg.startsWith('-')) {
      result.testSuite = arg;
    }
  }
  
  return result;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
🧪 ByteCraft 上下文管理测试套件

用法:
  tsx tests/run-all-tests.ts [选项] [测试套件]

选项:
  -h, --help              显示此帮助信息
  --test=<套件名>          运行指定的测试套件

可用的测试套件:
  all                     运行所有测试 (默认)
  context                 基础上下文管理测试
  sensitive               敏感信息过滤测试
  truncation              截断策略测试
  curation                双重历史策划测试

示例:
  tsx tests/run-all-tests.ts                    # 运行所有测试
  tsx tests/run-all-tests.ts context           # 运行上下文管理测试
  tsx tests/run-all-tests.ts --test=sensitive  # 运行敏感信息过滤测试
`);
}

/**
 * 运行指定的测试套件
 */
async function runTestSuite(suiteName: string) {
  console.log(`🎬 开始运行测试套件: ${suiteName}\n`);
  
  const startTime = Date.now();
  
  try {
    switch (suiteName.toLowerCase()) {
      case 'context':
        await runAllContextManagerTests();
        break;
        
      case 'sensitive':
        await runSensitiveInfoFilterTests();
        break;
        
      case 'truncation':
        await runTruncationStrategyTests();
        break;
        
      case 'curation':
        await runDualHistoryCurationTests();
        break;
        
      case 'all':
      default:
        console.log('📋 运行完整测试套件...\n');
        
        console.log('=' .repeat(60));
        await runAllContextManagerTests();
        
        console.log('\n' + '='.repeat(60));
        await runSensitiveInfoFilterTests();
        
        console.log('\n' + '='.repeat(60));
        await runTruncationStrategyTests();
        
        console.log('\n' + '='.repeat(60));
        await runDualHistoryCurationTests();
        
        console.log('\n' + '='.repeat(60));
        break;
    }
    
    const endTime = Date.now();
    console.log(`\n🎉 测试套件 "${suiteName}" 执行完成！`);
    console.log(`⏱️  总耗时: ${endTime - startTime}ms`);
    
  } catch (error) {
    console.error(`\n💥 测试套件 "${suiteName}" 执行失败:`, error);
    process.exit(1);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 ByteCraft 上下文管理测试工具\n');
  
  const { testSuite, help } = parseArguments();
  
  if (help) {
    showHelp();
    return;
  }
  
  const suite = testSuite || 'all';
  
  // 验证测试套件名称
  const validSuites = ['all', 'context', 'sensitive', 'truncation', 'curation'];
  if (!validSuites.includes(suite.toLowerCase())) {
    console.error(`❌ 无效的测试套件: ${suite}`);
    console.error(`可用的测试套件: ${validSuites.join(', ')}`);
    process.exit(1);
  }
  
  await runTestSuite(suite);
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 程序执行失败:', error);
    process.exit(1);
  });
}

export { runTestSuite, main };