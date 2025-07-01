import { ToolPrompts } from './tool-prompts.js';
import { startupPrompt } from './startup.js';
import { LoggerManager } from '../utils/logger/logger.js';
import type { ToolMeta } from '../types/tool';
import os from 'os';

export interface PromptOptions {
  language?: string;
  platform?: string;
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
  private logger: any;
  constructor() {
    this.logger = LoggerManager.getInstance().getLogger('prompt-manager');
  }

  /**
   * 格式化系统提示词（只接受ToolMeta[]）
   */
  formatSystemPrompt(tools: ToolMeta[], options: { language?: string; platform?: string; finalReminders?: string[]; projectContext?: any; terminal?: string; osPlatform?: string } = {}): string {
    const {
      language = '中文',
      platform = 'node',
      finalReminders = [],
      projectContext,
      terminal,
      osPlatform
    } = options;

    let prompt = startupPrompt;
    let toolPrompt = this.formatToolsSection(tools);
    this.logger.info('[PromptManager] 拼接后的 toolPrompt 内容', { toolPrompt });

    // 格式化最终提醒
    const formattedReminders = this.formatReminders(finalReminders);
    const contextInfo = projectContext ? this.formatProjectContext(projectContext) : '';

    prompt = prompt
      .replace(/{language}/g, language)
      .replace(/{platform}/g, platform)
      .replace(/{toolPrompt}/g, toolPrompt)
      .replace(/{toolReminder}/g, '')
      .replace(/{finalReminders}/g, formattedReminders);
    if (contextInfo) {
      prompt += '\n\n' + contextInfo;
    }

    // 拼接终端和系统信息
    let detectedTerminal = terminal || process.env.TERM || process.env.ComSpec || 'unknown';
    let detectedPlatform = osPlatform || (typeof os !== 'undefined' && os.platform ? os.platform() : platform);
    const runtimeInfo = `终端类型: ${detectedTerminal}\n系统平台: ${detectedPlatform}\n`;
    prompt = runtimeInfo + prompt;

    return prompt;
  }

  /**
   * 格式化工具部分
   */
  private formatToolsSection(tools: ToolMeta[]): string {
    let section = '\n## 🛠️ 可用工具:\n\n';
    for (const tool of tools) {
      const key = tool.promptKey || tool.name;
      let desc = ToolPrompts.getToolPrompt(key);
      if (!desc || desc.includes('使用说明暂不可用')) {
        desc = tool.description || '无详细说明';
      }
      section += `### ${tool.name}\n${desc}\n\n`;
    }
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
