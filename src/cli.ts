#!/usr/bin/env node

import meow from "meow";
import { applyWarningFilter } from "@/utils/warning-filter.js";
import { InteractiveChat } from "@/utils/interactive-chat.js";
import { AgentLoop } from "@/utils/agent-loop.js";
import { CRAFT_LOGO } from "@/utils/art/logo.js";
import { getAvailableModels, getDefaultModel, getModelConfig } from "@/config/config.js";

// 应用 warning 过滤器
applyWarningFilter();

const cli = meow(`
  ${CRAFT_LOGO}

  Usage
    $ craft [options]

  Examples
    $ craft                                  启动交互式Agent
    $ craft -p "帮我写一个React组件"         启动UI并自动发送初始消息
    $ craft -c                               继续最近的对话
    $ craft -S <id>                          通过id加载对话上下文并启动交互模式
    $ craft -m deepseek-r1                   使用指定模型别名启动对话
    $ craft --list-models                    列出所有可用的模型别名

  Options
    --config, -c                             指定配置文件路径
    --continue, -c                           继续上一次对话
    --delete-session                         删除指定会话
    --help, -h                               显示帮助信息
    --list-models                            列出所有可用的模型别名
    --list-sessions                          列出所有会话
    --model, -m                              指定要使用的模型别名
    --prompt, -p                             使用给定提示词启动一次性对话
    --session, -S                            指定会话ID
    --version, -v                            显示版本信息

  Interactive Mode Slash Commands
    /clear                                   清空页面内容
    /exit                                    退出交互模式
    /help                                    显示帮助信息
    /load <id>                               智能加载指定会话上下文
    /model                                   切换模型
    /new                                     创建新对话
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
    },
    performanceReport: {
      type: 'boolean'
    },
    clearCache: {
      type: 'boolean'
    },
    cacheStats: {
      type: 'boolean'
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
    
    console.log('可用模型:');
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

/**
 * 启动UI界面
 */
async function startUI(modelAlias?: string, sessionId?: string, initialMessage?: string) {
  try {
    // 设置环境变量，让UI知道要使用的模型和会话
    if (modelAlias) {
      process.env.CRAFT_MODEL = modelAlias;
    }
    if (sessionId) {
      process.env.CRAFT_SESSION_ID = sessionId;
    }
    if (initialMessage) {
      process.env.CRAFT_INITIAL_MESSAGE = initialMessage;
    }
    
    // 直接导入并执行UI入口文件
    await import("./ui/index.js");
  } catch (error) {
    console.error('❌ 启动UI失败:', error);
    console.log('💡 尝试使用传统交互模式...');
    
    // 如果UI启动失败，回退到传统交互模式
    const interactiveChat = new InteractiveChat(modelAlias);
    await interactiveChat.start(sessionId);
  }
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
          // console.log(`🤖 使用默认模型: ${defaultModel} (${defaultConfig.name})`);
        }
      } catch (error) {
        console.error('❌ 获取默认模型失败:', error);
        console.log('请使用 -m 参数指定模型别名，或使用 `craft --list-models` 查看可用的模型');
        return;
      }
    }

    const agentLoop = new AgentLoop(modelAlias);

    // 显示性能监控报告
    if (cli.flags.performanceReport) {
      agentLoop.getPerformanceReport();
      return;
    }

    // 显示缓存统计信息
    if (cli.flags.cacheStats) {
      const stats = agentLoop.getCacheStats();
      console.log('\n📊 缓存统计信息');
      console.log('='.repeat(30));
      console.log(`消息缓存: ${stats.messageCacheSize} 个会话`);
      console.log(`元数据缓存: ${stats.metadataCacheSize} 个会话`);
      console.log(`总缓存会话: ${stats.totalSessions} 个`);
      return;
    }

    // 清除缓存
    if (cli.flags.clearCache) {
      agentLoop.clearCache();
      agentLoop.clearPerformanceData();
      console.log('🧹 已清除所有缓存和性能数据');
      return;
    }

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
            // console.log(`🔄 继续上次对话: ${lastSessionId.slice(0, 8)}...`);
            await startUI(modelAlias, lastSessionId);
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
      await startUI(modelAlias, resolvedSessionId, cli.flags.prompt);
      return;
    }

    // 交互式模式或指定会话（但排除其他flag操作）
    const sessionId = cli.flags.session;
    const hasOtherFlags = cli.flags.listSessions || cli.flags.deleteSession;
    
    // 交互模式：明确指定 -i，或指定会话ID -S，或没有其他操作
    if ((sessionId || !hasOtherFlags)) {
      let resolvedSessionId = sessionId ? await resolveSessionId(agentLoop, sessionId) : undefined;
      if (resolvedSessionId === null) resolvedSessionId = undefined;
      await startUI(modelAlias, resolvedSessionId);
      return;
    }

    // 如果没有指定任何操作，默认启动交互式模式
    await startUI(modelAlias);

  } catch (error) {
    console.error('❌ 运行出错:', error);
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