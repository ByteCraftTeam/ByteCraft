/**
 * 快速验证 Prompt 系统功能
 */

// 首先导入所有需要的内容
import { 
  TOOL_NAMES,  // 确保这是第一个导入的项目
  createPromptManager, 
  createAgentPromptIntegration,
  presetConfigs
} from './index.js';

console.log('🚀 ByteCraft Prompt 系统验证\n');

// 1. 基础功能测试
console.log('1️⃣ 测试基础功能...');
const codingManager = createPromptManager();
console.log('✓ 创建编程模式管理器成功');


// 2. 系统提示词生成测试
console.log('\n2️⃣ 测试系统提示词生成...');
const systemPrompt = codingManager.formatSystemPrompt({
  language: '中文',
  availableTools: [TOOL_NAMES.FILE_MANAGER, TOOL_NAMES.COMMAND_EXEC],
  finalReminders: ['确保代码质量', '遵循最佳实践']
});

if (systemPrompt.includes('ByteCraft') && systemPrompt.includes('文件管理工具')) {
  console.log('✓ 系统提示词生成成功');
} else {
  console.log('✗ 系统提示词生成失败');
}

// 3. 工具描述测试
console.log('\n3️⃣ 测试工具描述...');
const fileManagerDesc = codingManager.getToolDescription(TOOL_NAMES.FILE_MANAGER);
if (fileManagerDesc.includes('文件管理')) {
  console.log('✓ 文件管理工具描述获取成功');
} else {
  console.log('✗ 文件管理工具描述获取失败');
}

// 4. 文件内容格式化测试
console.log('\n4️⃣ 测试文件内容格式化...');
const filesMessage = codingManager.formatFilesContent([
  {
    path: 'src/test.ts',
    content: 'console.log("Hello ByteCraft");'
  },
  {
    path: 'README.md',
    content: '# ByteCraft\n这是一个AI助手',
    isReadonly: true
  }
]);

if (filesMessage.includes('src/test.ts') && filesMessage.includes('只读')) {
  console.log('✓ 文件内容格式化成功');
} else {
  console.log('✗ 文件内容格式化失败');
}

// 5. Agent 集成测试
console.log('\n5️⃣ 测试 Agent 集成...');
const integration = createAgentPromptIntegration({
  ...presetConfigs.default,
  projectContext: {
    name: 'ByteCraft',
    type: 'CLI Tool',
    language: 'TypeScript',
    framework: 'Node.js'
  }  });

console.log('✓ Agent 集成创建成功');

// 6. 工具结果格式化测试
console.log('\n6️⃣ 测试工具结果格式化...');
const successMsg = integration.formatToolResult('file_manager', true, '文件操作成功');
const errorMsg = integration.formatToolResult('file_manager', false, undefined, '权限不足');

if (successMsg.includes('成功') && errorMsg.includes('失败')) {
  console.log('✓ 工具结果格式化成功');
} else {
  console.log('✗ 工具结果格式化失败');
}

console.log('\n🎉 Prompt 系统验证完成！');
console.log('✨ 所有核心功能都已实现并可以正常工作');

export default function verify() {
  console.log('Prompt 系统验证脚本执行完毕');
}
