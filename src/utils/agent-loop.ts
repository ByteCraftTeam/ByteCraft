import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { StateGraph, Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { getModelConfig, getDefaultModel } from "@/config/config.js";
import type { ModelConfig } from "@/types/index.js";
import { getTools } from "@/utils/tools/index.js";
import { SimpleCheckpointSaver } from "./simple-checkpoint-saver.js";
import { ConversationHistoryManager } from "./conversation-history.js";
import type { ConversationMessage, SessionMetadata } from "@/types/conversation.js";
import { LoggerManager } from "./logger/logger.js";
import { startupPrompt } from "@/prompts/startup.js";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { PerformanceMonitor } from "./performance-monitor.js";
import fs from 'fs';
import path from 'path';

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
    
    // 设置系统提示词
    this.systemPrompt = startupPrompt;

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
      this.workflow = this.createWorkflow();

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
  private createWorkflow() {
    // 智能路由节点 - 判断请求类型
    const routeNode = async (state: typeof MessagesAnnotation.State) => {
      console.log("\n🧠 智能路由分析...");
      
      const lastMessage = state.messages[state.messages.length - 1];
      const userInput = lastMessage.content;
      
      // 获取会话历史
      let conversationHistory = '';
      if (this.currentSessionId) {
        const history = await this.historyManager.getMessages(this.currentSessionId);
        if (history.length > 0) {
          conversationHistory = '\n\n对话历史:\n' + history.slice(-5).map(msg => 
            `${msg.type === 'user' ? '用户' : '助手'}: ${msg.message.content}`
          ).join('\n');
        }
      }
      
      const result = await this.model.invoke([
        new SystemMessage(`你是一个智能路由分析器。请分析用户输入，判断请求类型：

1. 简单问候（simple_greeting）：
   - 你好、早上好、谢谢、再见等
   - 简单的感谢或告别

2. 直接工具调用（direct_tool）：
   - 明确的搜索请求（如"搜索xxx"、"今天股票怎么样"、"查询xxx"）
   - 具体的文件操作（如"读取文件xxx"、"创建文件xxx"、"删除文件xxx"）
   - 明确的命令执行（如"运行npm install"、"执行命令xxx"）

3. 复杂需求（complex_task）：
   - 模糊或不明确的需求
   - 需要多步骤解决的问题
   - 需要分析和规划的复杂任务
   - 涉及多个工具或操作的请求

可用工具：
${this.tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

请返回JSON格式：{"type": "simple_greeting|direct_tool|complex_task", "reason": "判断原因", "tool": "工具名称(如果是direct_tool)"}

注意：
- 如果用户询问当前事件、新闻、股票、天气等信息，通常是direct_tool，使用tavily_search
- 如果用户要求文件操作，通常是direct_tool，使用file_manager
- 如果用户要求执行命令，通常是direct_tool，使用command_exec`),
        new HumanMessage(`用户输入：${userInput}${conversationHistory}`)
      ]);
      
      let decision;
      try {
        const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        decision = JSON.parse(content);
      } catch (error) {
        // 如果解析失败，默认按复杂任务处理
        decision = { type: 'complex_task', reason: "解析失败，按复杂任务处理" };
      }
      
      console.log(`\n📊 路由决策: ${decision.type} - ${decision.reason}`);
      
      // 返回带有路由决策的消息
      const routeMessage = new AIMessage({
        content: decision.reason,
        additional_kwargs: { 
          route_type: decision.type,
          route_reason: decision.reason,
          suggested_tool: decision.tool || null
        }
      });
      
      return { messages: [routeMessage] };
    };

    // 简单问候处理节点
    const greetingNode = async (state: typeof MessagesAnnotation.State) => {
      console.log("\n💬 处理简单问候...");
      
      const lastMessage = state.messages[state.messages.length - 1];
      const userInput = lastMessage.content;
      
      // 获取会话历史
      let conversationHistory = '';
      if (this.currentSessionId) {
        const history = await this.historyManager.getMessages(this.currentSessionId);
        if (history.length > 0) {
          conversationHistory = '\n\n对话历史:\n' + history.slice(-5).map(msg => 
            `${msg.type === 'user' ? '用户' : '助手'}: ${msg.message.content}`
          ).join('\n');
        }
      }
      
      const result = await this.model.invoke([
        new SystemMessage(`你是一个友好的AI助手。请直接回应用户的问候，要求：
1. 保持友好、自然的语气
2. 结合对话历史上下文
3. 简洁明了
4. 用中文回答
5. 如果是问候，可以询问用户需求`),
        new HumanMessage(`用户输入：${userInput}${conversationHistory}`)
      ]);
      
      return { messages: [result] };
    };

    // 直接工具调用节点
    const directToolNode = async (state: typeof MessagesAnnotation.State) => {
      console.log("\n🛠️ 直接工具调用...");
      
      const lastMessage = state.messages[state.messages.length - 1];
      const suggestedTool = lastMessage.additional_kwargs?.suggested_tool;
      
      if (!suggestedTool) {
        // 如果没有建议的工具，使用绑定工具的模型
        const result = await this.modelWithTools.invoke(state.messages);
        return { messages: [result] };
      }
      
      // 找到建议的工具
      const tool = this.tools.find(t => t.name === suggestedTool);
      if (!tool) {
        console.log(`⚠️ 未找到工具: ${suggestedTool}`);
        const result = await this.modelWithTools.invoke(state.messages);
        return { messages: [result] };
      }
      
      console.log(`\n🛠️ 直接调用工具: ${tool.name}`);
      
      // 让AI生成工具参数
      const paramResult = await this.model.invoke([
        new SystemMessage(`用户想要使用工具 ${tool.name}。请根据用户输入生成合适的参数。

工具描述：${tool.description}
工具名称：${tool.name}

请根据工具描述和用户需求，生成正确的参数。只返回参数对象，不要包含其他内容。

示例格式：
- 如果是搜索工具，返回：{"query": "搜索关键词"}
- 如果是文件工具，返回：{"path": "文件路径"}
- 如果是命令工具，返回：{"command": "要执行的命令"}`),
        new HumanMessage(`用户输入：${state.messages[0].content}`)
      ]);
      
      let toolArgs;
      try {
        const content = typeof paramResult.content === 'string' ? paramResult.content : JSON.stringify(paramResult.content);
        
        // 尝试解析JSON
        if (content.trim().startsWith('{')) {
          toolArgs = JSON.parse(content);
        } else {
          // 如果不是JSON格式，尝试提取参数
          console.log("⚠️ 参数不是JSON格式，尝试提取参数");
          
          // 根据工具类型生成默认参数
          if (tool.name === 'tavily_search') {
            toolArgs = { query: state.messages[0].content };
          } else if (tool.name === 'file_manager') {
            toolArgs = { operation: 'read', path: state.messages[0].content };
          } else if (tool.name === 'command_exec') {
            toolArgs = { command: state.messages[0].content };
          } else {
            toolArgs = {};
          }
        }
      } catch (error) {
        console.log("⚠️ 参数解析失败，使用默认参数");
        
        // 根据工具类型生成默认参数
        if (tool.name === 'tavily_search') {
          toolArgs = { query: state.messages[0].content };
        } else if (tool.name === 'file_manager') {
          toolArgs = { operation: 'read', path: state.messages[0].content };
        } else if (tool.name === 'command_exec') {
          toolArgs = { command: state.messages[0].content };
        } else {
          toolArgs = {};
        }
      }
      
      console.log(`\n🔧 工具参数: ${JSON.stringify(toolArgs, null, 2)}`);
      
      // 执行工具调用
      try {
        const toolResult = await tool.invoke(toolArgs);
        
        // 保存工具调用信息到会话历史
        if (this.currentSessionId) {
          const toolCallInfo = `🛠️ 直接调用工具: ${tool.name}\n输入: ${JSON.stringify(toolArgs, null, 2)}`;
          await this.checkpointSaver.saveMessage(this.currentSessionId, 'system', toolCallInfo);
          
          const toolResultInfo = `✅ 工具结果 (${tool.name}):\n${JSON.stringify(toolResult, null, 2)}`;
          await this.checkpointSaver.saveMessage(this.currentSessionId, 'system', toolResultInfo);
        }
        
        // 生成最终响应
        const finalResult = await this.model.invoke([
          new SystemMessage(`工具调用已完成。请基于工具结果为用户提供完整的回答。要求：
1. 解释工具执行的结果
2. 回答要完整、准确
3. 用中文回答，格式清晰
4. 如果工具返回的是搜索结果，请整理成易读的格式`),
          new HumanMessage(`用户需求：${state.messages[0].content}\n\n工具：${tool.name}\n工具结果：${JSON.stringify(toolResult, null, 2)}`)
        ]);
        
        return { messages: [finalResult] };
      } catch (error) {
        console.error('工具调用失败:', error);
        
        // 工具调用失败，使用绑定工具的模型重试
        const result = await this.modelWithTools.invoke(state.messages);
        return { messages: [result] };
      }
    };

    // 复杂任务处理节点 - 使用绑定工具的模型
    const complexTaskNode = async (state: typeof MessagesAnnotation.State) => {
      console.log("\n🔧 处理复杂任务...");
      
      // 使用绑定工具的模型处理消息
      const result = await this.modelWithTools.invoke(state.messages);
      
      return { messages: [result] };
    };

    // 工具节点
    const toolNode = new ToolNode(this.tools);

    // 路由决策函数
    const initialRouteDecision = (state: typeof MessagesAnnotation.State) => {
      const lastMessage = state.messages[state.messages.length - 1];
      const routeType = lastMessage.additional_kwargs?.route_type;
      
      console.log(`\n🔄 初始路由决策: ${routeType}`);
      
      switch (routeType) {
        case 'simple_greeting':
          return "greeting";
        case 'direct_tool':
          return "direct_tool";
        case 'complex_task':
          return "complex_task";
        default:
          console.log("⚠️ 未识别的路由类型，默认按复杂任务处理");
          return "complex_task";
      }
    };

    // 复杂任务路由决策函数
    const complexRouteDecision = (state: typeof MessagesAnnotation.State) => {
      const lastMessage = state.messages[state.messages.length - 1];
      
      console.log(`\n🔄 复杂任务路由决策: 检查工具调用`);
      
      // 检查是否有工具调用
      if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls?.length) {
        console.log(`✅ 发现 ${lastMessage.tool_calls.length} 个工具调用，路由到工具节点`);
        return "tools";
      }
      
      console.log("✅ 无工具调用，结束处理");
      return "__end__";
    };

    // 构建工作流
    return new StateGraph(MessagesAnnotation)
      .addNode("route", routeNode)
      .addNode("greeting", greetingNode)
      .addNode("direct_tool", directToolNode)
      .addNode("complex_task", complexTaskNode)
      .addNode("tools", toolNode)
      .addEdge("__start__", "route")
      .addConditionalEdges(
        "route",
        initialRouteDecision,
        ["greeting", "direct_tool", "complex_task"]
      )
      .addEdge("greeting", "__end__")
      .addEdge("direct_tool", "__end__")
      .addConditionalEdges(
        "complex_task",
        complexRouteDecision,
        ["tools", "__end__"]
      )
      .addEdge("tools", "complex_task")
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
   * 自动加载最新会话或创建新会话
   */
  async loadLatestOrCreateSession(): Promise<string> {
    try {
      // 首先尝试从文件加载最后会话ID
      const lastSessionId = this.loadLastSessionId();
      if (lastSessionId) {
        const sessionExists = await this.sessionExists(lastSessionId);
        if (sessionExists) {
          await this.loadSession(lastSessionId);
          console.log(`📂 自动加载最近会话: ${lastSessionId.slice(0, 8)}...`);
          return lastSessionId;
        }
      }

      // 如果没有保存的会话ID或会话不存在，尝试加载最新的会话
      const sessions = await this.listSessions();
      if (sessions.length > 0) {
        const latestSession = sessions[0]; // sessions 已按更新时间排序
        await this.loadSession(latestSession.sessionId);
        console.log(`📂 自动加载最新会话: ${latestSession.sessionId.slice(0, 8)}... (${latestSession.title})`);
        return latestSession.sessionId;
      }

      // 如果没有任何会话，创建新会话
      const newSessionId = await this.createNewSession();
      console.log(`🆕 创建新会话: ${newSessionId.slice(0, 8)}...`);
      return newSessionId;
    } catch (error) {
      console.error('❌ 自动加载会话失败，创建新会话:', error);
      return await this.createNewSession();
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
        await this.loadLatestOrCreateSession();
      }

      // 保存用户消息
      const saveStart = Date.now();
      await this.checkpointSaver.saveMessage(this.currentSessionId!, 'user', message);
      this.performanceMonitor.record('saveUserMessage', Date.now() - saveStart);

      // 调用工作流处理
      const workflowStart = Date.now();
      console.log("正在处理用户需求")
      const result = await this.workflow.invoke({
        messages: [new HumanMessage(message)]
      }, {
        configurable: { thread_id: this.currentSessionId }
      });
      console.log("用户需求处理结束")
      this.performanceMonitor.record('workflowInvoke', Date.now() - workflowStart);

      // 保存AI回复
      const saveAIStart = Date.now();
      if (result.messages && result.messages.length > 0) {
        for (const message of result.messages) {
          await this.checkpointSaver.saveMessage(this.currentSessionId!, 'assistant', message.content);
        }
      }
      this.performanceMonitor.record('saveAIMessage', Date.now() - saveAIStart);

      // 保存最后会话ID
      this.saveLastSessionId();
      
      const finalResponse = result.messages && result.messages.length > 0 ? result.messages[result.messages.length - 1].content : '无回复内容';
      
      // 计算并输出响应时间
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      console.log(`\n⏱️  响应时间: ${responseTime}ms`);
      
      return finalResponse;
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
} 