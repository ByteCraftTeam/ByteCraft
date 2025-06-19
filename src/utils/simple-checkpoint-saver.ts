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
    // 创建符合Claude Code格式的消息对象
    const message = this.historyManager.createMessage(type, content, null, sessionId);
    
    // 立即保存到JSONL文件
    await this.historyManager.addMessage(sessionId, message);
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