import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { StateGraph, Annotation, MessagesAnnotation, END, START } from "@langchain/langgraph";
import { getModelConfig, getDefaultModel } from "@/config/config.js";
import type { ModelConfig } from "@/types/index.js";
import { getTools } from "@/utils/tools/index.js";
import { SimpleCheckpointSaver } from "./simple-checkpoint-saver.js";
import { ConversationHistoryManager } from "./conversation-history.js";
import type { ConversationMessage, SessionMetadata } from "@/types/conversation.js";
import { LoggerManager } from "./logger/logger.js";
import { startupPrompt } from "@/prompts/startup.js";
import { CodingPrompts } from "@/prompts/coding-prompts.js";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { PerformanceMonitor } from "./performance-monitor.js";
import fs from 'fs';
import path from 'path';
import { AgentPromptIntegration, presetConfigs } from '../prompts/index.js';
import { PromptMode, PromptManager } from '@/prompts/prompt-manager.js';

// 流式输出回调接口
export interface StreamingCallback {
  onToken?: (token: string) => void;
  onToolCall?: (toolName: string, args: any) => void;
  onToolResult?: (toolName: string, result: any) => void;
  onComplete?: (finalResponse: string) => void;
  onError?: (error: Error) => void;
}

/**
 * AI代理循环管理器
 * 负责处理与AI模型的交互、消息处理、会话管理等功能
 */
export class AgentLoop {
  private model!: ChatOpenAI;  //使用的模型
  private modelWithTools!: any;  //绑定工具的模型
  private workflow!: any;  //工作流
  private checkpointSaver!: SimpleCheckpointSaver;  //检查点保存器
  private historyManager!: ConversationHistoryManager;  //历史记录管理器
  private currentSessionId: string | null = null;  //当前会话ID
  private isInitialized = false;  //是否初始化
  private logger: any;  //日志记录器
  private modelAlias: string;  //当前使用的模型别名
  private systemPrompt: string;  //系统提示词
  private performanceMonitor: PerformanceMonitor;  //性能监控器
  private tools: any[] = [];  //工具列表
  private promptIntegration!: AgentPromptIntegration;
  private currentMode: PromptMode = 'coding';  // 默认模式为 coding
  private promptManager: PromptManager;  // 提示词管理器

  //初始化
  constructor(modelAlias?: string) {
    this.logger = LoggerManager.getInstance().getLogger('agent-loop');
    this.performanceMonitor = PerformanceMonitor.getInstance();
    
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
    
    // 初始化提示词管理器
    this.promptManager = new PromptManager(this.currentMode);
    
    // 设置系统提示词
    this.systemPrompt = startupPrompt;

    this.promptIntegration = new AgentPromptIntegration({
      ...presetConfigs.developer,
      projectContext: {
        name: 'ByteCraft',
        type: 'AI Assistant',
        language: 'TypeScript',
      }
    });

    // 异步初始化
    this.initialize().catch(error => {
      this.logger.error('AgentLoop异步初始化失败', { error });
      throw error;
    });
  }

