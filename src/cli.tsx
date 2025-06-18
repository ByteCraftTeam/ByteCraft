#!/usr/bin/env node

import meow from "meow";
import { run } from "@/utils/agent/agent.js";
import { applyWarningFilter } from "@/utils/warning-filter.js";
import { InteractiveChat } from "@/utils/interactive-chat.js";
import { CRAFT_LOGO } from "@/utils/art/logo.js";

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
    $ craft -r <id>                          通过id加载对话上下文并启动交互模式

  Options
    --autorun                                全自动模式
    --prompt, -p                             使用给定提示词启动一次性对话
    --help, -h                               显示帮助信息
    --version, -v                            显示版本信息
    --interactive, -i                        启动交互式对话模式
    --model, -m                              指定要使用的模型Alias
    --work-dir, -w                           追加工作目录
    --config, -c                             指定配置文件路径
    --continue, -c                           继续上一次对话
    --session, -S                            指定会话ID
    --output, -o                             指定输出文件路径
    --timeout, -t                            设置超时时间 (秒)
    --max-tokens                             设置最大token数

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
    workDir: {
      type: 'string',
      shortFlag: 'w'
    },
    config: {
      type: 'string',
      shortFlag: 'c'
    },
    continue: {
      type: 'boolean',
      shortFlag: 'c'
    },
    session: {
      type: 'string',
      shortFlag: 'S'
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

// 主函数
async function main() {
  try {
    // 检查是否有配置文件参数
    if (cli.flags.config) {
      console.log(`📁 使用配置文件: ${cli.flags.config}`);
      // TODO: 实现配置文件加载逻辑
    }

    // 检查模型参数
    if (cli.flags.model) {
      console.log(`🤖 使用模型: ${cli.flags.model}`);
      // TODO: 实现模型切换逻辑
    }

    // 检查流式输出参数
    if (cli.flags.stream !== undefined) {
      console.log(`📡 流式输出: ${cli.flags.stream ? '启用' : '禁用'}`);
      // TODO: 实现流式输出控制逻辑
    }

    // 交互式模式
    if (cli.flags.interactive) {
      const interactiveChat = new InteractiveChat();
      await interactiveChat.start();
      return;
    }

    // 单次对话模式
    const message = cli.input.join(' ');
    if (!message) {
      console.log('❌ 请提供要发送给AI的消息');
      console.log('💡 使用 --help 查看使用说明');
      process.exit(1);
    }

    console.log(`💬 发送消息: ${message}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 调用 agent 运行
    await run();

  } catch (error) {
    console.error('❌ 运行出错:', error);
    process.exit(1);
  }
}

// 启动应用
main().catch((error) => {
  console.error('❌ 应用启动失败:', error);
  process.exit(1);
});