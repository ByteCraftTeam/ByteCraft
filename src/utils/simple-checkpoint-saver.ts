import { MemorySaver } from '@langchain/langgraph';
import { ConversationHistoryManager } from './conversation-history.js';
import { ConversationMessage } from '@/types/conversation.js';

/**
 * 简化的JSONL格式Checkpoint保存器
 * 
 * 这是一个混合架构的checkpoint保存器，结合了LangGraph的内存checkpoint功能
 * 和自定义的JSONL持久化功能。设计目标是在保持LangGraph兼容性的同时，
 * 实现与Claude Code兼容的对话历史存储。
 * 
 * 架构优势：
 * - 继承MemorySaver确保LangGraph集成无缝
 * - 独立的JSONL持久化不影响LangGraph内部机制
 * - 简化的API接口便于使用
 * - 完全兼容Claude Code格式
 * 
 * 使用场景：
 * - 交互式对话中的实时消息保存
 * - 会话切换和恢复
 * - 对话历史的导入导出
 * - 与其他Claude Code实例的数据交换
 */
export class SimpleCheckpointSaver extends MemorySaver {
  /** 对话历史管理器实例 */
  private historyManager: ConversationHistoryManager;
  
  /**
   * 构造函数
   * 
   * @param historyManager 可选的历史管理器实例，未提供则创建默认实例
   */
  constructor(historyManager?: ConversationHistoryManager) {
    // 调用父类构造函数，保持LangGraph的内存checkpoint功能
    super();
    
    // 初始化或使用提供的历史管理器
    this.historyManager = historyManager || new ConversationHistoryManager();
  }

  /**
   * 获取内部历史管理器实例
   * 
   * 提供对底层ConversationHistoryManager的直接访问，
   * 用于需要更细粒度控制的高级操作。
   * 
   * @returns ConversationHistoryManager实例
   */
  getHistoryManager(): ConversationHistoryManager {
    return this.historyManager;
  }

  /**
   * 创建新会话
   * 
   * 通过历史管理器创建新的对话会话，包含完整的目录结构和元数据。
   * 
   * @param title 可选的会话标题
   * @returns Promise<string> 新创建的会话ID
   */
  async createSession(title?: string): Promise<string> {
    return await this.historyManager.createSession(title);
  }

  /**
   * 加载指定会话的消息历史
   * 
   * 从JSONL文件中加载完整的会话消息历史。
   * 
   * @param sessionId 要加载的会话ID
   * @returns Promise<ConversationMessage[]> 会话中的所有消息
   */
  async loadSession(sessionId: string): Promise<ConversationMessage[]> {
    return await this.historyManager.loadSession(sessionId);
  }

  /**
   * 保存单条消息到JSONL文件
   * 
   * 这是最常用的消息保存方法，用于实时保存对话中的每条消息。
   * 消息会立即追加到对应会话的JSONL文件中。
   * 
   * 处理流程：
   * 1. 创建符合Claude Code格式的消息对象
   * 2. 追加到指定会话的JSONL文件
   * 3. 更新会话元数据
   * 
   * @param sessionId 目标会话ID
   * @param type 消息类型：用户、助手或系统消息
   * @param content 消息文本内容
   */
  async saveMessage(sessionId: string, type: 'user' | 'assistant' | 'system', content: string): Promise<void> {
    // 获取最后一条消息的UUID作为parentUuid，保持对话链接关系
    const existingMessages = await this.historyManager.getMessages(sessionId);
    const parentUuid = existingMessages.length > 0 ? 
      existingMessages[existingMessages.length - 1].uuid : null;
    
    // 创建符合Claude Code格式的消息对象，设置正确的parentUuid
    const message = this.historyManager.createMessage(type, content, parentUuid, sessionId);
    
    // 使用去重功能保存消息
    await this.historyManager.addMessageWithDeduplication(sessionId, message);
  }

