import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getModelConfig, getDefaultModel } from "@/config/config.js";
import type { ModelConfig } from "@/types/index.js";
import { tools } from "@/utils/tools/index.js";
import { SimpleCheckpointSaver } from "./simple-checkpoint-saver.js";
import { ConversationHistoryManager } from "./conversation-history.js";
import type { ConversationMessage, SessionMetadata } from "@/types/conversation.js";
import { LoggerManager } from "./logger/logger.js";
import { startupPrompt } from "@/prompts/startup.js";
import fs from 'fs';
import path from 'path';
import { getSystemPrompt } from './prompt-manager';

/**
 * AI代理循环管理器
 * 负责处理与AI模型的交互、消息处理、会话管理等功能
 */
export class AgentLoop {
  private model!: ChatOpenAI;  //使用的模型
  private agent!: any;  //代理
  private checkpointSaver!: SimpleCheckpointSaver;  //检查点保存器
  private historyManager!: ConversationHistoryManager;  //历史记录管理器
  private currentSessionId: string | null = null;  //当前会话ID
  private isInitialized = false;  //是否初始化
  private logger: any;  //日志记录器
  private modelAlias: string;  //当前使用的模型别名
  private systemPrompt: string;  //系统提示词

  //初始化
  constructor(modelAlias?: string) {
    this.logger = LoggerManager.getInstance().getLogger('agent-loop');
    
    // 如果没有指定模型别名，从配置文件中获取默认模型
    if (!modelAlias) {
      const defaultModel = getDefaultModel();
      if (!defaultModel) {
        throw new Error('配置文件中未设置默认模型，请使用 -m 参数指定模型别名');
      }
      this.modelAlias = defaultModel;
    } else {
      this.modelAlias = modelAlias;
    }
    
    // 设置系统提示词
    this.systemPrompt = startupPrompt;

    this.initialize();
  }

