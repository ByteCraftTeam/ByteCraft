//这是cursor生成的聊天demo，可以不用看先，后面要改的
import readline from 'readline';
import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { getModelConfig } from "@/config/config.js";
import type { ModelConfig } from "@/types/index.js";
import { createWeatherTool } from "@/utils/tools/weather.js";

/**
 * 交互式对话管理器
 */
export class InteractiveChat {
  private rl: readline.Interface;
  private model!: ChatOpenAI;
  private agent!: any;
  private conversationHistory: HumanMessage[] = [];
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

      // 创建工具列表
      const tools = [createWeatherTool()];
      
      this.agent = createReactAgent({
        llm: this.model,
        tools: tools,
        checkpointSaver: new MemorySaver()
      });

    } catch (error) {
      console.error('❌ 模型设置失败:', error);
      throw error;
    }
  }

  /**
   * 启动交互式对话
   */
  async start() {
    console.log('🎯 交互式对话模式已启动');
    console.log('💡 可用命令:');
    console.log('   - quit/exit: 退出对话');
    console.log('   - clear: 清空对话历史');
    console.log('   - help: 显示帮助信息');
    console.log('   - history: 显示对话历史');
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
    const command = input.toLowerCase();

    switch (command) {
      case 'quit':
      case 'exit':
        console.log('👋 正在退出...');
        this.rl.close();
        return true;

      case 'clear':
        this.conversationHistory = [];
        console.log('🧹 对话历史已清空');
        return true;

      case 'help':
        this.showHelp();
        return true;

      case 'history':
        this.showHistory();
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
      console.log(`\n🤖 AI 正在思考...\n`);
      
      // 添加到对话历史
      const humanMessage = new HumanMessage(message);
      this.conversationHistory.push(humanMessage);

      // 发送给 AI
      const responseStream = await this.agent.stream(
        { messages: this.conversationHistory },
        { configurable: { thread_id: "interactive" } }
      );

      // 处理流式响应
      for await (const chunk of responseStream) {
        if (chunk?.content) {
          // 内容已经在 callback 中处理了
        }
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
    console.log('🔧 可用命令:');
    console.log('   quit/exit  - 退出对话');
    console.log('   clear      - 清空对话历史');
    console.log('   help       - 显示此帮助');
    console.log('   history    - 显示对话历史');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * 显示对话历史
   */
  private showHistory() {
    console.log('\n📚 对话历史:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (this.conversationHistory.length === 0) {
      console.log('📭 暂无对话历史');
    } else {
      this.conversationHistory.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.content}`);
      });
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * 停止对话
   */
  stop() {
    this.isRunning = false;
    this.rl.close();
  }
} 