  /**
   * 初始化模型和工作流
   */
  private async initialize() {
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
      
      // 异步创建工具列表
      this.tools = await getTools();
      this.logger.info('工具列表创建成功', { toolCount: this.tools.length });
      
      // 绑定工具到模型
      this.modelWithTools = this.model.bindTools(this.tools);
      
      // 创建工作流
      this.workflow = this.createWorkflow();      // 工具列表创建后，根据当前模式生成系统提示词
      // 先从 promptIntegration 获取初始化的系统提示词
      const baseSystemPrompt = await this.promptIntegration.initializeSystemMessage(this.tools);
      
      // 然后根据当前模式更新系统提示词
      const options = {
        language: '中文',
        availableTools: this.tools.map(tool => tool.name),
        projectContext: {
          name: 'ByteCraft',
          type: 'AI Assistant',
          language: 'TypeScript',
        }
      };
      
      // 如果是初始模式，使用 baseSystemPrompt，否则使用 promptManager 生成的提示词
      this.systemPrompt = this.currentMode === 'coding' 
        ? baseSystemPrompt 
        : this.promptManager.formatSystemPrompt(options);

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
   * 创建自定义工作流
   */
  private createWorkflow() {    // 分析节点 - 处理用户输入并可能调用工具
    const agentNode = async (state: typeof MessagesAnnotation.State) => {
      console.log("\n🧠 分析处理...");
      
      // 确保消息包含系统提示词
      let messages = state.messages;
      
      // 检查首条消息是否为系统消息，如果不是则添加
      if (messages.length === 0 || messages[0]._getType() !== 'system') {
        messages = [new SystemMessage(this.systemPrompt), ...messages];
      }
      
      const response = await this.modelWithTools.invoke(messages);
      return { messages: [response] };
    };

    // 工具节点
    const toolNodeForGraph = new ToolNode(this.tools);

    // 工具调用决策函数
    const shouldContinue = (state: typeof MessagesAnnotation.State) => {
      const { messages } = state;
      const lastMessage = messages[messages.length - 1];
      
      console.log(`\n🔄 检查工具调用`);
      
      if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls?.length) {
        console.log(`✅ 正在处理 ${lastMessage.tool_calls.length} 个工具调用...`);
        
        // 显示具体调用了什么工具以及处理什么事情
        lastMessage.tool_calls.forEach((toolCall, index) => {
          const toolName = toolCall.name;
          const toolArgs = toolCall.args;
          console.log(`🛠️  调用工具 ${toolName}`);
          console.log(`📝  参数: ${JSON.stringify(toolArgs, null, 2)}`);
        });
        
        return "tools";
      }
      
      console.log("✅ 无工具调用，结束处理");
      return END;
    };

    // 构建工作流
    return new StateGraph(MessagesAnnotation)
      .addNode("agent", agentNode)
      .addNode("tools", toolNodeForGraph)
      .addEdge(START, "agent")
      .addConditionalEdges("agent", shouldContinue, ["tools", END])
      .addEdge("tools", "agent")
      .compile();
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
      
      // 保存系统提示词到新会话
      await this.checkpointSaver.saveMessage(this.currentSessionId, 'system', this.systemPrompt);
      
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
  async processMessage(message: string, callback?: StreamingCallback): Promise<string> {
    
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        throw new Error('AgentLoop未初始化');
      }

      if (!this.currentSessionId) {
        await this.createNewSession();
      }

      // 保存用户消息
      const saveStart = Date.now();
      await this.checkpointSaver.saveMessage(this.currentSessionId!, 'user', message);
      this.performanceMonitor.record('saveUserMessage', Date.now() - saveStart);

      // 调用工作流处理
      const workflowStart = Date.now();
      console.log("正在处理用户需求")
      
      // 获取对话历史
      const conversationHistory = await this.historyManager.getMessages(this.currentSessionId!);
      
      // 构建消息数组，包含系统提示词、历史对话和当前用户消息
      const messages = [new SystemMessage(this.systemPrompt)]; // 添加系统提示词
      
      // 添加历史对话消息（排除系统消息，因为已经添加了）
      for (const historyMessage of conversationHistory) {
        if (historyMessage.type === 'user') {
          messages.push(new HumanMessage(historyMessage.message.content));
        } else if (historyMessage.type === 'assistant') {
          messages.push(new AIMessage(historyMessage.message.content));
        }
        // 跳过系统消息，因为已经在开头添加了
      }
      
      // 添加当前用户消息
      messages.push(new HumanMessage(message));
      
      // 如果有回调，创建自定义回调管理器
      let result;
      if (callback) {
        // 创建自定义回调管理器，支持流式输出回调
        const customCallbackManager = CallbackManager.fromHandlers({
          handleLLMNewToken: (token: string) => {
            // 调用自定义回调
            callback?.onToken?.(token);
          },
          handleLLMEnd: () => {
            // console.log('\n');
          },
          handleLLMError: (err: Error) => {
            if (err.message.includes("token") || err.message.includes("Unknown model")) {
              return;
            }
            console.error("\n[错误]", err);
            callback?.onError?.(err);
          },
          handleToolStart: (
            tool: any,
            input: string,
            runId?: string,
            _parentRunId?: string,
            _tags?: string[],
            _metadata?: Record<string, unknown>,
            runName?: string
          ) => {
            // 修复工具名称提取逻辑
            let toolName = "unknown";
            if (tool && typeof tool === 'object') {
              if (Array.isArray(tool.id)) {
                // 如果 id 是数组，取最后一个元素作为工具名
                const lastPart = tool.id[tool.id.length - 1] || "unknown";
                // 转换 FileManagerTool -> file_manager
                toolName = lastPart.replace(/Tool$/, '').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
              } else {
                toolName = tool.name || tool.id || tool.type || "unknown";
              }
            }
            
            // 解析输入参数
            let toolArgs = {};
            try {
              if (input && typeof input === 'string') {
                // input 是双重JSON编码的，需要解析两次
                let parsed = JSON.parse(input);
                if (typeof parsed === 'string') {
                  parsed = JSON.parse(parsed);
                }
                toolArgs = parsed;
              }
            } catch (error) {
              toolArgs = { input: input };
            }
            
            callback?.onToolCall?.(toolName, toolArgs);
          },
          handleToolEnd: (output: any) => {
            let toolName = "unknown";
            let result = output;
            
            if (output && typeof output === 'object') {
              // 从 ToolMessage 中提取工具名称
              if (output.name) {
                toolName = output.name; // 这里应该是 file_manager
              }
              
              // 解析 content 字段
              if (output.content) {
                try {
                  result = JSON.parse(output.content);
                } catch {
                  result = output.content;
                }
              }
            }
            
            callback?.onToolResult?.(toolName, result);
          }
        });

        // 使用工作流，但应用自定义回调管理器
        result = await this.workflow.invoke({
          messages: messages
        }, {
          configurable: { thread_id: this.currentSessionId },
          callbacks: customCallbackManager,
          recursionLimit: 25
        });
      } else {
        // 使用原有工作流
        result = await this.workflow.invoke({
          messages: messages
        }, {
          configurable: { thread_id: this.currentSessionId }
        });
      }
      
      console.log("用户需求处理结束")
      this.performanceMonitor.record('workflowInvoke', Date.now() - workflowStart);

      // 保存AI回复
      const saveAIStart = Date.now();
      if (result.messages && result.messages.length > 0) {
        for (const message of result.messages) {
          const content = typeof message.content === 'string' 
            ? message.content 
            : JSON.stringify(message.content);
          await this.checkpointSaver.saveMessage(this.currentSessionId!, 'assistant', content);
        }
      }
      this.performanceMonitor.record('saveAIMessage', Date.now() - saveAIStart);

      // 保存最后会话ID
      this.saveLastSessionId();
      
      const lastMessage = result.messages && result.messages.length > 0 ? result.messages[result.messages.length - 1] : null;
      const finalResponse = lastMessage 
        ? (typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content))
        : '无回复内容';
      