  /**
   * 保存完整对话历史 - 智能识别新消息并保持parentUuid链接关系
   * 
   * @param sessionId 会话ID
   * @param messages LangGraph返回的完整消息数组
   */
  async saveCompleteConversation(sessionId: string, messages: any[]): Promise<void> {
    // 获取当前已保存的消息
    const existingMessages = await this.historyManager.getMessages(sessionId);
    const existingCount = existingMessages.length;
    
    // 只处理新增的消息
    const newMessages = messages.slice(existingCount);
    
    // 优化：避免循环中重复查询，使用本地跟踪parentUuid
    let lastParentUuid = existingMessages.length > 0 ? 
      existingMessages[existingMessages.length - 1].uuid : null;
    
    for (const message of newMessages) {
      // 根据LangChain的_getType()方法确定正确的type
      let messageType: 'user' | 'assistant' | 'system';
      let content: string;
      
      // 优先使用_getType()方法，这是LangChain的标准方式
      const messageTypeFromLangChain = typeof message._getType === 'function' ? message._getType() : message.role;
      
      if (messageTypeFromLangChain === 'human' || messageTypeFromLangChain === 'user') {
        // 🚨 修复parent UUID问题：跳过用户消息，因为它们已经通过saveMessage单独保存
        // 用户消息在agent-loop.ts:389处已经保存，这里不应该重复处理
        console.log(`跳过用户消息，避免重复保存和parent UUID链条混乱`);
        
        // 更新lastParentUuid为最后一条已保存消息的UUID，确保AI消息能正确链接
        const currentMessages = await this.historyManager.getMessages(sessionId);
        if (currentMessages.length > 0) {
          lastParentUuid = currentMessages[currentMessages.length - 1].uuid;
        }
        continue;
      } else if (messageTypeFromLangChain === 'ai' || messageTypeFromLangChain === 'assistant') {
        messageType = 'assistant';
        // 处理assistant消息的复杂内容结构
        if (Array.isArray(message.content)) {
          content = message.content.map((item: any) => {
            if (item.type === 'text') {
              return item.text;
            } else if (item.type === 'tool_use') {
              return JSON.stringify(item);
            } else if (item.type === 'thinking') {
              return JSON.stringify(item);
            }
            return JSON.stringify(item);
          }).join('\n');
        } else {
          content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        }
      } else if (messageTypeFromLangChain === 'system') {
        messageType = 'system';
        content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
      } else {
        // 处理未知类型的消息，记录警告并默认为assistant
        console.warn(`⚠️  未知消息类型: ${messageTypeFromLangChain}, 默认处理为assistant类型`);
        messageType = 'assistant';
        content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
      }
      
      // 创建消息对象，使用本地跟踪的parentUuid
      const conversationMessage = this.historyManager.createMessage(
        messageType, 
        content, 
        lastParentUuid, 
        sessionId
      );
      
      // 如果有额外的元数据，添加到消息中
      if (message.id) {
        (conversationMessage.message as any).id = message.id;
      }
      if (message.model) {
        (conversationMessage.message as any).model = message.model;
      }
      if (message.usage) {
        (conversationMessage.message as any).usage = message.usage;
      }
      if (message.tool_calls) {
        (conversationMessage.message as any).tool_calls = message.tool_calls;
      }
      if (message.tool_call_id) {
        (conversationMessage.message as any).tool_call_id = message.tool_call_id;
      }
      
      // 添加到历史记录，这里会自动处理去重
      await this.historyManager.addMessageWithDeduplication(sessionId, conversationMessage);
      
      // 更新本地跟踪的parentUuid为当前消息的UUID，供下一条消息使用
      lastParentUuid = conversationMessage.uuid;
    }
  }

  /**
   * 获取所有会话的元数据列表
   * 
   * 返回所有已保存会话的基本信息，用于会话列表展示。
   * 
   * @returns Promise<SessionMetadata[]> 会话元数据数组
   */
  async listSessions() {
    return await this.historyManager.listSessions();
  }

  /**
   * 删除指定会话及其所有数据
   * 
   * 彻底删除会话目录和所有相关文件，不可恢复。
   * 
   * @param sessionId 要删除的会话ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.historyManager.deleteSession(sessionId);
  }
}