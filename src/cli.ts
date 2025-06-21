#!/usr/bin/env node

import meow from "meow";
import { applyWarningFilter } from "@/utils/warning-filter.js";
import { InteractiveChat } from "@/utils/interactive-chat.js";
import { AgentLoop } from "@/utils/agent-loop.js";
import { CRAFT_LOGO } from "@/utils/art/logo.js";
import { getAvailableModels, getDefaultModel, getModelConfig } from "@/config/config.js";
import { getSystemPrompt } from './utils/prompt-manager';

// 应用 warning 过滤器
applyWarningFilter();

const cli = meow(`
  ${CRAFT_LOGO}

  Usage
    $ craft [options] [prompt]

  Examples
    $ craft                                  启动交互式Agent
    $ craft "帮我写一个个人站点"             启动交互式Coding Agent,并自动触发初始Prompt
    $ craft -p "帮我写一个React组件"         运行一次性Coding任务,完成后退出
    $ craft -c                               继续最近的对话
    $ craft -S <id>                          通过id加载对话上下文并启动交互模式
    $ craft -m deepseek-r1                   使用指定模型别名启动对话
    $ craft --list-models                    列出所有可用的模型别名

  Options
    --autorun                                全自动模式
    --prompt, -p                             使用给定提示词启动一次性对话
    --help, -h                               显示帮助信息
    --version, -v                            显示版本信息
    --interactive, -i                        启动交互式对话模式
    --model, -m                              指定要使用的模型别名
    --list-models                            列出所有可用的模型别名
    --work-dir, -w                           追加工作目录
    --config, -c                             指定配置文件路径
    --continue, -c                           继续上一次对话
    --session, -S                            指定会话ID
    --output, -o                             指定输出文件路径
    --timeout, -t                            设置超时时间 (秒)
    --max-tokens                             设置最大token数
    --list-sessions                          列出所有会话
    --delete-session                         删除指定会话

  Interactive Mode Slash Commands
    /new                                     创建新对话
    /exit                                    退出交互模式
    /clear                                   清空页面内容
    /help                                    显示帮助信息
    /history                                 显示对话历史
    /save <id>                               保存当前会话
    /load <id>                               加载指定会话
`, {
  importMeta: import.meta,
  flags: {
    autorun: {
      type: 'boolean'
    },
    prompt: {
      type: 'string',
      shortFlag: 'p'
    },
    help: {
      type: 'boolean',
      shortFlag: 'h'
    },
    version: {
      type: 'boolean',
      shortFlag: 'v'
    },
    interactive: {
      type: 'boolean',
      shortFlag: 'i'
    },
    model: {
      type: 'string',
      shortFlag: 'm'
    },
    listModels: {
      type: 'boolean'
    },
    workDir: {
      type: 'string',
      shortFlag: 'w'
    },
    config: {
      type: 'string'
    },
    continue: {
      type: 'boolean',
      shortFlag: 'c'
    },
    session: {
      type: 'string',
      shortFlag: 'S'
    },
    listSessions: {
      type: 'boolean'
    },
    deleteSession: {
      type: 'string'
    },
    output: {
      type: 'string',
      shortFlag: 'o'
    },
    timeout: {
      type: 'number',
      shortFlag: 't'
    },
    maxTokens: {
      type: 'number'
    }
  }
});

/**
 * 列出所有可用的模型别名
 */
function listAvailableModels() {
  try {
    const models = getAvailableModels();
    const defaultModel = getDefaultModel();
    
    console.log('🤖 可用的模型别名:');
    console.log('');
    
    if (models.length === 0) {
      console.log('❌ 没有找到可用的模型配置');
      return;
    }
    
    models.forEach(alias => {
      try {
        const config = getModelConfig(alias);
        const isDefault = alias === defaultModel;
        const status = isDefault ? ' (默认)' : '';
        console.log(`  ${alias}${status}`);
        console.log(`    模型名称: ${config.name}`);
        console.log(`    API地址: ${config.baseURL}`);
        console.log(`    流式输出: ${config.streaming ? '是' : '否'}`);
        console.log('');
      } catch (error) {
        console.log(`  ${alias} (配置错误)`);
        console.log('');
      }
    });
    
    if (defaultModel) {
      console.log(`当前默认模型: ${defaultModel}`);
    }
  } catch (error) {
    console.error('❌ 获取模型列表失败:', error);
  }
}

