import { BasePrompts } from './base-prompts.js';
import { CodingPrompts } from './coding-prompts.js';
import { AskPrompts } from './ask-prompts.js';
import { HelpPrompts } from './help-prompts.js';
import { ToolPrompts } from './tool-prompts.js';
import { startupPrompt } from './startup.js';

export type PromptMode = 'coding' | 'ask' | 'help';

export interface PromptOptions {
  language?: string;
  platform?: string;
  availableTools?: string[];
  finalReminders?: string[];
  projectContext?: {
    name: string;
    type: string;
    language: string;
    framework?: string;
  };
}

export interface FileInfo {
  path: string;
  content: string;
  isReadonly?: boolean;
}

export class PromptManager {
  private mode: PromptMode;
  private prompts: BasePrompts;

  constructor(mode: PromptMode = 'coding') {
    this.mode = mode;
    this.prompts = this.createPrompts(mode);
  }
  private createPrompts(mode: PromptMode): BasePrompts {
    switch (mode) {
      case 'coding':
        return new CodingPrompts();
      case 'ask':
        return new AskPrompts();
      case 'help':
        return new HelpPrompts();
      default:
        return new CodingPrompts();
    }
  }

  /**
   * 获取当前模式
   */
  getMode(): PromptMode {
    return this.mode;
  }

  /**
   * 切换模式
   */
  switchMode(mode: PromptMode): void {
    if (this.mode !== mode) {
      this.mode = mode;
      this.prompts = this.createPrompts(mode);
    }
  }

  /**
   * 格式化系统提示词
   */
  formatSystemPrompt(options: PromptOptions = {}): string {    const {
      language = '中文',
      platform = 'node',
      availableTools = [],
      finalReminders = [],
      projectContext
    } = options;

    let prompt = this.prompts.mainSystem || startupPrompt;

    // 处理工具相关占位符
    const toolPrompt = availableTools.length > 0 
      ? this.formatToolsSection(availableTools)
      : '';

    const toolReminder = this.prompts.systemReminder || '';

    // 格式化最终提醒
    const formattedReminders = this.formatReminders(finalReminders);

    // 添加项目上下文信息
    const contextInfo = projectContext 
      ? this.formatProjectContext(projectContext)
      : '';

    // 替换占位符
    prompt = prompt
      .replace(/{language}/g, language)
      .replace(/{platform}/g, platform)
      .replace(/{toolPrompt}/g, toolPrompt)
      .replace(/{toolReminder}/g, toolReminder)
      .replace(/{finalReminders}/g, formattedReminders);

    // 如果有项目上下文，添加到提示词末尾
    if (contextInfo) {
      prompt += '\n\n' + contextInfo;
    }

    return prompt;
  }

  /**
   * 格式化工具部分
   */
  private formatToolsSection(tools: string[]): string {
    let section = '\n## 🛠️ 可用工具:\n\n';
    
    tools.forEach(tool => {
      const description = this.getToolDescription(tool);
      section += `### ${tool}\n${description}\n\n`;
    });

    section += ToolPrompts.getAllToolsDescription();
    return section;
  }

  /**
   * 格式化项目上下文
   */
  private formatProjectContext(context: NonNullable<PromptOptions['projectContext']>): string {
    return `
## 📋 项目信息:
- **项目名**: ${context.name}
- **项目类型**: ${context.type}
- **主要语言**: ${context.language}
${context.framework ? `- **框架**: ${context.framework}` : ''}

请在操作时考虑项目的技术栈和约定。`;
  }

  /**
   * 格式化提醒信息
   */
  private formatReminders(reminders: string[]): string {
    const baseReminders = this.prompts.finalReminders;
    const allReminders = [...reminders];
    
    if (baseReminders) {
      allReminders.push(baseReminders);
    }

    return allReminders.length > 0 
      ? '\n' + allReminders.join('\n\n') 
      : '';
  }

  /**
   * 获取工具描述
   */
  getToolDescription(toolName: string): string {
    // 首先检查 prompts 中的描述
    if (this.prompts.toolDescriptions && this.prompts.toolDescriptions[toolName]) {
      return this.prompts.toolDescriptions[toolName];
    }
    
    // 然后使用详细的工具提示词
    return ToolPrompts.getToolPrompt(toolName);
  }

  /**
   * 格式化文件内容消息
   */
  formatFilesContent(files: FileInfo[]): string {
    if (files.length === 0) {
      return this.prompts.filesNoFullFiles;
    }

    let message = this.prompts.filesContentPrefix;
    
    files.forEach(file => {
      const readonly = file.isReadonly ? ' (只读)' : '';
      const language = this.detectLanguage(file.path);
      
      message += `\n\n## ${file.path}${readonly}\n\`\`\`${language}\n${file.content}\n\`\`\``;
    });

    return message;
  }

  /**
   * 根据文件扩展名检测语言
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript', 
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'md': 'markdown',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'sql': 'sql',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'bash',
      'fish': 'bash',
    };
    
    return languageMap[ext || ''] || '';
  }

  /**
   * 格式化仓库内容消息
   */
  formatRepoContent(summary: string): string {
    return this.prompts.repoContentPrefix + '\n\n' + summary;
  }

  /**
   * 获取示例消息
   */
  getExampleMessages(): any[] {
    return (this.prompts as any).exampleMessages || [];
  }

  /**
   * 获取工具执行成功消息
   */
  getToolSuccessMessage(toolName?: string, result?: string): string {
    let message = this.prompts.toolSuccess;
    if (toolName) {
      message = message.replace('工具', `工具 ${toolName}`);
    }
    if (result) {
      message += `\n\n执行结果:\n${result}`;
    }
    return message;
  }

  /**
   * 获取工具执行错误消息
   */
  getToolErrorMessage(error: string, toolName?: string): string {
    let message = this.prompts.toolError.replace('{error}', error);
    if (toolName) {
      message = message.replace('工具', `工具 ${toolName}`);
    }
    return message;
  }

  /**
   * 获取模式特定的配置
   */
  getModeConfig() {
    return {
      mode: this.mode,
      canEditFiles: this.mode === 'coding',
      canExecuteCommands: this.mode === 'coding',
      canCreateFiles: this.mode === 'coding',
      canAnalyzeOnly: this.mode === 'ask'
    };
  }
}
