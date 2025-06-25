import readline from 'readline';
import { AgentLoop } from "@/utils/agent-loop.js";
import type { SessionMetadata } from "@/types/conversation.js";

/**
 * 交互式对话管理器
 */
export class InteractiveChat {
  private rl: readline.Interface;
  private agentLoop: AgentLoop;
  private isRunning = false;

  constructor(modelAlias?: string) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '💬 > '
    });

    this.agentLoop = new AgentLoop(modelAlias);
  }

  /**
   * 启动交互式对话
   */
  async start(sessionId?: string) {
    console.log('🎯 交互式对话模式已启动');
    console.log(`🤖 使用模型: ${this.agentLoop.getModelAlias()}`);
    
    // 创建或加载会话
    if (sessionId) {
      // 如果sessionId已经通过loadLastSessionId加载，则不需要再次加载
      if (this.agentLoop.getCurrentSessionId() === sessionId) {
        console.log(`✅ 会话已加载: ${sessionId.slice(0, 8)}...`);
      } else {
        try {
          console.log(`🔍 尝试加载会话: ${sessionId}`);
          await this.agentLoop.loadSession(sessionId);
          console.log(`✅ 成功加载会话: ${sessionId.slice(0, 8)}...`);
        } catch (error) {
          console.error(`❌ 加载会话失败: ${error}`);
          console.log('💡 提示：请使用 craft -S <完整会话ID> 来加载指定会话');
          console.log('🆕 正在创建新会话...');
          await this.agentLoop.createNewSession();
        }
      }
    } else {
      // 如果没有指定sessionId且当前没有会话，创建新会话
      if (!this.agentLoop.getCurrentSessionId()) {
        await this.agentLoop.createNewSession();
      }
    }    console.log(`📝 当前会话: ${this.agentLoop.getCurrentSessionId()?.slice(0, 8)}...`);
    console.log('🔄 模式切换命令:');
    console.log('   - /coder: 切换至编码模式 (代码开发与编程任务)');
    console.log('   - /ask: 切换至咨询模式 (代码分析与技术咨询)');
    console.log('   - /help: 切换至帮助模式 (帮助文档与使用指导)');
    console.log('');    console.log('💡 交互式命令:');
    console.log('   - /new: 创建新会话');
    console.log('   - /save <title>: 保存当前会话');
    console.log('   - /load <sessionId>: 加载指定会话');
    console.log('   - /list: 列出所有会话');
    console.log('   - /delete <sessionId>: 删除指定会话');
    console.log('   - quit/exit: 退出对话');
    console.log('   - clear: 清空当前会话历史');
    console.log('   - help: 显示帮助信息');
    console.log('   - history: 显示对话历史');
    console.log('');
    console.log('💡 CLI命令示例:');
    console.log('   npm start -- --list-sessions    # 列出所有会话');
    console.log('   npm start -- -S <sessionId>     # 加载指定会话'); 
    console.log('   npm start -- -c                 # 继续最近对话');
    console.log('   npm start -- -m <model>         # 使用指定模型');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    this.isRunning = true;
    this.rl.prompt();

    this.rl.on('line', async (input) => {
      const trimmedInput = input.trim();
      
      if (!trimmedInput) {
        this.rl.prompt();
        return;
      }

      // 处理特殊命令
      if (await this.handleCommand(trimmedInput)) {
        this.rl.prompt();
        return;
      }

      // 处理普通对话
      await this.handleMessage(trimmedInput);
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('\n👋 再见！');
      this.agentLoop.destroy();
      process.exit(0);
    });
  }

  /**
   * 处理特殊命令
   */
  private async handleCommand(input: string): Promise<boolean> {
    const parts = input.split(' ');
    const command = parts[0].toLowerCase();

    switch (command) {
      case 'quit':
      case 'exit':
        console.log('👋 正在退出...');
        this.rl.close();
        return true;

      case 'clear':
        await this.agentLoop.clearCurrentSession();
        console.log('🧹 对话历史已清空，创建新会话');
        return true;

      case '/new':
        try {
          await this.agentLoop.createNewSession();
          console.log(`✨ 已创建新会话: ${this.agentLoop.getCurrentSessionId()?.slice(0, 8)}...`);
        } catch (error) {
          console.error('❌ 创建新会话失败:', error);
        }
        return true;

      case '/coder':
        try {
          await this.agentLoop.switchMode('coding');
          console.log('🛠️ 已切换至 Coder 模式');
          console.log('💻 此模式专注于代码开发，可以：');
          console.log('   - 编写、修改和管理代码文件');
          console.log('   - 执行命令和运行代码');
          console.log('   - 创建新项目和实现功能');
          console.log('   - 进行代码重构和优化');
          await this.agentLoop.clearCurrentSession(); // 创建新会话以应用新模式
        } catch (error) {
          console.error('❌ 切换模式失败:', error);
        }
        return true;

      case '/ask':
        try {
          await this.agentLoop.switchMode('ask');
          console.log('❓ 已切换至 Ask 模式');
          console.log('🔍 此模式专注于代码分析，可以：');
          console.log('   - 分析代码结构和设计模式');
          console.log('   - 解释代码逻辑和工作原理');
          console.log('   - 提供技术概念解释');
          console.log('   - 回答编程相关问题');
          await this.agentLoop.clearCurrentSession(); // 创建新会话以应用新模式
        } catch (error) {
          console.error('❌ 切换模式失败:', error);
        }
        return true;

      case '/help':
        try {
          await this.agentLoop.switchMode('help');
          console.log('💡 已切换至 Help 模式');
          console.log('📚 此模式专注于使用指导，可以：');
          console.log('   - 解释 ByteCraft 功能和特性');
          console.log('   - 提供命令行参数和选项说明');
          console.log('   - 演示工具使用方法');
          console.log('   - 分享使用技巧和最佳实践');
          await this.agentLoop.clearCurrentSession(); // 创建新会话以应用新模式
        } catch (error) {
          console.error('❌ 切换模式失败:', error);
        }
        return true;

      case '/save':
        try {
          const title = parts.slice(1).join(' ') || '未命名会话';
          await this.agentLoop.saveCurrentSession(title);
        } catch (error) {
          console.error('❌ 保存会话失败:', error);
        }
        return true;

      case '/load':
        if (parts.length < 2) {
          console.log('❌ 请指定会话ID: /load <sessionId>');
          console.log('💡 提示: 使用 /list 查看所有可用会话');
          return true;
        }
        await this.handleLoadSession(parts[1]);
        return true;

      case '/list':
        try {
          await this.listSessions();
        } catch (error) {
          console.error('❌ 获取会话列表失败:', error);
        }
        return true;

      case '/delete':
        if (parts.length < 2) {
          console.log('❌ 请指定会话ID: /delete <sessionId>');
          console.log('💡 提示: 使用 /list 查看所有可用会话');
          return true;
        }
        try {
          const success = await this.agentLoop.deleteSession(parts[1]);
          if (success) {
            console.log(`🗑️  已删除会话: ${parts[1]}`);
          } else {
            console.log('❌ 未找到匹配的会话');
          }
        } catch (error) {
          console.error('❌ 删除会话失败:', error);
        }
        return true;

      case 'help':
        try {
          this.showHelp();
        } catch (error) {
          console.error('❌ 显示帮助失败:', error);
        }
        return true;

      case 'history':
        try {
          await this.showHistory();
        } catch (error) {
          console.error('❌ 获取对话历史失败:', error);
        }
        return true;

      case 'context':
        try {
          await this.showContextStats();
        } catch (error) {
          console.error('❌ 获取上下文统计失败:', error);
        }
        return true;

      default:
        return false;
    }
  }

  /**
   * 处理普通消息
   */
  private async handleMessage(message: string) {
    try {
      console.log(`\n AI is thinking...`);
      
      const response = await this.agentLoop.processMessage(message);
      
      if (!response) {
        console.log('\n❌ AI 没有返回有效响应');
      }
    } catch (error) {
      console.error('\n❌ 对话出错:', error);
    }
  }

  /**
   * 显示帮助信息
   */
  private showHelp() {
    console.log('\n📖 帮助信息:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💬 直接输入消息与 AI 对话');
    console.log('📝 支持多行输入，按 Enter 发送');
    console.log('');
    console.log('🔧 基本命令:');
    console.log('   quit/exit  - 退出对话');
    console.log('   clear      - 清空当前会话历史');
    console.log('   help       - 显示此帮助');
    console.log('   history    - 显示对话历史');
    console.log('   context    - 显示上下文统计信息');
    console.log('');
    console.log('🔄 模式切换:');
    console.log('   /coder     - 切换至编码模式 (代码开发与编程任务)');
    console.log('   /ask       - 切换至咨询模式 (代码分析与技术咨询)');
    console.log('   /help      - 切换至帮助模式 (帮助文档与使用指导)');
    console.log('');
    console.log('💾 会话管理:');
    console.log('   /new                    - 创建新会话');
    console.log('   /save <title>           - 保存当前会话');
    console.log('   /load <sessionId>       - 加载指定会话');
    console.log('   /list                   - 列出所有会话');
    console.log('   /delete <sessionId>     - 删除指定会话');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * 显示对话历史
   */
  private async showHistory() {
    console.log('\n📚 对话历史:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!this.agentLoop.getCurrentSessionId()) {
      console.log('📭 暂无活动会话');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    try {
      const messages = await this.agentLoop.getCurrentSessionHistory();
      
      if (messages.length === 0) {
        console.log('📭 暂无对话历史');
      } else {
        messages.forEach((msg, index) => {
          const role = msg.type === 'user' ? '👤' : '🤖';
          const timestamp = new Date(msg.timestamp).toLocaleString();
          console.log(`${index + 1}. [${timestamp}] ${role} ${msg.message.content.slice(0, 100)}${msg.message.content.length > 100 ? '...' : ''}`);
        });
      }
    } catch (error) {
      console.error('❌ 获取对话历史失败:', error);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * 智能加载会话（支持短ID和模糊匹配）
   */
  private async handleLoadSession(input: string): Promise<void> {
    try {
      const success = await this.agentLoop.loadSessionSmart(input);
      
      if (success) {
        console.log(`✅ 成功加载会话: ${this.agentLoop.getCurrentSessionId()?.slice(0, 8)}...`);
      } else {
        console.log(`❌ 未找到匹配的会话: "${input}"`);
        console.log('\n💡 请使用完整的短ID或会话标题的关键词');
        console.log('💡 提示: 使用 /list 查看所有可用会话');
      }
    } catch (error) {
      console.error('❌ 加载会话过程中出错:', error);
      console.log('💡 提示: 使用 /list 查看所有可用会话');
    }
  }

  /**
   * 列出所有会话
   */
  private async listSessions(): Promise<void> {
    try {
      const sessions = await this.agentLoop.listSessions();
      
      console.log('\n📋 会话列表:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      if (sessions.length === 0) {
        console.log('📭 暂无保存的会话');
      } else {
        sessions.forEach((session, index) => {
          const current = session.sessionId === this.agentLoop.getCurrentSessionId() ? ' (当前)' : '';
          const date = new Date(session.updated).toLocaleString();
          console.log(`${index + 1}. ${session.title}${current}`);
          console.log(`   短ID: ${session.sessionId.slice(0, 8)} | 完整ID: ${session.sessionId}`);
          console.log(`   更新: ${date} | 消息数: ${session.messageCount}`);
          console.log('');
        });
      }
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (error) {
      console.error('❌ 获取会话列表失败:', error);
    }
  }

  /**
   * 显示上下文统计信息
   */
  private async showContextStats(): Promise<void> {
    try {
      const stats = await this.agentLoop.getContextStats();
      
      console.log('\n📊 上下文统计信息:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📝 总消息数量: ${stats.totalMessages}`);
      console.log(`🔢 预估Token数: ${stats.estimatedTokens}`);
      console.log(`✂️  需要截断: ${stats.willTruncate ? '是' : '否'}`);
      
      if (stats.willTruncate) {
        console.log('');
        console.log('💡 提示: 对话历史较长，AI将只能看到最近的部分消息');
        console.log('💡 建议: 使用 /new 开启新对话以获得完整上下文');
      }
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (error) {
      console.error('❌ 获取上下文统计失败:', error);
    }
  }

  /**
   * 停止对话
   */
  stop() {
    this.isRunning = false;
    this.agentLoop.destroy();
    this.rl.close();
  }
}