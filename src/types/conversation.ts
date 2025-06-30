/**
 * 对话消息接口 - 完全兼容Claude Code的JSONL格式
 * 
 * 此接口定义了与Claude Code完全兼容的消息格式，确保可以直接导入/导出
 * Claude Code的对话历史文件
 */
export interface ConversationMessage {
  /** 父消息UUID，用于构建消息树结构 */
  parentUuid: string | null;
  
  /** 是否为侧链消息（Claude Code概念） */
  isSidechain: boolean;
  
  /** 用户类型：external（外部用户）或internal（内部系统） */
  userType: 'external' | 'internal';
  
  /** 当前工作目录 */
  cwd: string;
  
  /** 会话唯一标识符 */
  sessionId: string;
  
  /** 协议版本号 */
  version: string;
  
  /** 消息类型：用户消息、助手回复或系统消息 */
  type: 'user' | 'assistant' | 'system';
  
  /** 消息主体内容 */
  message: {
    /** 消息角色，与type保持一致 */
    role: 'user' | 'assistant' | 'system';
    
    /** 消息文本内容 */
    content: string;
    
    /** 消息发送者名称（可选） */
    name?: string;
    
    /** 工具调用信息（用于函数调用）*/
    tool_calls?: any[];
    
    /** 工具调用ID（用于函数调用响应） */
    tool_call_id?: string;
  };
  
  /** 消息唯一标识符 */
  uuid: string;
  
  /** ISO格式时间戳 */
  timestamp: string;
}

/**
 * 会话元数据接口
 * 
 * 存储会话的基本信息，用于会话列表展示和管理
 */
export interface SessionMetadata {
  /** 会话唯一标识符 */
  sessionId: string;
  
  /** 会话标题（用户可自定义） */
  title: string;
  
  /** 会话创建时间（ISO格式） */
  created: string;
  
  /** 会话最后更新时间（ISO格式） */
  updated: string;
  
  /** 会话中的消息总数 */
  messageCount: number;
  
  /** 会话摘要（可选，用于快速预览） */
  summary?: string;
  
  /** 会话创建时的工作目录 */
  cwd: string;
  
  /** 是否包含LLM生成的摘要消息 */
  hasSummary?: boolean;
  
  /** 最后一个摘要消息的UUID（用于快速定位） */
  lastSummaryUuid?: string;
  
  /** 最后一个摘要的创建时间 */
  lastSummaryTime?: string;
  
  /** 最后一个摘要在消息列表中的索引位置 */
  lastSummaryIndex?: number;
}

/**
 * 会话配置接口
 * 
 * 配置对话历史管理器的行为参数
 */
export interface SessionConfig {
  /** 协议版本号 */
  version: string;
  
  /** 默认工作目录 */
  defaultCwd: string;
  
  /** 默认用户类型 */
  userType: 'external' | 'internal';
  
  /** 历史文件存储目录 */
  historyDir: string;
}

/**
 * 对话历史管理器接口
 * 
 * 定义了完整的会话和消息管理功能，支持CRUD操作
 */
export interface IConversationHistory {
  // === 会话管理方法 ===
  
  /** 创建新会话 */
  createSession(title?: string): Promise<string>;
  
  /** 加载指定会话的所有消息 */
  loadSession(sessionId: string): Promise<ConversationMessage[]>;
  
  /** 保存会话所有消息到文件 */
  saveSession(sessionId: string, messages: ConversationMessage[]): Promise<void>;
  
  /** 删除指定会话及其所有数据 */
  deleteSession(sessionId: string): Promise<void>;
  
  /** 获取所有会话的元数据列表 */
  listSessions(): Promise<SessionMetadata[]>;
  
  // === 消息管理方法 ===
  
  /** 向指定会话添加新消息 */
  addMessage(sessionId: string, message: ConversationMessage): Promise<void>;
  
  /** 获取指定会话的所有消息 */
  getMessages(sessionId: string): Promise<ConversationMessage[]>;
  
  // === 工具方法 ===
  
  /** 生成唯一UUID */
  generateUuid(): string;
  
  /** 获取当前活动会话ID */
  getCurrentSessionId(): string | null;
  
  /** 设置当前活动会话ID */
  setCurrentSessionId(sessionId: string): void;
}