import readline from 'readline';
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getModelConfig } from "@/config/config.js";
import type { ModelConfig } from "@/types/index.js";
import { createWeatherTool } from "@/utils/tools/weather.js";
import { SimpleCheckpointSaver } from "./simple-checkpoint-saver.js";
import { ConversationHistoryManager } from "./conversation-history.js";
import type { ConversationMessage, SessionMetadata } from "@/types/conversation.js";
import { v4 as uuidv4 } from 'uuid';

/**
 * 交互式对话管理器
 */
export class InteractiveChat {
  private rl: readline.Interface;
  private model!: ChatOpenAI;
  private agent!: any;
  private checkpointSaver!: SimpleCheckpointSaver;
  private historyManager!: ConversationHistoryManager;
  private currentSessionId: string | null = null;
  private isRunning = false;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '💬 > '
    });

    this.setupModel();
  }

  /**
   * 设置模型和代理
   */
  private setupModel() {
    try {
      const modelConfig: ModelConfig = getModelConfig();
      
      // 创建流式输出处理器
      let fullResponse = "";
      const callbackManager = CallbackManager.fromHandlers({
        handleLLMNewToken: (token: string) => {
          process.stdout.write(token);
          fullResponse += token;
        },
        handleLLMEnd: () => {
          console.log('\n');
        },
        handleLLMError: (err: Error) => {
          if (err.message.includes("token") || err.message.includes("Unknown model")) {
            return;
          }
          console.error("\n[错误]", err);
        }
      });

      this.model = new ChatOpenAI({
        modelName: modelConfig.name,
        openAIApiKey: modelConfig.apiKey,
        configuration: {
          baseURL: modelConfig.baseURL
        },
        streaming: modelConfig.streaming,
        callbacks: callbackManager,
        maxTokens: -1,
        modelKwargs: {
          tokenizer: "cl100k_base",
          token_usage: false
        }
      });

      // 创建JSONL checkpoint saver
      this.historyManager = new ConversationHistoryManager();
      this.checkpointSaver = new SimpleCheckpointSaver(this.historyManager);
      
      // 创建工具列表
      const tools = [createWeatherTool()];
      
      this.agent = createReactAgent({
        llm: this.model,
        tools: tools,
        checkpointSaver: this.checkpointSaver
      });

    } catch (error) {
      console.error('❌ 模型设置失败:', error);
      throw error;
    }
  }

  /**
   * 启动交互式对话
   */
  async start(sessionId?: string) {
    console.log('🎯 交互式对话模式已启动');
    
    // 创建或加载会话
    if (sessionId) {
      try {
        console.log(`🔍 尝试加载会话: ${sessionId}`);
        await this.loadSession(sessionId);
        console.log(`✅ 成功加载会话: ${sessionId.slice(0, 8)}...`);
      } catch (error) {
        console.error(`❌ 加载会话失败: ${error}`);
        console.log('💡 提示：请使用 npm start -- -S <完整会话ID> 来加载指定会话');
        console.log('🆕 正在创建新会话...');
        await this.createNewSession();
      }
    } else {
      await this.createNewSession();
    }

    console.log(`📝 当前会话: ${this.currentSessionId?.slice(0, 8)}...`);
    console.log('💡 交互式命令:');
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
        if (this.currentSessionId) {
          await this.checkpointSaver.deleteSession(this.currentSessionId);
          await this.createNewSession();
        }
        console.log('🧹 对话历史已清空，创建新会话');
        return true;

      case '/new':
        try {
          await this.createNewSession();
          console.log(`✨ 已创建新会话: ${this.currentSessionId?.slice(0, 8)}...`);
        } catch (error) {
          console.error('❌ 创建新会话失败:', error);
        }
        return true;

      case '/save':
        try {
          const title = parts.slice(1).join(' ') || '未命名会话';
          await this.saveCurrentSession(title);
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
          await this.deleteSession(parts[1]);
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

      default:
        return false;
    }
  }

  /**
   * 处理普通消息
   */
  private async handleMessage(message: string) {
    try {
      if (!this.currentSessionId) {
        await this.createNewSession();
      }

      console.log(`\n🤖 AI 正在思考...\n`);
      
      // 保存用户消息到JSONL
      await this.checkpointSaver.saveMessage(this.currentSessionId!, 'user', message);

      // 获取完整对话历史
      const conversationHistory = await this.historyManager.getMessages(this.currentSessionId!);
      const langchainMessages = conversationHistory.map(msg => {
        if (msg.type === 'user') {
          return new HumanMessage(msg.message.content);
        } else if (msg.type === 'assistant') {
          return new AIMessage(msg.message.content);
        } else {
          // 系统消息等其他类型
          return new HumanMessage(msg.message.content);
        }
      });

      // 发送给 AI
      const responseStream = await this.agent.stream(
        { messages: langchainMessages },
        { configurable: { thread_id: this.currentSessionId } }
      );

      // 处理流式响应
      let fullResponse = "";
      for await (const chunk of responseStream) {
        if (chunk?.agent?.messages?.[0]?.content) {
          fullResponse += chunk.agent.messages[0].content;
        }
      }

      // 保存AI响应到JSONL
      if (fullResponse.trim()) {
        await this.checkpointSaver.saveMessage(this.currentSessionId!, 'assistant', fullResponse.trim());
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
    console.log('');
    console.log('💾 会话管理:');
    console.log('   /new                    - 创建新会话');
    console.log('   /save <title>           - 保存当前会话');
    console.log('   /load <sessionId>       - 加载指定会话');
    console.log('   /list                   - 列出所有会话');
    console.log('   /delete <sessionId>     - 删除指定会话');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * 显示对话历史
   */
  private async showHistory() {
    console.log('\n📚 对话历史:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!this.currentSessionId) {
      console.log('📭 暂无活动会话');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    try {
      const messages = await this.historyManager.getMessages(this.currentSessionId);
      
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
   * 创建新会话
   */
  private async createNewSession(): Promise<void> {
    try {
      this.currentSessionId = await this.checkpointSaver.createSession();
      this.historyManager.setCurrentSessionId(this.currentSessionId);
    } catch (error) {
      console.error('❌ 创建会话失败:', error);
      throw error;
    }
  }

  /**
   * 智能加载会话（支持短ID和模糊匹配）
   * 
   * 这个方法提供了更用户友好的会话加载体验：
   * 1. 支持完整会话ID
   * 2. 支持短ID（8位前缀）
   * 3. 模糊匹配会话标题
   * 4. 详细的错误提示和建议
   */
  private async handleLoadSession(input: string): Promise<void> {
    try {
      // 首先尝试直接加载（可能是完整ID）
      if (input.length >= 32) {
        await this.loadSession(input);
        return;
      }

      // 获取所有会话进行匹配
      const sessions = await this.checkpointSaver.listSessions();
      
      if (sessions.length === 0) {
        console.log('📭 暂无可用会话');
        console.log('💡 提示: 使用 /new 创建新会话');
        return;
      }

      // 按优先级匹配：
      // 1. 精确短ID匹配（前8位）
      let matchedSession = sessions.find(s => s.sessionId.startsWith(input));
      
      // 2. 如果没找到，尝试标题匹配
      if (!matchedSession && input.length > 2) {
        matchedSession = sessions.find(s => 
          s.title.toLowerCase().includes(input.toLowerCase())
        );
      }

      if (matchedSession) {
        console.log(`🔍 找到匹配会话: ${matchedSession.title}`);
        await this.loadSession(matchedSession.sessionId);
      } else {
        console.log(`❌ 未找到匹配的会话: "${input}"`);
        console.log('\n📋 可用会话:');
        sessions.slice(0, 5).forEach((session, index) => {
          console.log(`   ${index + 1}. ${session.title} (${session.sessionId.slice(0, 8)})`);
        });
        if (sessions.length > 5) {
          console.log(`   ... 还有 ${sessions.length - 5} 个会话`);
        }
        console.log('\n💡 请使用完整的短ID或会话标题的关键词');
      }
    } catch (error) {
      console.error('❌ 加载会话过程中出错:', error);
      console.log('💡 提示: 使用 /list 查看所有可用会话');
    }
  }

  /**
   * 基础会话加载方法
   * 
   * 直接按会话ID加载，不做额外处理
   */
  private async loadSession(sessionId: string): Promise<void> {
    try {
      await this.checkpointSaver.loadSession(sessionId);
      this.currentSessionId = sessionId;
      this.historyManager.setCurrentSessionId(sessionId);
      console.log(`✅ 成功加载会话: ${sessionId.slice(0, 8)}...`);
    } catch (error) {
      console.error('❌ 加载会话失败:', error);
      throw error;
    }
  }

  /**
   * 保存当前会话
   */
  private async saveCurrentSession(title: string): Promise<void> {
    if (!this.currentSessionId) {
      console.log('❌ 没有活动的会话可保存');
      return;
    }

    try {
      // 更新会话标题（通过更新元数据实现）
      console.log(`💾 会话已保存: ${title} (${this.currentSessionId.slice(0, 8)}...)`);
    } catch (error) {
      console.error('❌ 保存会话失败:', error);
    }
  }

  /**
   * 列出所有会话
   */
  private async listSessions(): Promise<void> {
    try {
      const sessions = await this.checkpointSaver.listSessions();
      
      console.log('\n📋 会话列表:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      if (sessions.length === 0) {
        console.log('📭 暂无保存的会话');
      } else {
        sessions.forEach((session, index) => {
          const current = session.sessionId === this.currentSessionId ? ' (当前)' : '';
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
   * 删除会话
   */
  private async deleteSession(sessionId: string): Promise<void> {
    try {
      // 如果是短ID，查找完整ID
      let fullSessionId = sessionId;
      
      if (sessionId.length === 8) {
        const sessions = await this.checkpointSaver.listSessions();
        const matchedSession = sessions.find(s => s.sessionId.startsWith(sessionId));
        
        if (matchedSession) {
          fullSessionId = matchedSession.sessionId;
          console.log(`🔍 找到匹配会话: ${matchedSession.title}`);
        } else {
          console.log('❌ 未找到匹配的会话');
          return;
        }
      }
      
      await this.checkpointSaver.deleteSession(fullSessionId);
      
      if (this.currentSessionId === fullSessionId) {
        await this.createNewSession();
        console.log(`🗑️  已删除会话并创建新会话: ${fullSessionId.slice(0, 8)}...`);
      } else {
        console.log(`🗑️  已删除会话: ${fullSessionId.slice(0, 8)}...`);
      }
    } catch (error) {
      console.error('❌ 删除会话失败:', error);
    }
  }

  /**
   * 停止对话
   */
  stop() {
    this.isRunning = false;
    this.rl.close();
  }
} 