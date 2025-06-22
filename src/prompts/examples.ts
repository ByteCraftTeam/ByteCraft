/**
 * ByteCraft Prompt 系统使用示例
 * 
 * 这个文件展示了如何使用新的 prompt 系统
 */

import { 
  PromptManager, 
  createPromptManager, 
  defaultPromptOptions,
  TOOL_NAMES,
  type PromptOptions,
  type FileInfo
} from './index.js';

// 示例 1: 创建编程模式的 prompt 管理器
export function example1_BasicUsage() {
  console.log('=== 示例 1: 基本使用 ===');
  
  // 创建编程模式的管理器
  const promptManager = createPromptManager('coding');
  
  // 格式化系统提示词
  const systemPrompt = promptManager.formatSystemPrompt({
    language: '中文',
    availableTools: [TOOL_NAMES.FILE_MANAGER, TOOL_NAMES.COMMAND_EXEC],
    finalReminders: ['确保代码安全', '遵循最佳实践']
  });
  
  console.log('系统提示词:', systemPrompt.substring(0, 200) + '...');
}

// 示例 2: 分析模式
export function example2_AskMode() {
  console.log('\n=== 示例 2: 分析模式 ===');
  
  const promptManager = new PromptManager('ask');
  
  const systemPrompt = promptManager.formatSystemPrompt({
    language: '中文',
    availableTools: [TOOL_NAMES.FILE_MANAGER, TOOL_NAMES.WEB_SEARCH]
  });
  
  console.log('分析模式提示词:', systemPrompt.substring(0, 200) + '...');
}

// 示例 3: 格式化文件内容
export function example3_FormatFiles() {
  console.log('\n=== 示例 3: 格式化文件内容 ===');
  
  const promptManager = createPromptManager('coding');
  
  const files: FileInfo[] = [
    {
      path: 'src/index.ts',
      content: 'export * from "./app";\nconsole.log("Hello ByteCraft");'
    },
    {
      path: 'src/config.json',
      content: '{"name": "ByteCraft", "version": "1.0.0"}',
      isReadonly: true
    }
  ];
  
  const filesMessage = promptManager.formatFilesContent(files);
  console.log('文件内容消息:', filesMessage);
}

// 示例 4: 工具描述
export function example4_ToolDescriptions() {
  console.log('\n=== 示例 4: 工具描述 ===');
  
  const promptManager = createPromptManager('coding');
  
  // 获取文件管理工具的详细说明
  const fileManagerHelp = promptManager.getToolDescription(TOOL_NAMES.FILE_MANAGER);
  console.log('文件管理工具说明:', fileManagerHelp.substring(0, 200) + '...');
  
  // 获取命令执行工具的说明
  const commandExecHelp = promptManager.getToolDescription(TOOL_NAMES.COMMAND_EXEC);
  console.log('命令执行工具说明:', commandExecHelp.substring(0, 200) + '...');
}

// 示例 5: 项目上下文
export function example5_ProjectContext() {
  console.log('\n=== 示例 5: 项目上下文 ===');
  
  const promptManager = createPromptManager('coding');
  
  const options: PromptOptions = {
    ...defaultPromptOptions,
    availableTools: [TOOL_NAMES.FILE_MANAGER, TOOL_NAMES.CODE_EXECUTOR],
    projectContext: {
      name: 'ByteCraft',
      type: 'AI Assistant',
      language: 'TypeScript',
      framework: 'Node.js'
    }
  };
  
  const systemPrompt = promptManager.formatSystemPrompt(options);
  console.log('带项目上下文的提示词:', systemPrompt.substring(0, 300) + '...');
}

// 示例 6: 工具执行结果处理
export function example6_ToolResults() {
  console.log('\n=== 示例 6: 工具执行结果 ===');
  
  const promptManager = createPromptManager('coding');
  
  // 成功消息
  const successMsg = promptManager.getToolSuccessMessage('file_manager', '文件创建成功');
  console.log('成功消息:', successMsg);
  
  // 错误消息
  const errorMsg = promptManager.getToolErrorMessage('文件不存在', 'file_manager');
  console.log('错误消息:', errorMsg);
}

// 示例 7: 模式切换
export function example7_ModeSwitching() {
  console.log('\n=== 示例 7: 模式切换 ===');
  
  const promptManager = createPromptManager('coding');
  
  console.log('当前模式:', promptManager.getCurrentMode());
  console.log('模式配置:', promptManager.getModeConfig());
  
  // 切换到分析模式
  promptManager.switchMode('ask');
  console.log('切换后模式:', promptManager.getCurrentMode());
  console.log('新模式配置:', promptManager.getModeConfig());
}

// 运行所有示例
export function runAllExamples() {
  console.log('🚀 ByteCraft Prompt 系统示例\n');
  
  example1_BasicUsage();
  example2_AskMode();
  example3_FormatFiles();
  example4_ToolDescriptions();
  example5_ProjectContext();
  example6_ToolResults();
  example7_ModeSwitching();
  
  console.log('\n✅ 所有示例运行完成！');
}

// 如果需要直接运行示例，可以调用这个函数
export default runAllExamples;
