import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getModelConfig } from "@/config/config.js";
import type { ModelConfig } from "@/types/index.js";
import { tools } from "@/utils/tools/index.js";
import { SimpleCheckpointSaver } from "./simple-checkpoint-saver.js";
import { ConversationHistoryManager } from "./conversation-history.js";
import type { ConversationMessage, SessionMetadata } from "@/types/conversation.js";
import { LoggerManager } from "./logger/logger.js";
import fs from 'fs';
import path from 'path';

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

  //初始化
  constructor(modelAlias?: string) {
    this.logger = LoggerManager.getInstance().getLogger('agent-loop');
    this.modelAlias = modelAlias || 'deepseek-r1'; // 默认使用deepseek-r1
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
      
      // 2. 如果没找到，尝试标题匹配
      if (!matchedSession && input.length > 2) {
        matchedSession = sessions.find(s => 
          s.title.toLowerCase().includes(input.toLowerCase())
        );
      }

      if (matchedSession) {
        await this.loadSession(matchedSession.sessionId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ 智能加载会话失败:', error);
      return false;
    }
  }

  /**
   * 处理用户消息并获取AI响应
   */
  async processMessage(message: string): Promise<string> {
    try {
      this.logger.info('开始处理用户消息', { message: message.substring(0, 100) + '...' });
      
      if (!this.currentSessionId) {
        await this.createNewSession();
      }

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

      this.logger.info('准备发送消息给AI', { messageCount: langchainMessages.length });
      // 发送给 AI
      const responseStream = await this.agent.stream(
        { messages: langchainMessages },
        { configurable: { thread_id: this.currentSessionId } }
      );
      const state = await this.agent.getState({ configurable: { thread_id: this.currentSessionId } })
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

      this.logger.info('消息处理完成', { responseLength: fullResponse.length });
      return fullResponse.trim();
    } catch (error) {
      this.logger.error('处理消息失败', { error: error instanceof Error ? error.message : String(error) });
      console.error('❌ 处理消息失败:', error);
      throw error;
    } finally {
      // 保存最后会话ID
      this.saveLastSessionId();
    }
  }

  /**
   * 获取会话列表
   */
  async listSessions(): Promise<SessionMetadata[]> {
    try {
      return await this.checkpointSaver.listSessions();
    } catch (error) {
      console.error('❌ 获取会话列表失败:', error);
      throw error;
    }
  }

  /**
   * 删除指定会话
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      // 如果是短ID，查找完整ID
      let fullSessionId = sessionId;
      
      if (sessionId.length === 8) {
        const sessions = await this.checkpointSaver.listSessions();
        const matchedSession = sessions.find(s => s.sessionId.startsWith(sessionId));
        
        if (matchedSession) {
          fullSessionId = matchedSession.sessionId;
        } else {
          return false;
        }
      }
      
      await this.checkpointSaver.deleteSession(fullSessionId);
      
      // 如果删除的是当前会话，创建新会话
      if (this.currentSessionId === fullSessionId) {
        await this.createNewSession();
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
      await this.checkpointSaver.deleteSession(this.currentSessionId);
      await this.createNewSession();
    }
  }

  /**
   * 获取当前会话的对话历史
   */
  async getCurrentSessionHistory(): Promise<ConversationMessage[]> {
    if (!this.currentSessionId) {
      return [];
    }
    
    try {
      return await this.historyManager.getMessages(this.currentSessionId);
    } catch (error) {
      console.error('❌ 获取对话历史失败:', error);
      return [];
    }
  }

  /**
   * 保存当前会话（更新标题）
   */
  async saveCurrentSession(title: string): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error('没有活动的会话可保存');
    }

    // 这里可以添加保存会话标题的逻辑
    // 目前SimpleCheckpointSaver没有直接支持更新标题的方法
    // 可以通过更新元数据文件来实现
    console.log(`💾 会话已保存: ${title} (${this.currentSessionId.slice(0, 8)}...)`);
  }

  /**
   * 检查会话是否存在
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    try {
      const sessions = await this.checkpointSaver.listSessions();
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
      const sessions = await this.checkpointSaver.listSessions();
      return sessions.find(s => s.sessionId === sessionId) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 销毁代理（清理资源）
   */
  destroy(): void {
    this.currentSessionId = null;
    this.isInitialized = false;
  }

  /**
   * 保存最后会话ID
   */
  saveLastSessionId(): void {
    if (this.currentSessionId) {
      try {
        const lastSessionPath = path.join('.bytecraft', 'lastsession');
        const dir = path.dirname(lastSessionPath);
        
        // 确保目录存在
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(lastSessionPath, this.currentSessionId);
        this.logger.info('最后会话ID已保存', { lastSessionId: this.currentSessionId });
      } catch (error) {
        this.logger.error('保存最后会话ID失败', { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  /**
   * 加载最后会话ID
   */
  loadLastSessionId(): string | null {
    try {
      const lastSessionPath = path.join('.bytecraft', 'lastsession');
      
      if (!fs.existsSync(lastSessionPath)) {
        this.logger.info('最后会话文件不存在', { lastSessionPath });
        return null;
      }
      
      const lastSessionId = fs.readFileSync(lastSessionPath, 'utf-8').trim();
      
      if (!lastSessionId) {
        this.logger.warning('最后会话文件为空', { lastSessionPath });
        return null;
      }
      
      this.currentSessionId = lastSessionId;
      this.historyManager.setCurrentSessionId(this.currentSessionId);
      this.logger.info('最后会话ID已加载', { lastSessionId });
      console.log(`📂 已加载最后会话: ${lastSessionId.slice(0, 8)}...`);
      
      return lastSessionId;
    } catch (error) {
      this.logger.error('加载最后会话ID失败', { error: error instanceof Error ? error.message : String(error) });
      console.log('⚠️  无法加载最后会话，将创建新会话');
      return null;
    }
  }
} 