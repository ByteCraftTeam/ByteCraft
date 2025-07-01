import { createPromptManager, TOOL_NAMES, PromptManager, ToolPrompts, AgentPromptIntegration, presetConfigs } from '../../src/prompts/index.js';
import { TOOL_METAS } from '../../src/utils/tools/tool-metas.js';

console.log('🧪 ByteCraft prompts 系统 tsx 自动化测试');

// 1. 基础功能
{
  const manager = createPromptManager();
  if (!(manager instanceof PromptManager)) throw new Error('PromptManager 创建失败');
  console.log('✓ PromptManager 创建成功');
}

// 2. 系统提示词生成
{
  const manager = createPromptManager();
  const metas = TOOL_METAS.filter(t => ['file_manager_v2', 'command_exec'].includes((t.promptKey || t.name) as string));
  const prompt = manager.formatSystemPrompt(metas, { language: '中文', finalReminders: ['测试提醒'] });
  if (!prompt.includes('ByteCraft') || !prompt.includes('文件管理')) throw new Error('系统提示词生成失败');
  console.log('✓ 系统提示词生成成功');
}

// 3. 工具描述分支
{
  if (!ToolPrompts.getToolPrompt('file_manager_v2').includes('文件管理')) throw new Error('file_manager_v2 描述异常');
  if (!ToolPrompts.getToolPrompt('command_exec').includes('命令执行')) throw new Error('command_exec 描述异常');
  if (!ToolPrompts.getToolPrompt('not_exist').includes('暂不可用')) throw new Error('未知工具描述异常');
  console.log('✓ 工具描述分支测试通过');
}

// 4. 文件内容格式化
{
  const manager = createPromptManager();
  const msg = manager.formatFilesContent([
    { path: 'src/test.ts', content: 'console.log("Hello ByteCraft");' },
    { path: 'README.md', content: '# ByteCraft\n这是一个AI助手', isReadonly: true }
  ]);
  if (!msg.includes('src/test.ts') || !msg.includes('只读')) throw new Error('文件内容格式化失败');
  console.log('✓ 文件内容格式化测试通过');
}

// 5. Agent 集成
{
  const integration = new AgentPromptIntegration({
    ...presetConfigs.default,
    projectContext: { name: 'ByteCraft', type: 'CLI Tool', language: 'TypeScript', framework: 'Node.js' }
  });
  if (!(integration instanceof AgentPromptIntegration)) throw new Error('Agent 集成创建失败');
  console.log('✓ Agent 集成创建成功');
}

// 6. 工具结果格式化
{
  const integration = new AgentPromptIntegration({ ...presetConfigs.default });
  const ok = integration.formatToolResult('file_manager_v2', true, '文件操作成功');
  const fail = integration.formatToolResult('file_manager_v2', false, undefined, '权限不足');
  if (!ok.includes('成功') || !fail.includes('失败')) throw new Error('工具结果格式化失败');
  console.log('✓ 工具结果格式化测试通过');
}

console.log('🎉 prompts 系统 tsx 自动化测试全部通过！');
