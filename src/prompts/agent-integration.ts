/**
 * 将新的 Prompt 系统集成到 ByteCraft Agent 中
 */

import { PromptManager, TOOL_NAMES } from './index.js';
import type { ToolMeta } from '../types/tool.js';
import { TOOL_METAS, getAllToolMetas } from '../utils/tools/tool-metas.js';

// 定义通用工具接口
export interface Tool {
  name: string;
  description?: string;
  [key: string]: any;
}

export interface AgentConfig {
  language?: string;
  projectContext?: {
    name: string;
    type: string;
    language: string;
    framework?: string;
  };
  customReminders?: string[];
}

export class AgentPromptIntegration {
  private promptManager: PromptManager;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.promptManager = new PromptManager();
  }

  /**
   * 初始化系统消息
   */
  async initializeSystemMessage(): Promise<string> {
    const tools: ToolMeta[] = getAllToolMetas();
    return this.promptManager.formatSystemPrompt(tools, {
      language: this.config.language || '中文',
      platform: 'node',
      projectContext: this.config.projectContext,
      finalReminders: [
        ...(this.config.customReminders || []),
        '🎯 优先使用工具执行操作，不要输出完整代码',
        '⚡ 理解需求后立即调用工具，无需等待确认',
        '📝 工具执行完成后提供简洁的状态说明',
        '🛡️ 确保代码质量和安全性',
        '📋 提供清晰的操作说明和错误处理'
      ]
    });
  }

  /**
   * 映射工具名称到 prompt 系统中的名称
   */
  private mapToolToPromptName(toolName: string): string {
    const mapping: Record<string, string> = {
      'file-manager': TOOL_NAMES.FILE_MANAGER,
      'file_manager': TOOL_NAMES.FILE_MANAGER,
      'fileManager': TOOL_NAMES.FILE_MANAGER,
      'file_manager_v2': TOOL_NAMES.FILE_MANAGER,
      'fileManagerV2': TOOL_NAMES.FILE_MANAGER,
      'file-edit': TOOL_NAMES.FILE_EDIT,
      'file_edit': TOOL_NAMES.FILE_EDIT,
      'fileEdit': TOOL_NAMES.FILE_EDIT,
      'grep-search': TOOL_NAMES.GREP_SEARCH,
      'grep_search': TOOL_NAMES.GREP_SEARCH,
      'grepSearch': TOOL_NAMES.GREP_SEARCH,
      'project-analyzer': TOOL_NAMES.PROJECT_ANALYZER,
      'project_analyzer': TOOL_NAMES.PROJECT_ANALYZER,
      'projectAnalyzer': TOOL_NAMES.PROJECT_ANALYZER,
      'command-exec': TOOL_NAMES.COMMAND_EXEC,
      'command_exec': TOOL_NAMES.COMMAND_EXEC,
      'commandExec': TOOL_NAMES.COMMAND_EXEC,
      'code-executor': TOOL_NAMES.CODE_EXECUTOR,
      'code_executor': TOOL_NAMES.CODE_EXECUTOR,
      'codeExecutor': TOOL_NAMES.CODE_EXECUTOR,
      'web-search': TOOL_NAMES.WEB_SEARCH,
      'web_search': TOOL_NAMES.WEB_SEARCH,
      'webSearch': TOOL_NAMES.WEB_SEARCH,
      'weather': TOOL_NAMES.WEATHER
    };

    return mapping[toolName] || toolName;
  }

  /**
   * 格式化文件内容消息
   */
  formatFilesForChat(files: Array<{ path: string; content: string; readonly?: boolean }>): string {
    const fileInfos = files.map(file => ({
      path: file.path,
      content: file.content,
      isReadonly: file.readonly
    }));

    return this.promptManager.formatFilesContent(fileInfos);
  }

  /**
   * 格式化工具执行结果
   */
  formatToolResult(toolName: string, success: boolean, result?: string, error?: string): string {
    if (success) {
      return this.promptManager.getToolSuccessMessage(toolName, result);
    } else {
      return this.promptManager.getToolErrorMessage(error || '未知错误', toolName);
    }
  }

  /**
   * 获取工具使用帮助
   */
  getToolHelp(toolName: string): string {
    // 先查找ToolMeta
    const meta = TOOL_METAS.find(t => t.name === toolName || t.promptKey === toolName);
    if (!meta) return '未找到该工具的帮助信息。';
    const key = meta.promptKey || meta.name;
    // 优先用tool-prompts
    let desc = this.promptManager ? require('./tool-prompts').ToolPrompts.getToolPrompt(key) : '';
    if (!desc || desc.includes('使用说明暂不可用')) {
      desc = meta.description || '无详细说明';
    }
    return desc;
  }

  /**
   * 格式化仓库摘要信息
   */
  formatRepoSummary(summary: string): string {
    return this.promptManager.formatRepoContent(summary);
  }
}

// 便捷工厂函数
export function createAgentPromptIntegration(config: AgentConfig): AgentPromptIntegration {
  return new AgentPromptIntegration(config);
}

// 预定义配置
export const presetConfigs = {
  // 默认配置 - 统一的智能编程助手
  default: {
    language: '中文',
    customReminders: [
      '🚀 直接执行原则：理解需求后立即调用工具',
      '🛠️ 工具优先：所有操作通过工具完成，不输出代码',
      '⚡ 无需确认：明确需求直接执行，无需等待用户批准',
      '📊 简洁反馈：工具执行后只提供关键状态信息',
      '🔧 优先考虑代码的可读性和可维护性',
      '🔄 在重构代码时保持向后兼容性',
      '📝 添加适当的类型注解和文档注释'
    ]
  }
};

// 示例用法
export function exampleUsage() {
  // 创建默认配置的集成
  const integration = createAgentPromptIntegration({
    ...presetConfigs.default,
    projectContext: {
      name: 'ByteCraft',
      type: 'AI Assistant',
      language: 'TypeScript',
      framework: 'Node.js'
    }
  });

  // 示例：获取工具帮助
  const fileHelp = integration.getToolHelp('file-manager');
  console.log('文件管理工具帮助:', fileHelp.substring(0, 100) + '...');

  return integration;
}