/**
 * 根据前缀查找匹配的sessionId
 */
async function resolveSessionId(agentLoop: AgentLoop, inputId: string): Promise<string | null> {
  if (!inputId) return null;
  // 完整uuid直接返回
  if (inputId.length >= 32) return inputId;
  const sessions = await agentLoop.listSessions();
  // 优先前缀匹配
  const matched = sessions.filter(s => s.sessionId.startsWith(inputId));
  if (matched.length === 1) return matched[0].sessionId;
  if (matched.length > 1) {
    console.log(`⚠️  有多个会话匹配前缀"${inputId}"，请补全更多位：`);
    matched.forEach(s => {
      console.log(`  - ${s.sessionId} (${s.title})`);
    });
    return null;
  }
  // 支持标题模糊匹配
  const fuzzy = sessions.find(s => s.title.toLowerCase().includes(inputId.toLowerCase()));
  if (fuzzy) return fuzzy.sessionId;
  return null;
}

// 主函数
async function main() {
  try {
    // 列出所有模型
    if (cli.flags.listModels) {
      listAvailableModels();
      return;
    }

    // 检查模型参数
    let modelAlias: string | undefined;
    if (cli.flags.model) {
      modelAlias = cli.flags.model;
      try {
        // 验证模型别名是否存在
        getModelConfig(modelAlias);
        console.log(`🤖 使用模型: ${modelAlias}`);
      } catch (error) {
        console.error(`❌ 模型别名 "${modelAlias}" 不存在或配置错误`);
        console.log('使用 `craft --list-models` 查看可用的模型别名');
        return;
      }
    } else {
      // 没有指定模型，显示将使用的默认模型
      try {
        const defaultModel = getDefaultModel();
        if (defaultModel) {
          const defaultConfig = getModelConfig(defaultModel);
          console.log(`🤖 使用默认模型: ${defaultModel} (${defaultConfig.name})`);
        }
      } catch (error) {
        console.error('❌ 获取默认模型失败:', error);
        console.log('请使用 -m 参数指定模型别名，或使用 `craft --list-models` 查看可用的模型');
        return;
      }
    }

    const agentLoop = new AgentLoop(modelAlias);

    // 列出所有会话
    if (cli.flags.listSessions) {
      await listAllSessions(agentLoop);
      return;
    }

    // 删除指定会话
    if (cli.flags.deleteSession) {
      await deleteSessionById(agentLoop, cli.flags.deleteSession);
      return;
    }

    // 检查是否有配置文件参数
    if (cli.flags.config) {
      console.log(`📁 使用配置文件: ${cli.flags.config}`);
      // TODO: 实现配置文件加载逻辑
    }

    // 检查工作目录参数
    if (cli.flags.workDir) {
      console.log(`📂 工作目录: ${cli.flags.workDir}`);
      // TODO: 实现工作目录切换逻辑
    }

    // 继续最近的对话
    if (cli.flags.continue) {
      const lastSessionId = agentLoop.loadLastSessionId();
      if (lastSessionId) {
        try {
          // 验证会话是否存在
          const sessionExists = await agentLoop.sessionExists(lastSessionId);
          if (sessionExists) {
            console.log(`🔄 继续上次对话: ${lastSessionId.slice(0, 8)}...`);
            const interactiveChat = new InteractiveChat(modelAlias);
            await interactiveChat.start(lastSessionId);
            return;
          } else {
            console.log('⚠️  上次会话不存在，启动新对话');
          }
        } catch (error) {
          console.log('⚠️  加载上次会话失败，启动新对话');
        }
      } else {
        console.log('❌ 没有找到可继续的对话，启动新对话');
      }
    }

    // 单次对话模式（使用 -p 参数）
    if (cli.flags.prompt) {
      let resolvedSessionId = cli.flags.session ? await resolveSessionId(agentLoop, cli.flags.session) : undefined;
      if (resolvedSessionId === null) resolvedSessionId = undefined;
      await handleSingleMessage(agentLoop, cli.flags.prompt, resolvedSessionId);
      return;
    }

    // 交互式模式或指定会话（但排除其他flag操作）
    const sessionId = cli.flags.session;
    const hasOtherFlags = cli.flags.listSessions || cli.flags.deleteSession;
    
    if ((cli.flags.interactive || sessionId || cli.input.length === 0) && !hasOtherFlags) {
      let resolvedSessionId = sessionId ? await resolveSessionId(agentLoop, sessionId) : undefined;
      if (resolvedSessionId === null) resolvedSessionId = undefined;
      const interactiveChat = new InteractiveChat(modelAlias);
      await interactiveChat.start(resolvedSessionId);
      return;
    }

    // 直接输入消息的单次对话模式
    const message = cli.input.join(' ');
    if (!message) {
      console.log('❌ 请提供要发送给AI的消息');
      console.log('💡 使用 --help 查看使用说明');
      process.exit(1);
    }
    let resolvedSessionId = sessionId ? await resolveSessionId(agentLoop, sessionId) : undefined;
    if (resolvedSessionId === null) resolvedSessionId = undefined;
    await handleSingleMessage(agentLoop, message, resolvedSessionId);

  } catch (error) {
    console.error('❌ 运行出错:', error);
    process.exit(1);
  }
}