  /**
   * 初始化模型和代理
   */
  private initialize() {
    try {
      this.logger.info('开始初始化AgentLoop', { modelAlias: this.modelAlias });
      
      //获取模型配置
      const modelConfig: ModelConfig = getModelConfig(this.modelAlias);
      this.logger.info('获取模型配置成功', { 
        modelAlias: this.modelAlias,
        modelName: modelConfig.name, 
        baseURL: modelConfig.baseURL 
      });
      
      //创建流式输出处理器
      const callbackManager = CallbackManager.fromHandlers({
        handleLLMNewToken: (token: string) => {
          process.stdout.write(token);
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

      //创建模型
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
      this.logger.info('工具列表创建成功', { toolCount: tools.length });
      
      // 创建代理
      this.agent = createReactAgent({
        llm: this.model,
        tools: tools,
        checkpointSaver: this.checkpointSaver,
        // interruptBefore: ["tools"]，
        postModelHook: async (state) => {  
          const lastMessage = state.messages[state.messages.length - 1];  
          // 检查消息是否包含工具调用
          if (lastMessage && 'tool_calls' in lastMessage && (lastMessage as any).tool_calls?.length > 0) {  
            console.log("正在调用工具", (lastMessage as any).tool_calls[0].name);  
            
            // 保存工具调用消息到对话历史
            if (this.currentSessionId) {
              const toolCalls = (lastMessage as any).tool_calls;
              for (const toolCall of toolCalls) {
                const inputStr = typeof toolCall.args === 'object' 
                  ? JSON.stringify(toolCall.args, null, 2)
                  : toolCall.args || '无输入参数';
                const toolCallMessage = `🛠️ 调用工具: ${toolCall.name}\n输入: ${inputStr}`;
                await this.checkpointSaver.saveMessage(this.currentSessionId, 'system', toolCallMessage);
              }
            }
          }
          
          // 检查是否有工具调用结果
          if ((state as any).tools && (state as any).tools.length > 0) {
            if (this.currentSessionId) {
              for (const toolResult of (state as any).tools) {
                if (toolResult.error) {
                  const toolErrorMessage = `❌ 工具调用失败 (${toolResult.name}):\n${toolResult.error}`;
                  await this.checkpointSaver.saveMessage(this.currentSessionId, 'system', toolErrorMessage);
                } else if (toolResult.output) {
                  const toolResultMessage = `✅ 工具调用结果 (${toolResult.name}):\n${toolResult.output}`;
                  await this.checkpointSaver.saveMessage(this.currentSessionId, 'system', toolResultMessage);
                }
              }
            }
          }
          
          return {};  
        },
      });

      this.isInitialized = true;
      this.logger.info('AgentLoop初始化完成', { modelAlias: this.modelAlias });
    } catch (error) {
      this.logger.error('模型初始化失败', { 
        modelAlias: this.modelAlias,
        error: error instanceof Error ? error.message : String(error) 
      });
      console.error('❌ 模型初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前使用的模型别名
   */
  getModelAlias(): string {
    return this.modelAlias;
  }

  /**
   * 获取系统提示词
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * 设置系统提示词
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 获取当前会话ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * 创建新会话
   */
  async createNewSession(): Promise<string> {
    try {
      this.currentSessionId = await this.checkpointSaver.createSession();
      this.historyManager.setCurrentSessionId(this.currentSessionId);
      // 插入 system_prompt 作为 system 消息
      const systemPrompt = getSystemPrompt();
      const systemMessage = this.historyManager.createMessage('system', systemPrompt);
      await this.checkpointSaver.saveMessage(this.currentSessionId, 'system', systemPrompt);
      return this.currentSessionId;
    } catch (error) {
      console.error('❌ 创建会话失败:', error);
      throw error;
    }
  }

  /**
   * 加载指定会话
   */
  async loadSession(sessionId: string): Promise<void> {
    try {
      await this.checkpointSaver.loadSession(sessionId);
      this.currentSessionId = sessionId;
      this.historyManager.setCurrentSessionId(sessionId);
    } catch (error) {
      console.error('❌ 加载会话失败:', error);
      throw error;
    }
  }

  /**
   * 智能加载会话（支持短ID和模糊匹配）
   */
  async loadSessionSmart(input: string): Promise<boolean> {
    try {
      // 首先尝试直接加载（可能是完整ID）
      if (input.length >= 32) {
        await this.loadSession(input);
        return true;
      }

      // 获取所有会话进行匹配
      const sessions = await this.checkpointSaver.listSessions();
      
      if (sessions.length === 0) {
        return false;
      }

      // 按优先级匹配：
      // 1. 精确短ID匹配（前8位）
      let matchedSession = sessions.find(s => s.sessionId.startsWith(input));
      
      if (matchedSession) {
        await this.loadSession(matchedSession.sessionId);
        return true;
      }

      // 2. 标题模糊匹配
      matchedSession = sessions.find(s => 
        s.title.toLowerCase().includes(input.toLowerCase())
      );
      
      if (matchedSession) {
        await this.loadSession(matchedSession.sessionId);
        return true;
      }

      return false;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 处理消息
   */
  async processMessage(message: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        throw new Error('AgentLoop未初始化');
      }

      if (!this.currentSessionId) {
        await this.createNewSession();
      }

      // 保存用户消息
      await this.checkpointSaver.saveMessage(this.currentSessionId!, 'user', message);

      // 获取会话历史
      const conversationHistory = await this.historyManager.getMessages(this.currentSessionId!);
      
      // 构建消息列表，包含系统提示词
      const messages = [
        new SystemMessage(this.systemPrompt),
        ...conversationHistory.map(msg => {
          if (msg.type === 'user') {
            return new HumanMessage(msg.message.content);
          } else if (msg.type === 'assistant') {
            return new AIMessage(msg.message.content);
          } else {
            // 系统消息等其他类型，转换为用户消息
            return new HumanMessage(msg.message.content);
          }
        }),
        new HumanMessage(message)
      ];

      // 调用代理处理
      const result = await this.agent.invoke({
        messages: messages
      }, {
        configurable: { thread_id: this.currentSessionId }
      });

      // 保存AI回复
      if (result.messages && result.messages.length > 0) {
        const lastMessage = result.messages[result.messages.length - 1];
        if (lastMessage instanceof AIMessage) {
          const content = typeof lastMessage.content === 'string' 
            ? lastMessage.content 
            : JSON.stringify(lastMessage.content);
          await this.checkpointSaver.saveMessage(this.currentSessionId!, 'assistant', content);
        }
      }

      // 保存最后会话ID
      this.saveLastSessionId();
      
      const lastMessage = result.messages?.[result.messages.length - 1];
      const content = lastMessage instanceof AIMessage 
        ? (typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content))
        : '无回复内容';
      
      // 计算并输出响应时间
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      console.log(`\n⏱️  响应时间: ${responseTime}ms`);
      
      return content;
    } catch (error) {
      // 即使出错也记录响应时间
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      console.log(`\n⏱️  响应时间: ${responseTime}ms (出错)`);
      
      console.error('❌ 处理消息失败:', error);
      throw error;
    }
  }

  /**
   * 列出所有会话
   */
  async listSessions(): Promise<SessionMetadata[]> {
    return await this.checkpointSaver.listSessions();
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await this.checkpointSaver.deleteSession(sessionId);
      
      // 如果删除的是当前会话，清空当前会话ID
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = null;
        this.historyManager.setCurrentSessionId('');
      }
      
      return true;
    } catch (error) {
      console.error('❌ 删除会话失败:', error);
      return false;
    }
  }

  /**
   * 清空当前会话
   */
  async clearCurrentSession(): Promise<void> {
    if (this.currentSessionId) {
      await this.createNewSession();
    }
  }

  /**
   * 获取当前会话历史
   */
  async getCurrentSessionHistory(): Promise<ConversationMessage[]> {
    if (!this.currentSessionId) {
      return [];
    }
    return await this.historyManager.getMessages(this.currentSessionId);
  }

  /**
   * 保存当前会话
   */
  async saveCurrentSession(title: string): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error('没有当前会话可保存');
    }
    
    // 这里可以添加保存会话标题的逻辑
    // 目前SimpleCheckpointSaver没有直接支持更新标题的方法
    console.log(`💾 会话已保存: ${title} (${this.currentSessionId.slice(0, 8)}...)`);
  }

  /**
   * 检查会话是否存在
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    try {
      const sessions = await this.listSessions();
      return sessions.some(s => s.sessionId === sessionId);
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取会话信息
   */
  async getSessionInfo(sessionId: string): Promise<SessionMetadata | null> {
    try {
      const sessions = await this.listSessions();
      return sessions.find(s => s.sessionId === sessionId) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 销毁资源
   */
  destroy(): void {
    // 清理资源
    this.currentSessionId = null;
    this.isInitialized = false;
  }

  /**
   * 保存最后会话ID到文件
   */
  saveLastSessionId(): void {
    if (!this.currentSessionId) return;
    
    try {
      const bytecraftDir = path.join(process.cwd(), '.bytecraft');
      const lastSessionFile = path.join(bytecraftDir, 'lastsession');
      
      // 确保目录存在
      if (!fs.existsSync(bytecraftDir)) {
        fs.mkdirSync(bytecraftDir, { recursive: true });
      }
      
      // 写入最后会话ID
      fs.writeFileSync(lastSessionFile, this.currentSessionId, 'utf8');
    } catch (error) {
      this.logger.error('保存最后会话ID失败', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * 从文件加载最后会话ID
   */
  loadLastSessionId(): string | null {
    try {
      const lastSessionFile = path.join(process.cwd(), '.bytecraft', 'lastsession');
      
      if (fs.existsSync(lastSessionFile)) {
        const sessionId = fs.readFileSync(lastSessionFile, 'utf8').trim();
        return sessionId || null;
      }
    } catch (error) {
      this.logger.error('加载最后会话ID失败', { error: error instanceof Error ? error.message : String(error) });
    }
    
    return null;
  }
} 