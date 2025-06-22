// 导出基础类
export { BasePrompts } from './base-prompts.js';
export { CodingPrompts } from './coding-prompts.js';
export { AskPrompts } from './ask-prompts.js';
export { HelpPrompts } from './help-prompts.js';
export { ToolPrompts } from './tool-prompts.js';

// 导出 Prompt 管理器
export { PromptManager } from './prompt-manager.js';
export type { PromptMode, PromptOptions, FileInfo } from './prompt-manager.js';

// 导出启动提示词
export { startupPrompt } from './startup.js';

// 便捷函数
import { PromptManager } from './prompt-manager.js';
export function createPromptManager(mode: 'coding' | 'ask' | 'help' = 'coding') {
  return new PromptManager(mode);
}

// 预定义的配置
export const defaultPromptOptions = {
  language: '中文',
  platform: 'node',
  finalReminders: [
    '请始终确保代码质量和最佳实践',
    '在修改重要文件前先备份',
    '提供清晰的操作说明和错误处理'
  ]
};

// 导出集成相关
export { 
  AgentPromptIntegration, 
  createAgentPromptIntegration, 
  presetConfigs 
} from './agent-integration.js';
export type { AgentConfig, Tool } from './agent-integration.js';

// 工具名称映射
export const TOOL_NAMES = {
  FILE_MANAGER: 'file_manager',
  COMMAND_EXEC: 'command_exec', 
  CODE_EXECUTOR: 'code_executor',
  WEB_SEARCH: 'web_search',
  WEATHER: 'weather'
} as const;

export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];