/**
 * 处理单次消息
 */
async function handleSingleMessage(agentLoop: AgentLoop, message: string, sessionId?: string) {
  try {
    console.log(`💬 发送消息: ${message}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 如果指定了会话ID，尝试加载现有会话
    if (sessionId) {
      try {
        await agentLoop.loadSession(sessionId);
        console.log(`📂 已加载会话: ${sessionId.slice(0, 8)}...`);
      } catch (error) {
        console.log(`⚠️  无法加载会话 ${sessionId.slice(0, 8)}...，创建新会话`);
        await agentLoop.createNewSession();
      }
    } else {
      // 创建新会话
      await agentLoop.createNewSession();
    }
    
    // 处理消息
    const response = await agentLoop.processMessage(message);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ 会话ID: ${agentLoop.getCurrentSessionId()?.slice(0, 8)}...`);
    console.log('💡 使用 craft -S <sessionId> 继续此对话');
    
  } catch (error) {
    console.error('❌ 处理消息失败:', error);
    process.exit(1);
  }
}

/**
 * 列出所有会话
 */
async function listAllSessions(agentLoop: AgentLoop) {
  try {
    const sessions = await agentLoop.listSessions();
    
    console.log('\n📋 所有会话:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (sessions.length === 0) {
      console.log('📭 暂无保存的会话');
    } else {
      sessions.forEach((session, index) => {
        const current = session.sessionId === agentLoop.getCurrentSessionId() ? ' (当前)' : '';
        const date = new Date(session.updated).toLocaleString();
        console.log(`${index + 1}. ${session.title}${current}`);
        console.log(`   短ID: ${session.sessionId.slice(0, 8)} | 完整ID: ${session.sessionId}`);
        console.log(`   更新: ${date} | 消息数: ${session.messageCount}`);
        console.log('');
      });
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 使用 craft -S <sessionId> 加载指定会话');
  } catch (error) {
    console.error('❌ 获取会话列表失败:', error);
  }
}

/**
 * 删除会话
 */
async function deleteSessionById(agentLoop: AgentLoop, sessionId: string) {
  try {
    const success = await agentLoop.deleteSession(sessionId);
    if (success) {
      console.log(`🗑️  已删除会话: ${sessionId.slice(0, 8)}...`);
    } else {
      console.log('❌ 未找到匹配的会话');
    }
  } catch (error) {
    console.error('❌ 删除会话失败:', error);
  }
}

// 启动应用
main().catch((error) => {
  console.error('❌ 应用启动失败:', error);
  process.exit(1);
});

console.log('System Prompt:', getSystemPrompt()); 