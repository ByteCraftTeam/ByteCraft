/**
 * Prompt 系统测试文件
 * 验证所有组件是否正常工作
 */

import { 
  PromptManager, 
  createPromptManager, 
  TOOL_NAMES,
  defaultPromptOptions,
  createAgentPromptIntegration,
  presetConfigs
} from './index.js';

// 测试基础功能
export function testBasicFunctionality() {
  console.log('🧪 测试基础功能...');
  
  try {
    // 创建编程模式管理器
    const codingManager = createPromptManager('coding');
    console.log('✅ 编程模式管理器创建成功');
    
    // 创建分析模式管理器
    const askManager = new PromptManager('ask');
    console.log('✅ 分析模式管理器创建成功');
    
    // 测试系统提示词生成
    const systemPrompt = codingManager.formatSystemPrompt({
      language: '中文',
      availableTools: [TOOL_NAMES.FILE_MANAGER, TOOL_NAMES.COMMAND_EXEC]
    });
    
    if (systemPrompt && systemPrompt.length > 0) {
      console.log('✅ 系统提示词生成成功');
    } else {
      throw new Error('系统提示词生成失败');
    }
    
    return true;
  } catch (error) {
    console.error('❌ 基础功能测试失败:', error);
    return false;
  }
}

// 测试工具描述
export function testToolDescriptions() {
  console.log('\n🧪 测试工具描述...');
  
  try {
    const manager = createPromptManager('coding');
    
    // 测试所有工具的描述
    const tools = [
      TOOL_NAMES.FILE_MANAGER,
      TOOL_NAMES.COMMAND_EXEC,
      TOOL_NAMES.CODE_EXECUTOR,
      TOOL_NAMES.WEB_SEARCH,
      TOOL_NAMES.WEATHER
    ];
    
    for (const tool of tools) {
      const description = manager.getToolDescription(tool);
      if (description && description.length > 0) {
        console.log(`✅ ${tool} 工具描述获取成功`);
      } else {
        console.log(`⚠️ ${tool} 工具描述为空`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ 工具描述测试失败:', error);
    return false;
  }
}

// 测试文件格式化
export function testFileFormatting() {
  console.log('\n🧪 测试文件格式化...');
  
  try {
    const manager = createPromptManager('coding');
    
    const testFiles = [
      {
        path: 'src/test.ts',
        content: 'console.log("Hello, World!");'
      },
      {
        path: 'README.md',
        content: '# Test Project\n\nThis is a test.',
        isReadonly: true
      }
    ];
    
    const formatted = manager.formatFilesContent(testFiles);
    
    if (formatted.includes('src/test.ts') && formatted.includes('README.md')) {
      console.log('✅ 文件格式化成功');
      return true;
    } else {
      throw new Error('文件格式化结果不正确');
    }
  } catch (error) {
    console.error('❌ 文件格式化测试失败:', error);
    return false;
  }
}

// 测试模式切换
export function testModeSwitching() {
  console.log('\n🧪 测试模式切换...');
  
  try {
    const manager = createPromptManager('coding');
    
    // 检查初始模式
    if (manager.getCurrentMode() !== 'coding') {
      throw new Error('初始模式不正确');
    }
    console.log('✅ 初始模式检查通过');
    
    // 切换到分析模式
    manager.switchMode('ask');
    if (manager.getCurrentMode() !== 'ask') {
      throw new Error('模式切换失败');
    }
    console.log('✅ 模式切换成功');
    
    // 检查模式配置
    const config = manager.getModeConfig();
    if (!config.canAnalyzeOnly || config.canEditFiles) {
      throw new Error('分析模式配置不正确');
    }
    console.log('✅ 模式配置检查通过');
    
    return true;
  } catch (error) {
    console.error('❌ 模式切换测试失败:', error);
    return false;
  }
}

// 测试集成功能
export function testIntegration() {
  console.log('\n🧪 测试集成功能...');
  
  try {
    // 使用预设配置创建集成
    const integration = createAgentPromptIntegration({
      ...presetConfigs.developer,
      projectContext: {
        name: 'TestProject',
        type: 'Web App',
        language: 'TypeScript',
        framework: 'React'
      }
    });
    
    console.log('✅ 集成对象创建成功');
    
    // 测试权限检查
    if (!integration.canPerformAction('edit')) {
      throw new Error('开发模式应该允许编辑');
    }
    console.log('✅ 权限检查通过');
    
    // 测试工具帮助
    const help = integration.getToolHelp('file-manager');
    if (!help || help.length === 0) {
      throw new Error('工具帮助获取失败');
    }
    console.log('✅ 工具帮助获取成功');
    
    // 测试结果格式化
    const successMsg = integration.formatToolResult('file_manager', true, '操作成功');
    const errorMsg = integration.formatToolResult('file_manager', false, undefined, '操作失败');
    
    if (!successMsg.includes('成功') || !errorMsg.includes('失败')) {
      throw new Error('结果格式化不正确');
    }
    console.log('✅ 结果格式化成功');
    
    return true;
  } catch (error) {
    console.error('❌ 集成功能测试失败:', error);
    return false;
  }
}

// 测试项目上下文
export function testProjectContext() {
  console.log('\n🧪 测试项目上下文...');
  
  try {
    const manager = createPromptManager('coding');
    
    const prompt = manager.formatSystemPrompt({
      language: '中文',
      projectContext: {
        name: 'ByteCraft',
        type: 'AI Assistant',
        language: 'TypeScript',
        framework: 'Node.js'
      }
    });
    
    if (!prompt.includes('ByteCraft') || !prompt.includes('TypeScript')) {
      throw new Error('项目上下文未正确包含');
    }
    
    console.log('✅ 项目上下文测试通过');
    return true;
  } catch (error) {
    console.error('❌ 项目上下文测试失败:', error);
    return false;
  }
}

// 运行所有测试
export function runAllTests() {
  console.log('🚀 开始运行 Prompt 系统测试\n');
  
  const tests = [
    { name: '基础功能', test: testBasicFunctionality },
    { name: '工具描述', test: testToolDescriptions },
    { name: '文件格式化', test: testFileFormatting },
    { name: '模式切换', test: testModeSwitching },
    { name: '集成功能', test: testIntegration },
    { name: '项目上下文', test: testProjectContext }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, test } of tests) {
    console.log(`\n📋 运行测试: ${name}`);
    if (test()) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`);
  
  if (failed === 0) {
    console.log('🎉 所有测试通过！Prompt 系统已准备就绪！');
  } else {
    console.log('⚠️ 有测试失败，请检查相关功能');
  }
  
  return { passed, failed };
}

// 导出测试函数
export default runAllTests;
