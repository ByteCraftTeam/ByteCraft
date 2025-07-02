import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import {
  StateGraph,
  Annotation,
  MessagesAnnotation,
  END,
  START,
} from "@langchain/langgraph";
import { getModelConfig, getDefaultModel, getContextManagerConfig, getDebugConfig } from "@/config/config.js";
import type { ModelConfig } from "@/types/index.js";
import { getTools } from "@/utils/tools/index.js";
import { SimpleCheckpointSaver } from "./simple-checkpoint-saver.js";
import { ConversationHistoryManager } from "./conversation-history.js";
import { ContextManager } from "./context-manager.js";
import type {
  ConversationMessage,
  SessionMetadata,
} from "@/types/conversation.js";
import { LoggerManager } from "./logger/logger.js";
import { startupPrompt } from "@/prompts/startup.js";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { PerformanceMonitor } from "./performance-monitor.js";
import fs from 'fs';
import path from 'path';
import { AgentPromptIntegration, presetConfigs } from '../prompts/index.js';
import { PromptManager } from '@/prompts/prompt-manager.js';
import { TOOL_METAS } from '../utils/tools/tool-metas.js';
import { ToolPrompts } from '@/prompts/tool-prompts.js';

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
  private model!: ChatOpenAI; //使用的模型
  private modelWithTools!: any; //绑定工具的模型
  private workflow!: any; //工作流
  private checkpointSaver!: SimpleCheckpointSaver; //检查点保存器
  private historyManager!: ConversationHistoryManager; //历史记录管理器
  private contextManager!: ContextManager; //上下文管理器
  private currentSessionId: string | null = null; //当前会话ID
  private isInitialized = false; //是否初始化
  private logger: any; //日志记录器
  private modelAlias: string; //当前使用的模型别名
  private systemPrompt: string; //系统提示词
  private performanceMonitor: PerformanceMonitor; //性能监控器
  private tools: any[] = []; //工具列表
  private promptIntegration!: AgentPromptIntegration;
  private promptManager: PromptManager;  // 提示词管理器
  private curationEnabled: boolean = true;  // 策划功能开关，默认启用
  private debugLogger: any;  // 专门的调试日志记录器
  private isFirstUserInput: boolean = true;  // 跟踪是否是第一次用户输入


  /**
   * 安全的日志记录方法
   */
  private safeLog(
    level: "info" | "warn" | "error",
    message: string,
    extra?: any
  ): void {
    try {
      if (this.logger && typeof this.logger[level] === "function") {
        this.logger[level](message, extra);
      } else {
        console[level](`[${level.toUpperCase()}]`, message, extra || "");
      }
    } catch (error) {
      console.error("Logger error:", error);
      console[level](`[${level.toUpperCase()}]`, message, extra || "");
    }
  }

  //初始化
  constructor(modelAlias?: string) {
    this.logger = LoggerManager.getInstance().getLogger("agent-loop");
    this.debugLogger =
      LoggerManager.getInstance().getLogger("agent-loop-debug");
    this.performanceMonitor = PerformanceMonitor.getInstance();

    // 如果没有指定模型别名，从配置文件中获取默认模型
    if (!modelAlias) {
      const defaultModel = getDefaultModel();
      if (!defaultModel) {
        throw new Error("配置文件中未设置默认模型，请使用 -m 参数指定模型别名");
      }
      this.modelAlias = defaultModel;
    } else {
      this.modelAlias = modelAlias;
    }


    // 初始化提示词管理器
    this.promptManager = new PromptManager();

    // 设置系统提示词
    this.systemPrompt = startupPrompt;

    this.promptIntegration = new AgentPromptIntegration({
      projectContext: {
        name: "ByteCraft",
        type: "AI Assistant",
        language: "TypeScript",
      },
    });

    // 异步初始化
    this.initialize().catch((error) => {
      this.logger.error("AgentLoop异步初始化失败", { error });
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
      this.logger.info("获取模型配置成功", {
        modelAlias: this.modelAlias,
        modelName: modelConfig.name,
        baseURL: modelConfig.baseURL,
      });

      //创建流式输出处理器
      const callbackManager = CallbackManager.fromHandlers({
        handleLLMNewToken: (token: string) => {
          // process.stdout.write(token);
        },
        handleLLMEnd: () => {
          // console.log('\n');
        },
        handleLLMError: (err: Error) => {
          if (
            err.message.includes("token") ||
            err.message.includes("Unknown model")
          ) {
            return;
          }
          console.error("\n[错误]", err);
        },
      });

      //创建模型
      this.model = new ChatOpenAI({
        modelName: modelConfig.name,
        openAIApiKey: modelConfig.apiKey,
        configuration: {
          baseURL: modelConfig.baseURL,
        },
        streaming: modelConfig.streaming,
        callbacks: callbackManager,
        maxTokens: -1,
        modelKwargs: {
          tokenizer: "cl100k_base",
          token_usage: false,
        },
      });

      // 创建JSONL checkpoint saver
      this.historyManager = new ConversationHistoryManager();
      this.checkpointSaver = new SimpleCheckpointSaver(this.historyManager);

      // 创建上下文管理器 - 基于配置文件的智能上下文管理
      // 从配置文件读取参数，方便调试和调优
      const contextConfig = getContextManagerConfig();
      const debugConfig = getDebugConfig();

      // 🔧 修复：根据配置文件的strategy映射到正确的truncationStrategy
      const getTruncationStrategy = (strategy?: string): "simple_sliding_window" | "smart_sliding_window" | "importance_based" => {
        switch (strategy) {
          case "sliding_window_only":
            return "simple_sliding_window";
          case "llm_compression_priority":
            return "smart_sliding_window"; // LLM压缩优先时使用智能滑动窗口作为兜底
          case "hybrid_balanced":
          default:
            return "smart_sliding_window";
        }
      };

      this.contextManager = new ContextManager({
        maxMessages: contextConfig.maxMessages,
        maxTokens: contextConfig.maxTokens,
        maxBytes: contextConfig.maxBytes,
        maxLines: contextConfig.maxLines,
        minRecentMessages: contextConfig.minRecentMessages,
        systemMessageHandling: "always_keep", // 始终保留系统消息，维持AI角色定位
        truncationStrategy: getTruncationStrategy(contextConfig.strategy), // 🔧 使用配置文件的策略
        tokenEstimationMode: "enhanced", // 增强型token估算，支持中英文混合文本
        enableSensitiveFiltering: debugConfig.enableSensitiveFiltering,
        enablePerformanceLogging: debugConfig.enablePerformanceLogging,
      });


      // 异步创建工具列表
      this.tools = await getTools();
      this.logger.info('工具列表创建成功', { toolCount: this.tools.length });

      // 绑定工具到模型
      this.modelWithTools = this.model.bindTools(this.tools);


      // 创建工作流
      this.workflow = this.createWorkflow();      // 工具列表创建后，生成系统提示词
      // 从 promptIntegration 获取初始化的系统提示词
      const baseSystemPrompt = await this.promptIntegration.initializeSystemMessage();

      // 使用 baseSystemPrompt 作为系统提示词
      this.systemPrompt = baseSystemPrompt;
      // 强制打印systemPrompt内容，便于调试
      this.logger.info('【DEBUG】当前系统提示词内容如下：\n' + this.systemPrompt);

      this.isInitialized = true;
      this.logger.info('AgentLoop初始化完成', { modelAlias: this.modelAlias });

      // 📝 记录完整的系统提示词到日志
      this.logger.info('系统提示词已生成', {
        modelAlias: this.modelAlias,
        systemPromptLength: this.systemPrompt.length,
        toolCount: this.tools.length
      });

      // 📋 记录系统提示词内容（可选：完整内容）
      this.debugLogger.info('完整系统提示词内容', {
        systemPrompt: this.systemPrompt,
        sessionId: 'initialization'
      });

      // 🔍 验证工具提示词是否包含在系统提示词中
      const toolNames = this.tools.map(tool => tool.name);
      const toolVerification = toolNames.map(toolName => ({
        toolName,
        included: this.systemPrompt.includes(toolName) ||
          this.systemPrompt.includes(toolName.replace(/_/g, '-')) ||
          this.systemPrompt.includes('调用指南')
      }));

      this.debugLogger.info('工具提示词验证结果', {
        toolVerification,
        totalTools: toolNames.length,
        includedTools: toolVerification.filter(t => t.included).length
      });

      this.isInitialized = true;
      this.logger.info("AgentLoop初始化完成", { modelAlias: this.modelAlias });
    } catch (error) {
      this.logger.error('模型初始化失败', {
        modelAlias: this.modelAlias,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error("❌ 模型初始化失败:", error);
      throw error;
    }
  }

  /**
   * 创建自定义工作流
   */
  private createWorkflow() {
    // 分析节点 - 处理用户输入并可能调用工具
    const agentNode = async (state: typeof MessagesAnnotation.State) => {
      // console.log("\n🧠 分析处理...");


      // 确保消息包含系统提示词
      let messages = state.messages;


      // 检查首条消息是否为系统消息，如果不是则添加
      if (messages.length === 0 || messages[0]._getType() !== "system") {
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


      // console.log(`\n🔄 检查工具调用`);

      if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls?.length) {
        // console.log(`✅ 正在处理 ${lastMessage.tool_calls.length} 个工具调用...`);


        // 显示具体调用了什么工具以及处理什么事情
        lastMessage.tool_calls.forEach((toolCall, index) => {
          const toolName = toolCall.name;
          const toolArgs = toolCall.args;
          // console.log(`🛠️  调用工具 ${toolName}`);
          // console.log(`📝  参数: ${JSON.stringify(toolArgs, null, 2)}`);
        });


        return "tools";
      }


      // console.log("✅ 无工具调用，结束处理");
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


      // 重置第一次用户输入标志
      this.isFirstUserInput = true;


      // 注意：不再保存系统提示词到JSONL，系统prompt将动态生成


      return this.currentSessionId;
    } catch (error) {
      console.error("❌ 创建会话失败:", error);
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

      // 智能恢复会话上下文到LangGraph
      await this.restoreSessionContextToLangGraph(sessionId);

      // 加载现有会话时，重置第一次用户输入标志
      // 因为加载的会话已经有历史消息，不需要更新标题
      this.isFirstUserInput = false;
    } catch (error) {
      console.error("❌ 加载会话失败:", error);
      throw error;
    }
  }

  /**
   * 恢复会话上下文到LangGraph - 智能检查是否需要压缩
   */
  private async restoreSessionContextToLangGraph(
    sessionId: string
  ): Promise<void> {
    try {
      // 获取模型token限制
      const modelConfig = getModelConfig(this.modelAlias);
      const contextManagerConfig = getContextManagerConfig();

      // 根据配置决定使用哪个token限制
      const tokenLimit = contextManagerConfig.useConfigTokenLimit
        ? contextManagerConfig.maxTokens
        : (this.getTokenLimitForModel(modelConfig.name) || 16000);

      // Token估算函数
      const estimateTokens = (messages: ConversationMessage[]) => {
        const langchainMessages =
          this.contextManager.convertToLangChainMessages(messages);
        return this.contextManager.estimateTokenCount(langchainMessages);
      };

      // 先检查是否需要压缩，只有在需要时才提供压缩函数
      let compress:
        | ((messages: ConversationMessage[]) => Promise<ConversationMessage>)
        | undefined;

      // 获取历史消息进行初步检查
      const allMessages = await this.historyManager.loadSession(sessionId);
      if (allMessages.length > 0) {
        const estimatedTokens = estimateTokens(allMessages);

        // 只有当token超限时才准备压缩函数
        if (estimatedTokens > tokenLimit * 0.9) {
          this.logger.info(
            `⚠️ 检测到上下文可能超限 (${estimatedTokens}/${tokenLimit})，准备压缩功能`
          );

          compress = async (messages: ConversationMessage[]) => {
            // 创建LLM总结器
            const llmSummarizer = {
              sendMessage: async (params: { message: { text: string } }) => {
                const response = await this.model.invoke([
                  new SystemMessage(
                    "你是专业的对话摘要助手。请将对话内容压缩成简洁完整的摘要，保留所有关键信息。"
                  ),
                  new HumanMessage(params.message.text),
                ]);
                return {
                  text:
                    typeof response.content === "string"
                      ? response.content
                      : JSON.stringify(response.content),
                };
              },
            };

            // 执行压缩
            const compressionResult =
              await this.contextManager.tryCompressConversation(
                messages,
                llmSummarizer,
                true, // 强制压缩
                tokenLimit * 0.8
              );

            if (compressionResult && compressionResult.compressed) {
              return compressionResult.summaryMessage!;
            } else {
              throw new Error("压缩失败");
            }
          };
        } else {
          this.logger.info(
            `✅ 上下文大小合适 (${estimatedTokens}/${tokenLimit})，无需压缩`
          );
        }
      }

      // 调用SimpleCheckpointSaver的智能恢复方法
      const contextMessages = await this.checkpointSaver.restoreSessionContext(
        sessionId,
        Math.floor(tokenLimit * 0.9), // 留出安全余量
        estimateTokens,
        compress // 只有在需要时才传入压缩函数
      );

      // 将恢复的消息转换为LangChain格式并设置到工作流
      if (contextMessages.length > 0) {
        const langchainMessages =
          this.contextManager.convertToLangChainMessages(contextMessages);

        if (langchainMessages.length > 0) {
          const config = { configurable: { thread_id: sessionId } };
          try {
            await this.workflow.updateState(config, {
              messages: langchainMessages,
            });
          } catch (updateError: any) {
            this.logger.warn(`LangGraph状态更新失败，使用降级策略: ${updateError.name}`);
            // 降级策略：清空状态后重新设置
            await this.workflow.updateState(config, { messages: [] });
            await this.workflow.updateState(config, { messages: langchainMessages });
          }

          this.logger.info(
            `✅ 会话上下文已恢复到LangGraph: ${langchainMessages.length} 条消息`
          );
        }
      }
    } catch (error) {
      this.logger.error("❌ 恢复会话上下文失败:", error);
      // 不抛出错误，让会话加载继续，只是没有历史上下文
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
      let matchedSession = sessions.find((s) => s.sessionId.startsWith(input));

      if (matchedSession) {
        await this.loadSession(matchedSession.sessionId);
        return true;
      }

      // 2. 标题模糊匹配
      matchedSession = sessions.find((s) =>
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
  async processMessage(
    message: string,
    callback?: StreamingCallback
  ): Promise<string> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        throw new Error("AgentLoop未初始化");
      }

      if (!this.currentSessionId) {
        await this.createNewSession();
      }

      // 首先对用户输入进行敏感信息过滤
      const filteredMessage = this.contextManager.filterSensitiveText(message);

      // 如果是第一次用户输入，使用用户输入作为会话标题
      if (this.isFirstUserInput && this.currentSessionId) {
        try {
          // 截取用户输入的前50个字符作为标题，避免标题过长
          // 注意：这里使用原始message作为标题，不使用过滤后的内容
          const title =
            message.length > 50 ? message.substring(0, 50) + "..." : message;
          await this.historyManager.updateSessionTitle(
            this.currentSessionId,
            title
          );
          this.logger.info("已更新会话标题", {
            sessionId: this.currentSessionId,
            title,
          });
        } catch (error) {
          this.logger.warn("更新会话标题失败", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        this.isFirstUserInput = false;
      }

      // 保存用户消息（使用过滤后的内容，避免敏感信息持久化）
      const saveStart = Date.now();
      await this.checkpointSaver.saveMessage(
        this.currentSessionId!,
        "user",
        filteredMessage
      );
      this.performanceMonitor.record("saveUserMessage", Date.now() - saveStart);

      // 调用工作流处理
      const workflowStart = Date.now();
      // console.log("正在处理用户需求")

      // 获取会话历史消息（使用内存缓存，性能已优化）
      const historyMessages = await this.getCurrentSessionHistory();

      // 🧠 使用增强的智能上下文管理器优化消息历史
      // 集成双重历史策划功能和智能压缩，借鉴 Gemini CLI 的先进算法：
      // 1. 策划过滤：自动识别并移除失败的AI响应和对应的用户输入
      // 2. 智能压缩：基于 Gemini CLI 的自动压缩机制，使用 LLM 生成高质量摘要
      // 3. 智能截断：保持原有的重要性评分和截断策略
      // 4. 敏感信息过滤：自动识别并屏蔽密码、密钥等敏感数据
      // 5. Token控制：精确估算并控制上下文长度，避免超出模型限制
      // 6. 性能监控：实时跟踪优化效果，提供详细的统计信息

      // 获取配置信息（一次性获取，避免重复调用）
      const debugConfig = getDebugConfig();
      const modelConfig = getModelConfig(this.modelAlias);
      const contextManagerConfig = getContextManagerConfig();

      // 检查是否启用策划功能（从配置文件读取，也可通过 setCurationEnabled 方法控制）
      const curationEnabled = this.curationEnabled && debugConfig.enableCuration;

      // 创建 LLM 总结器 - 基于 Gemini CLI 的接口设计
      const llmSummarizer = {
        sendMessage: async (params: { message: { text: string } }) => {
          try {
            // 使用当前模型生成摘要，采用较小的参数以确保快速响应
            const response = await this.model.invoke([
              new SystemMessage(
                "你是一个专业的对话摘要助手。请生成简洁但全面的对话摘要，保留所有关键信息、技术细节和上下文。"
              ),
              new HumanMessage(params.message.text),
            ]);

            return {
              text:
                typeof response.content === "string"
                  ? response.content
                  : JSON.stringify(response.content),
            };
          } catch (error) {
            this.logger.warn("LLM 摘要生成失败:", error);
            throw error;
          }
        },
      };

      // 根据配置决定使用哪个token限制
      const tokenLimit = contextManagerConfig.useConfigTokenLimit
        ? contextManagerConfig.maxTokens
        : this.getTokenLimitForModel(modelConfig.name);

      // 检查当前的上下文管理器配置是否支持 LLM 压缩
      const contextConfig = this.contextManager.exportConfig();
      const shouldUseLLMCompression =
        tokenLimit &&
        debugConfig.enableCompression &&
        contextConfig.truncationStrategy !== "simple_sliding_window";

      const optimizationResult =
        await this.contextManager.optimizeContextEnhanced(
          historyMessages,
          this.systemPrompt,
          filteredMessage, // 使用过滤后的消息进行上下文优化
          curationEnabled, // 使用动态配置的策划功能开关
          shouldUseLLMCompression ? llmSummarizer : undefined, // 根据策略决定是否传入 LLM 总结器
          tokenLimit // 传入 token 限制用于自动压缩判断
        );

      const optimizedMessages = optimizationResult.messages;

      // 📊 详细记录上下文优化和提示词使用情况
      this.debugLogger.info('上下文优化详细信息', {
        sessionId: this.currentSessionId,
        originalMessageCount: optimizationResult.optimization.original,
        finalMessageCount: optimizationResult.optimization.final,
        systemPromptLength: this.systemPrompt.length,
        systemPromptPreview: this.systemPrompt.substring(0, 200) + '...',
        optimization: optimizationResult.optimization,
        timestamp: new Date().toISOString()
      });

      // 🔍 记录最终发送给模型的消息结构
      const messagesForLogging = optimizedMessages.map((msg, index) => ({
        index,
        type: msg._getType ? msg._getType() : 'unknown',
        contentLength: typeof msg.content === 'string' ? msg.content.length : 0,
        contentPreview: typeof msg.content === 'string' ?
          msg.content.substring(0, 100) + '...' :
          JSON.stringify(msg.content).substring(0, 100) + '...'
      }));

      this.debugLogger.info('发送给模型的消息结构', {
        sessionId: this.currentSessionId,
        totalMessages: messagesForLogging.length,
        messages: messagesForLogging
      });

      // 显示增强的上下文优化结果，让用户了解处理状态和优化效果
      this.debugLogger.info(`🔧 增强上下文优化结果`);
      this.debugLogger.info(
        `📊 原始消息: ${optimizationResult.optimization.original}`
      );

      if (optimizationResult.optimization.curationEnabled) {
        this.debugLogger.info(
          `✂️ 策划后: ${optimizationResult.optimization.curated} (过滤 ${optimizationResult.optimization.original -
          optimizationResult.optimization.curated
          } 条)`
        );
      }

      if (
        optimizationResult.optimization.compressionEnabled &&
        optimizationResult.stats.compressionStats
      ) {
        const compressionStats = optimizationResult.stats.compressionStats;
        if (compressionStats.compressed) {
          const compressionRatio = (
            ((compressionStats.originalTokenCount -
              compressionStats.newTokenCount) /
              compressionStats.originalTokenCount) *
            100
          ).toFixed(1);
          this.debugLogger.info(
            `🗜️ LLM压缩后: 1条摘要 (减少 ${compressionRatio}% tokens)`
          );
          this.debugLogger.info(
            `🎯 Token优化: ${compressionStats.originalTokenCount} → ${compressionStats.newTokenCount}`
          );

          // 🔥 关键步骤：压缩发生后，同步更新LangGraph状态和JSONL
          await this.updateSessionStateAfterCompression(optimizedMessages);
        } else {
          this.debugLogger.info(
            `ℹ️ 无需压缩 (Token使用量未超限或使用滑动窗口策略)`
          );
        }
      } else {
        this.debugLogger.info(`📌 使用滑动窗口截断策略 (快速但可能丢失上下文)`);
      }

      this.debugLogger.info(
        `📝 最终消息: ${optimizationResult.optimization.final}`
      );

      // 如果有策划统计信息，显示详细的过滤效果
      if (optimizationResult.stats.curationStats) {
        const cStats = optimizationResult.stats.curationStats;
        if (cStats.filteredRounds > 0) {
          this.debugLogger.info(
            `🚮 过滤了 ${cStats.filteredRounds} 个无效对话轮次，耗时 ${cStats.processingTime}ms`
          );
          this.debugLogger.info(
            `📈 策划效果：减少 ${(
              ((cStats.originalCount - cStats.curatedCount) /
                cStats.originalCount) *
              100
            ).toFixed(1)}% 的无效内容`
          );
        } else {
          this.debugLogger.info(`✅ 所有对话轮次均有效，无需过滤`);
        }
      }

      // 显示原有的统计信息（如果发生了截断）
      const contextStats = optimizationResult.stats.originalStats;
      if (contextStats.willTruncate) {
        this.debugLogger.info(`检测到上下文超限，已应用智能截断策略`);
        this.debugLogger.info(
          `优化前统计：${contextStats.estimatedTokens} tokens, ${contextStats.totalBytes} bytes`
        );
        this.debugLogger.info(
          `截断原因：${contextStats.truncationReasons.join(", ")}`
        );
      }

      // 构建消息数组（上下文管理器已处理所有消息）
      const messages = optimizedMessages;

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
            if (
              err.message.includes("token") ||
              err.message.includes("Unknown model")
            ) {
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
            // 使用 debugLogger 记录调试信息
            this.debugLogger.info("handleToolStart 调试信息", {
              tool: tool,
              toolName: tool?.name,
              toolId: tool?.id,
              toolType: tool?.type,
              input: input?.substring(0, 200),
              sessionId: this.currentSessionId,
            });

            // 修复工具名称提取逻辑
            let toolName = "unknown";
            if (tool && typeof tool === "object") {
              // 优先使用 tool.name，这是最可靠的工具名称
              if (tool.name && typeof tool.name === "string") {
                toolName = tool.name;
              } else if (tool.id && typeof tool.id === "string") {
                // 如果 id 是字符串，直接使用
                toolName = tool.id;
              } else if (Array.isArray(tool.id) && tool.id.length > 0) {
                // 如果 id 是数组，取最后一个元素作为工具名
                const lastPart = tool.id[tool.id.length - 1] || "unknown";
                // 转换 FileManagerToolV2 -> file_manager_v2
                if (lastPart === "FileManagerToolV2") {
                  toolName = "file_manager_v2";
                } else {
                  toolName = lastPart
                    .replace(/Tool$/, "")
                    .replace(/([A-Z])/g, "_$1")
                    .toLowerCase()
                    .replace(/^_/, "");
                }
              } else if (tool.type && typeof tool.type === "string") {
                toolName = tool.type;
              }
            }

            this.debugLogger.info("提取的工具名称", {
              toolName,
              sessionId: this.currentSessionId,
            });

            // 解析输入参数
            let toolArgs = {};
            try {
              if (input && typeof input === "string") {
                // input 是双重JSON编码的，需要解析两次
                let parsed = JSON.parse(input);
                if (typeof parsed === "string") {
                  parsed = JSON.parse(parsed);
                }
                toolArgs = parsed;
              }
            } catch (error) {
              toolArgs = { input: input };
            }

            // 记录工具调用开始到会话日志
            if (this.currentSessionId) {
              const sessionLogger = LoggerManager.getInstance().getLogger(
                this.currentSessionId
              );
              sessionLogger.info("工具调用开始", {
                toolName,
                toolArgs,
                sessionId: this.currentSessionId,
                timestamp: new Date().toISOString(),
              });
            }

            callback?.onToolCall?.(toolName, toolArgs);

            // 动态拼接工具说明到systemPrompt
            try {
              const meta = TOOL_METAS.find(t => t.name === toolName || t.promptKey === toolName);
              if (meta) {
                const desc = ToolPrompts.getToolPrompt(meta.promptKey || meta.name) || meta.description || '';
                if (!this.systemPrompt.includes(desc)) {
                  this.systemPrompt += `\n\n### ${toolName}\n${desc}\n`;
                  this.logger.info('[AgentLoop] 动态拼接工具说明', { toolName, desc });
                }
              }
            } catch (e) {
              this.logger.error('[AgentLoop] 动态拼接工具说明失败', { toolName, error: e });
            }
          },
          handleToolEnd: (output: any) => {
            // 使用 debugLogger 记录调试信息
            this.debugLogger.info("handleToolEnd 调试信息", {
              output: output,
              outputName: output?.name,
              outputType: typeof output,
              outputKeys: output ? Object.keys(output) : [],
              sessionId: this.currentSessionId,
            });

            let toolName = "unknown";
            let result = output;

            if (output && typeof output === "object") {
              // 从 ToolMessage 中提取工具名称
              // 优先使用 output.name，这通常是正确的工具名称
              if (output.name && typeof output.name === "string") {
                toolName = output.name;
              } else if (output.tool && typeof output.tool === "string") {
                // 有些情况下工具名称在 tool 字段中
                toolName = output.tool;
              } else if (
                output.tool_name &&
                typeof output.tool_name === "string"
              ) {
                // 或者 tool_name 字段
                toolName = output.tool_name;
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

            this.debugLogger.info("handleToolEnd 最终工具名称", {
              toolName,
              sessionId: this.currentSessionId,
            });

            // 记录工具调用结果到会话日志
            if (this.currentSessionId) {
              const sessionLogger = LoggerManager.getInstance().getLogger(
                this.currentSessionId
              );
              sessionLogger.info("工具调用完成", {
                toolName,
                result,
                sessionId: this.currentSessionId,
                timestamp: new Date().toISOString(),
              });
            }

            callback?.onToolResult?.(toolName, result);
          },
        });

        // 使用工作流，但应用自定义回调管理器
        result = await this.workflow.invoke(
          {
            messages: messages,
          },
          {
            configurable: { thread_id: this.currentSessionId },
            callbacks: customCallbackManager,
            recursionLimit: 25,
          }
        );
      } else {
        // 使用原有工作流
        result = await this.workflow.invoke(
          {
            messages: messages,
          },
          {
            configurable: { thread_id: this.currentSessionId },
          }
        );
      }

      // console.log("用户需求处理结束")
      this.performanceMonitor.record(
        "workflowInvoke",
        Date.now() - workflowStart
      );

      // 保存完整对话历史 - 只保存新消息，避免重复
      const saveAIStart = Date.now();
      if (result.messages && result.messages.length > 0) {
        await this.checkpointSaver.saveCompleteConversation(
          this.currentSessionId!,
          result.messages
        );
      }
      this.performanceMonitor.record("saveAIMessage", Date.now() - saveAIStart);

      // 保存最后会话ID
      this.saveLastSessionId();

      const lastMessage =
        result.messages && result.messages.length > 0
          ? result.messages[result.messages.length - 1]
          : null;
      const finalResponse = lastMessage
        ? typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content)
        : "无回复内容";

      // 计算并输出响应时间
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      // console.log(`\n⏱️  响应时间: ${responseTime}ms`);

      // 调用完成回调
      callback?.onComplete?.(finalResponse);

      return finalResponse;
    } catch (error) {
      // 即使出错也记录响应时间
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      // console.log(`\n⏱️  响应时间: ${responseTime}ms (出错)`);

      console.error("❌ 处理消息失败:", error);

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
        this.historyManager.setCurrentSessionId("");
      }

      return true;
    } catch (error) {
      console.error("❌ 删除会话失败:", error);
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
  /**
   * 获取当前会话历史 - 智能优化版本
   * 
   * 使用基于metadata的快速加载，避免扫描完整JSONL文件
   */
  async getCurrentSessionHistory(): Promise<ConversationMessage[]> {
    if (!this.currentSessionId) {
      return [];
    }

    // 获取配置判断是否启用LLM压缩
    const debugConfig = getDebugConfig();
    const enableCompression = debugConfig.enableCompression;

    // 如果启用了压缩功能，检查是否有摘要并使用快速加载
    if (enableCompression) {
      const hasSummary = await this.historyManager.hasSessionSummaryFast(this.currentSessionId);

      if (hasSummary) {
        // 有摘要，使用基于UUID的快速增量加载
        this.logger.info(`🚀 使用快速增量加载 (会话: ${this.currentSessionId.substring(0, 8)})`);
        return await this.historyManager.loadSessionFromSummaryPoint(this.currentSessionId);
      }
    }

    // 没摘要或未启用压缩，使用普通加载
    this.logger.info(`📄 使用普通加载 (会话: ${this.currentSessionId.substring(0, 8)})`);
    return await this.historyManager.getMessages(this.currentSessionId);
  }

  /**
   * 保存当前会话
   */
  async saveCurrentSession(title: string): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error("没有当前会话可保存");
    }

    // 这里可以添加保存会话标题的逻辑
    // 目前SimpleCheckpointSaver没有直接支持更新标题的方法
    // console.log(`💾 会话已保存: ${title} (${this.currentSessionId.slice(0, 8)}...)`);
  }

  /**
   * 检查会话是否存在
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    try {
      const sessions = await this.listSessions();
      return sessions.some((s) => s.sessionId === sessionId);
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
      return sessions.find((s) => s.sessionId === sessionId) || null;
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
  getCacheStats(): {
    messageCacheSize: number;
    metadataCacheSize: number;
    totalSessions: number;
  } {
    return this.historyManager.getCacheStats();
  }

  /**
   * 设置策划功能开关
   *
   * @param enabled 是否启用策划功能
   */
  setCurationEnabled(enabled: boolean): void {
    this.curationEnabled = enabled;
    this.logger.info("策划功能状态已更新", { enabled });
  }

  /**
   * 获取策划功能状态
   *
   * @returns 当前策划功能是否启用
   */
  getCurationEnabled(): boolean {
    return this.curationEnabled;
  }

  /**
   * 获取压缩功能状态
   *
   * @returns 当前是否支持智能压缩功能
   */
  getCompressionEnabled(): boolean {
    const modelConfig = getModelConfig(this.modelAlias);
    const tokenLimit = this.getTokenLimitForModel(modelConfig.name);
    return !!tokenLimit;
  }

  /**
   * 设置上下文优化策略
   *
   * @param strategy 优化策略
   * - 'sliding_window_only': 仅使用滑动窗口（快速、可靠）
   * - 'llm_compression_only': 仅使用 LLM 压缩（高质量、需要网络）
   * - 'hybrid_with_fallback': 优先 LLM 压缩，失败时降级（推荐）
   * - 'adaptive': 自适应选择最佳策略
   */
  setOptimizationStrategy(
    strategy:
      | "sliding_window_only"
      | "llm_compression_only"
      | "hybrid_with_fallback"
      | "adaptive"
  ): void {
    // 更新上下文管理器配置
    this.contextManager.updateConfig({
      // 根据策略设置相应的截断策略
      truncationStrategy:
        strategy === "sliding_window_only"
          ? "smart_sliding_window"
          : "importance_based",
    });

    this.logger.info(`🔄 上下文优化策略已更改为: ${strategy}`);
  }

  /**
   * 获取当前优化策略推荐
   *
   * @returns 基于当前环境和会话状态的策略建议
   */
  async getOptimizationStrategyRecommendation(): Promise<{
    recommended: string;
    reason: string;
    alternatives: Array<{
      strategy: string;
      description: string;
      pros: string[];
      cons: string[];
    }>;
  }> {
    const compressionEnabled = this.getCompressionEnabled();
    const stats = await this.getOptimizationStats();

    // 基于当前状态生成建议
    let recommended = "hybrid_with_fallback";
    let reason = "平衡性能和质量的最佳选择";

    if (!compressionEnabled) {
      recommended = "sliding_window_only";
      reason = "当前模型未配置 Token 限制，无法使用 LLM 压缩";
    } else if (
      stats.curation.totalFiltered === 0 &&
      stats.overall.efficiency > 0.9
    ) {
      recommended = "sliding_window_only";
      reason = "当前会话质量很高，简单截断即可满足需求";
    }

    const alternatives = [
      {
        strategy: "sliding_window_only",
        description: "仅使用滑动窗口截断",
        pros: ["速度最快", "100% 可靠", "无网络依赖", "无额外成本"],
        cons: ["可能丢失重要上下文", "硬性截断可能影响连贯性"],
      },
      {
        strategy: "llm_compression_only",
        description: "仅使用 LLM 智能压缩",
        pros: ["最高质量的上下文保留", "语义连贯性最佳"],
        cons: ["需要额外 LLM 调用", "可能失败导致处理中断", "耗时较长"],
      },
      {
        strategy: "hybrid_with_fallback",
        description: "混合模式（推荐）",
        pros: ["平衡性能和质量", "具备容错能力", "适合大多数场景"],
        cons: ["逻辑稍复杂", "偷尔需要降级处理"],
      },
      {
        strategy: "adaptive",
        description: "自适应智能选择",
        pros: ["自动优化决策", "适应不同会话特征", "最大化效率"],
        cons: ["策略可能不可预测", "需要额外的判断开销"],
      },
    ];

    return { recommended, reason, alternatives };
  }

  /**
   * 一键切换到最佳策略
   *
   * 基于当前环境和会话状态自动选择最佳的优化策略
   */
  async optimizeStrategy(): Promise<string> {
    const recommendation = await this.getOptimizationStrategyRecommendation();
    this.setOptimizationStrategy(recommendation.recommended as any);

    this.logger.info(`🎯 已自动优化为: ${recommendation.recommended}`);
    this.logger.info(`📝 原因: ${recommendation.reason}`);

    return recommendation.recommended;
  }

  /**
   * 获取当前的压缩策略类型
   */
  private getCompressionStrategy(): string {
    const contextConfig = this.contextManager.exportConfig();
    const compressionEnabled = this.getCompressionEnabled();

    if (!compressionEnabled) {
      return "sliding_window_only";
    }

    // 根据截断策略判断当前使用的策略
    switch (contextConfig.truncationStrategy) {
      case "simple_sliding_window":
        return "sliding_window_only";
      case "smart_sliding_window":
      case "importance_based":
        return "hybrid_with_fallback"; // 默认使用混合策略
      default:
        return "adaptive";
    }
  }

  /**
   * 获取详细的上下文统计信息
   *
   * 基于Codex项目经验，提供全方位的上下文状态监控：
   * - 消息数量统计：总消息数及类型分布
   * - Token使用情况：智能估算当前上下文的token消耗
   * - 截断预测：判断是否需要截断及截断原因
   * - 性能指标：优化效率和处理时间
   *
   * @returns 包含详细统计信息的对象
   */
  async getContextStats(): Promise<{
    totalMessages: number;
    estimatedTokens: number;
    totalBytes: number;
    totalLines: number;
    willTruncate: boolean;
    truncationReasons: string[];
    performanceStats: {
      efficiency: number;
      avgOptimizationTime: number;
      truncationRate: number;
    };
  }> {
    if (!this.currentSessionId) {
      return {
        totalMessages: 0,
        estimatedTokens: 0,
        totalBytes: 0,
        totalLines: 0,
        willTruncate: false,
        truncationReasons: [],
        performanceStats: {
          efficiency: 1.0,
          avgOptimizationTime: 0,
          truncationRate: 0,
        },
      };
    }

    const historyMessages = await this.getCurrentSessionHistory();
    const basicStats = this.contextManager.getContextStats(historyMessages);
    const performanceReport = this.contextManager.getPerformanceReport();

    return {
      ...basicStats,
      performanceStats: {
        efficiency: performanceReport.efficiency,
        avgOptimizationTime: performanceReport.avgOptimizationTime,
        truncationRate: performanceReport.truncationRate,
      },
    };
  }

  /**
   * 清除缓存
   *
   * 清理内存缓存以释放资源，支持：
   * - 指定会话缓存清理
   * - 全局缓存清理
   * - 上下文管理器缓存清理
   */
  clearCache(sessionId?: string): void {
    // 清理对话历史缓存
    this.historyManager.clearCache(sessionId);

    // 如果没有指定会话ID，清理上下文管理器的性能数据
    if (!sessionId) {
      this.debugLogger.info("正在清理上下文管理器缓存...");
      // 注意：这里不直接清理ContextManager的内部缓存，因为它是无状态的
      // 但可以重置性能统计数据
    }
  }

  /**
   * 获取上下文管理器配置
   *
   * @returns 当前上下文管理器的配置信息
   */
  getContextManagerConfig() {
    return this.contextManager.exportConfig();
  }

  /**
   * 更新上下文管理器配置
   *
   * 支持动态调整上下文管理策略，适应不同场景需求：
   * - 开发环境：宽松限制，详细日志
   * - 生产环境：严格限制，高性能
   * - 演示环境：平衡配置
   *
   * @param config 新的配置参数（部分更新）
   */
  updateContextManagerConfig(config: any): void {
    this.contextManager.updateConfig(config);
    this.debugLogger.info("上下文管理器配置已更新");
  }

  /**
   * 获取上下文管理器性能报告
   *
   * 提供详细的性能分析，包括：
   * - 优化效率统计
   * - 平均处理时间
   * - 截断频率分析
   * - 优化建议
   */
  getContextPerformanceReport() {
    return this.contextManager.getPerformanceReport();
  }

  /**
   * 获取策划和压缩功能的统计信息
   *
   * 返回当前会话的优化统计数据，包括：
   * - 策划：过滤掉的无效轮次数量、处理时间、内容减少比例
   * - 压缩：LLM 摘要生成情况、Token 减少比例、压缩触发频率
   * - 整体优化效果评估和使用建议
   *
   * @returns 完整的优化统计信息对象
   */
  async getOptimizationStats(): Promise<{
    curation: {
      totalOptimizations: number;
      totalFiltered: number;
      avgProcessingTime: number;
      effectivenessRate: number;
    };
    compression: {
      enabled: boolean;
      totalCompressions: number;
      avgCompressionRatio: number;
      avgTokenSaved: number;
      strategy: string;
    };
    overall: {
      recommendations: string[];
      efficiency: number;
    };
  }> {
    // 从上下文管理器获取累计的统计信息
    const performanceReport = this.contextManager.getPerformanceReport();

    // 如果有当前会话，获取详细统计
    let sessionSpecificStats = null;
    if (this.currentSessionId) {
      try {
        const historyMessages = await this.getCurrentSessionHistory();
        // 执行一次策划来获取统计信息（但不应用结果）
        const result =
          this.contextManager.generateCuratedHistory(historyMessages);
        sessionSpecificStats = result.stats;
      } catch (error) {
        console.warn("获取会话策划统计失败:", error);
      }
    }

    // 生成使用建议
    const recommendations: string[] = [];
    if (performanceReport.truncationRate > 0.3) {
      recommendations.push("检测到频繁的内容截断，建议启用策划功能以提高效率");
    }
    if (performanceReport.avgOptimizationTime > 50) {
      recommendations.push(
        "上下文优化耗时较长，智能压缩功能可以显著减少处理负担"
      );
    }
    if (sessionSpecificStats && sessionSpecificStats.filteredRounds === 0) {
      recommendations.push("当前会话质量良好，策划功能未发现需要过滤的内容");
    }

    // 检查是否支持压缩功能
    const modelConfig = getModelConfig(this.modelAlias);
    const tokenLimit = this.getTokenLimitForModel(modelConfig.name);
    const compressionEnabled = !!tokenLimit;

    if (compressionEnabled) {
      recommendations.push(
        "已启用基于 Gemini CLI 的智能压缩功能，支持自动 LLM 摘要生成"
      );
      recommendations.push(
        "可使用 setOptimizationStrategy() 切换不同的优化策略"
      );
    } else {
      recommendations.push("当前模型未配置 Token 限制，仅支持滑动窗口截断策略");
    }

    const contextConfig = this.contextManager.exportConfig();
    if (contextConfig.truncationStrategy === "simple_sliding_window") {
      recommendations.push(
        "当前使用简单滑动窗口策略，可考虑升级到智能截断或 LLM 压缩"
      );
    }

    return {
      curation: {
        totalOptimizations:
          performanceReport.efficiency > 0
            ? Math.round(1 / (1 - performanceReport.efficiency))
            : 0,
        totalFiltered: sessionSpecificStats?.filteredRounds || 0,
        avgProcessingTime: sessionSpecificStats?.processingTime || 0,
        effectivenessRate: performanceReport.efficiency,
      },
      compression: {
        enabled: compressionEnabled,
        strategy: this.getCompressionStrategy(),
        totalCompressions: 0, // TODO: 添加压缩次数统计
        avgCompressionRatio: 0, // TODO: 添加平均压缩比统计
        avgTokenSaved: 0, // TODO: 添加平均节省Token统计
      },
      overall: {
        recommendations,
        efficiency: performanceReport.efficiency,
      },
    };
  }

  /**
   * 获取当前模型的 Token 限制
   *
   * @param modelName 模型名称
   * @returns Token 限制数量，如果未知则返回 undefined
   */
  private getTokenLimitForModel(modelName: string): number | undefined {
    // 基于常见模型的 Token 限制
    const tokenLimits: Record<string, number> = {
      "gpt-4o": 128000,
      "gpt-4o-mini": 128000,
      "gpt-4-turbo": 128000,
      "gpt-4": 8192,
      "gpt-3.5-turbo": 16385,
      "claude-3-opus": 200000,
      "claude-3-sonnet": 200000,
      "claude-3-haiku": 200000,
      "gemini-1.5-pro": 2097152,
      "gemini-1.5-flash": 1048576,
      "gemini-2.0-flash": 1048576,
      "deepseek-v3": 128000,
      "deepseek-r1": 128000,
    };

    // 尝试精确匹配
    if (tokenLimits[modelName]) {
      return tokenLimits[modelName];
    }

    // 尝试模糊匹配
    for (const [pattern, limit] of Object.entries(tokenLimits)) {
      if (modelName.toLowerCase().includes(pattern.toLowerCase())) {
        return limit;
      }
    }

    // 如果无法确定，返回一个保守的默认值
    this.safeLog(
      "warn",
      `未知模型 ${modelName} 的 Token 限制，使用默认值 16000`
    );
    return 16000;
  }

  /**
   * 压缩后更新会话状态 - 同步LangGraph内存和JSONL存储
   *
   * 当LLM压缩发生后，我们需要：
   * 1. 保存压缩摘要到JSONL（追加到历史末尾）
   * 2. 清空当前LangGraph的内存状态
   * 3. 用压缩后的摘要重新初始化LangGraph状态
   *
   * 这样下次加载会话时，就能直接从摘要开始，避免重复压缩
   */
  private async updateSessionStateAfterCompression(
    compressedMessages: BaseMessage[]
  ): Promise<void> {
    try {
      if (!this.currentSessionId || compressedMessages.length === 0) {
        this.logger.warn("⚠️ 无当前会话ID或压缩消息为空，跳过状态更新");
        return;
      }

      this.logger.info("🔄 开始更新压缩后的会话状态...");

      // 1. 保存压缩摘要到JSONL
      // 从压缩后的消息中提取摘要并保存到JSONL
      for (const message of compressedMessages) {
        if (message.getType() === "ai") {
          const content =
            typeof message.content === "string"
              ? message.content
              : JSON.stringify(message.content);

          // 确保内容包含摘要标识
          const summaryContent = content.includes("[对话摘要]")
            ? content
            : `[对话摘要] ${content}`;

          // 保存到JSONL
          await this.checkpointSaver.saveMessage(
            this.currentSessionId,
            "assistant",
            summaryContent
          );
          this.logger.info("💾 压缩摘要已保存到JSONL");
          break; // 只保存第一个AI消息作为摘要
        }
      }

      // 2. 温和更新LangGraph状态，确保包含系统消息和摘要
      const config = { configurable: { thread_id: this.currentSessionId } };

      // 构建包含系统消息的完整消息列表
      const systemMessage = new SystemMessage(this.systemPrompt);
      const updatedMessages = [systemMessage, ...compressedMessages];

      // 直接用压缩后的消息更新状态，不需要先清空再设置
      await this.workflow.updateState(config, { messages: updatedMessages });
      this.logger.info(
        `✅ LangGraph状态已更新：1条系统消息 + ${compressedMessages.length} 条压缩消息`
      );

      this.logger.info("🎯 会话状态同步完成，内存和持久化存储已对齐");
    } catch (error) {
      this.logger.error("❌ 更新压缩后会话状态失败:", error);
      // 不抛出错误，让对话继续进行
    }
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
      const bytecraftDir = path.join(process.cwd(), ".bytecraft");
      const lastSessionFile = path.join(bytecraftDir, "lastsession");

      // 确保目录存在
      if (!fs.existsSync(bytecraftDir)) {
        fs.mkdirSync(bytecraftDir, { recursive: true });
      }

      // 写入最后会话ID
      fs.writeFileSync(lastSessionFile, this.currentSessionId, "utf8");
    } catch (error) {
      this.logger.error("保存最后会话ID失败", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 从文件加载最后会话ID
   */
  loadLastSessionId(): string | null {
    try {
      const lastSessionFile = path.join(
        process.cwd(),
        ".bytecraft",
        "lastsession"
      );

      if (fs.existsSync(lastSessionFile)) {
        const sessionId = fs.readFileSync(lastSessionFile, "utf8").trim();
        return sessionId || null;
      }
    } catch (error) {
      this.logger.error("加载最后会话ID失败", {
        error: error instanceof Error ? error.message : String(error),
      });
    }


    return null;
  }
}