      // 计算并输出响应时间
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      console.log(`\n⏱️  响应时间: ${responseTime}ms`);
      
      // 调用完成回调
      callback?.onComplete?.(finalResponse);
      
      return finalResponse;
    } catch (error) {
      // 即使出错也记录响应时间
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      console.log(`\n⏱️  响应时间: ${responseTime}ms (出错)`);
      
      console.error('❌ 处理消息失败:', error);
      
      // 调用错误回调
      if (error instanceof Error) {
        callback?.onError?.(error);
      }
      
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
   * 获取性能报告
   */
  getPerformanceReport(): void {
    this.performanceMonitor.printReport();
  }

  /**
   * 清除性能监控数据
   */
  clearPerformanceData(): void {
    this.performanceMonitor.clear();
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { messageCacheSize: number; metadataCacheSize: number; totalSessions: number } {
    return this.historyManager.getCacheStats();
  }

  /**
   * 清除缓存
   */
  clearCache(sessionId?: string): void {
    this.historyManager.clearCache(sessionId);
  }

  /**
   * 销毁资源
   */
  destroy(): void {
    // 清理资源
    this.currentSessionId = null;
    this.isInitialized = false;
    this.clearCache();
    this.clearPerformanceData();
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
  /**
   * 切换对话模式
   * @param mode 模式名称: 'coding', 'ask', 'help'
   * @returns 是否切换成功
   */
  async switchMode(mode: PromptMode): Promise<boolean> {
    this.logger.info(`尝试切换到模式: ${mode}`, { previousMode: this.currentMode });
    
    try {
      // 如果模式相同，则不需要切换
      if (this.currentMode === mode) {
        this.logger.info('已经是请求的模式，无需切换');
        return true;
      }
      
      // 更新当前模式
      this.currentMode = mode;
      
      // 更新promptManager的模式
      this.promptManager.switchMode(mode);
      
      // 使用新模式的提示词更新系统提示
      const options = {
        language: '中文',
        availableTools: this.tools.map(tool => tool.name),
        projectContext: {
          name: 'ByteCraft',
          type: 'AI Assistant',
          language: 'TypeScript',
        }
      };
      
      // 根据模式选择适当的系统提示词
      if (mode === 'coding') {
        // 对于 coding 模式，使用 promptIntegration 生成的提示词
        this.systemPrompt = await this.promptIntegration.initializeSystemMessage(this.tools);
        this.logger.info('已加载编码模式的系统提示词');
      } else {
        // 对于其他模式，使用 promptManager 生成的提示词
        this.systemPrompt = this.promptManager.formatSystemPrompt(options);
        this.logger.info(`已加载${mode}模式的系统提示词`);
      }
      
      // 如果有活动会话，更新会话的系统消息
      if (this.currentSessionId && this.isInitialized) {
        await this.updateSystemMessage();
      }
      
      this.logger.info(`成功切换到模式: ${mode}`);
      return true;
    } catch (error) {
      this.logger.error(`切换模式失败: ${error}`, { error });
      return false;
    }
  }
  /**
   * 更新当前会话的系统消息
   * 注意：此方法将创建一个新会话以应用新的系统提示
   */
  private async updateSystemMessage(): Promise<void> {
    try {
      this.logger.info(`正在为模式 [${this.currentMode}] 创建新会话`);
      
      // 创建新会话，这将自动使用当前的 this.systemPrompt 作为系统消息
      await this.createNewSession();
      
      this.logger.info(`已创建新会话，应用了 [${this.currentMode}] 模式的系统提示`);
    } catch (error) {
      this.logger.error('更新系统消息失败', { error });
      throw error;
    }
  }
}