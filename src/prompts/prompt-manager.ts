import { ToolPrompts } from './tool-prompts.js';
import { startupPrompt } from './startup.js';

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
  constructor() {
    // 简化的构造函数，不再需要模式参数
  }

  /**
   * 格式化系统提示词
   */
  formatSystemPrompt(options: PromptOptions = {}): string {
    const {
      language = '中文',
      platform = 'node',
      availableTools = [],
      finalReminders = [],
      projectContext
    } = options;

    let prompt = startupPrompt;

    // 处理工具相关占位符
    const toolPrompt = availableTools.length > 0 
      ? this.formatToolsSection(availableTools)
      : '';

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
      .replace(/{toolReminder}/g, '')
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
    return reminders.length > 0 
      ? '\n' + reminders.join('\n\n') 
      : '';
  }

  /**
   * 获取工具描述
   */
  getToolDescription(toolName: string): string {
    // 使用详细的工具提示词
    return ToolPrompts.getToolPrompt(toolName);
  }

  /**
   * 格式化文件内容消息
   */
  formatFilesContent(files: FileInfo[]): string {
    if (files.length === 0) {
      return "目前我还没有看到任何完整的文件内容。请添加需要分析的文件。";
    }

    let message = "以下是文件内容：";
    
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
    return `我正在与您讨论 git 仓库中的代码。以下是仓库中一些文件的摘要。如果您需要我分析任何文件的完整内容，请要求我*将它们添加到对话中*。\n\n` + summary;
  }

  /**
   * 获取工具执行成功消息
   */
  getToolSuccessMessage(toolName?: string, result?: string): string {
    let message = '✅ 工具执行成功';
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
    let message = `❌ 工具执行失败: ${error}`;
    if (toolName) {
      message = message.replace('工具', `工具 ${toolName}`);
    }
    return message;
  }
}
