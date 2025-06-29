import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ConversationMessage, SessionMetadata, SessionConfig, IConversationHistory } from '@/types/conversation.js';
import { getContextManagerConfig } from '@/config/config.js';
import { LoggerManager } from './logger/logger.js';

/**
 * JSONL格式的对话历史管理器
 * 
 * 核心功能类，负责管理所有会话和消息的持久化存储。
 * 采用JSONL格式确保与Claude Code完全兼容。
 * 
 * 主要特性：
 * - 支持多会话管理
 * - JSONL格式存储（每行一个JSON对象）
 * - 会话元数据管理
 * - 完整的CRUD操作
 * - Claude Code格式兼容
 * - 内存缓存优化性能
 * 
 * 文件结构：
 * .bytecraft/conversations/
 * ├── <sessionId>/
 * │   ├── metadata.json    # 会话元数据
 * │   └── messages.jsonl   # 消息历史
 */
export class ConversationHistoryManager implements IConversationHistory {
  /** 会话配置参数 */
  private config: SessionConfig;
  
  /** 当前活动的会话ID */
  private currentSessionId: string | null = null;
  
  /** 历史文件存储根目录 */
  private historyDir: string;

  /** 内存缓存：会话消息缓存 */
  private messageCache: Map<string, ConversationMessage[]> = new Map();
  
  /** 内存缓存：会话元数据缓存 */
  private metadataCache: Map<string, SessionMetadata> = new Map();
  
  /** 缓存过期时间（毫秒） */
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟
  
  /** 缓存时间戳 */
  private cacheTimestamps: Map<string, number> = new Map();

  /**
   * 构造函数
   * 
   * @param config 可选的配置参数，未提供的参数将使用默认值
   */
  constructor(config?: Partial<SessionConfig>) {
    // 合并默认配置和用户配置
    this.config = {
      version: '1.0.0',                                                    // 协议版本
      defaultCwd: process.cwd(),                                          // 默认工作目录
      userType: 'external',                                               // 默认用户类型
      historyDir: path.join(process.cwd(), '.bytecraft', 'conversations'), // 默认存储目录
      ...config  // 用户自定义配置覆盖默认值
    };
    
    this.historyDir = this.config.historyDir;
    this.ensureHistoryDir(); // 确保目录存在
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(sessionId: string): boolean {
    const timestamp = this.cacheTimestamps.get(sessionId);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.CACHE_TTL;
  }

  /**
   * 更新缓存时间戳
   */
  private updateCacheTimestamp(sessionId: string): void {
    this.cacheTimestamps.set(sessionId, Date.now());
  }

  /**
   * 清除指定会话的缓存
   */
  private clearSessionCache(sessionId: string): void {
    this.messageCache.delete(sessionId);
    this.metadataCache.delete(sessionId);
    this.cacheTimestamps.delete(sessionId);
  }

  /**
   * 清除所有缓存
   */
  private clearAllCache(): void {
    this.messageCache.clear();
    this.metadataCache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * 确保历史记录目录存在
   * 
   * 私有方法，在构造函数中调用，确保存储目录结构正确创建。
   * 使用recursive: true确保可以创建嵌套目录。
   */
  private async ensureHistoryDir(): Promise<void> {
    try {
      await fs.mkdir(this.historyDir, { recursive: true });
    } catch (error) {
      console.error('创建历史记录目录失败:', error);
    }
  }

  /**
   * 生成唯一UUID
   * 
   * 使用uuid v4算法生成符合RFC 4122标准的唯一标识符。
   * 用于消息ID和会话ID的生成。
   * 
   * @returns 36字符长度的UUID字符串
   */
  generateUuid(): string {
    return uuidv4();
  }

  /**
   * 获取当前活动会话ID
   * 
   * @returns 当前会话ID，如果没有活动会话则返回null
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * 设置当前活动会话ID
   * 
   * 用于切换当前工作的会话上下文。
   * 
   * @param sessionId 要设置为当前的会话ID
   */
  setCurrentSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  /**
   * 创建新会话
   * 
   * 创建一个新的对话会话，包含完整的目录结构和初始化文件。
   * 会话创建后会自动设置为当前活动会话。
   * 
   * 创建过程：
   * 1. 生成唯一的会话ID
   * 2. 创建会话专用目录
   * 3. 初始化元数据文件
   * 4. 创建空的消息历史文件
   * 5. 设置为当前活动会话
   * 
   * @param title 可选的会话标题，如果未提供则使用默认格式
   * @returns Promise<string> 新创建的会话ID
   */
  async createSession(title?: string): Promise<string> {
    // 生成唯一会话标识符
    const sessionId = this.generateUuid();
    
    // 设置会话标题，如果未提供则使用时间戳格式
    const sessionTitle = title || `会话 ${new Date().toLocaleString()}`;
    
    // 创建会话元数据对象
    const metadata: SessionMetadata = {
      sessionId,
      title: sessionTitle,
      created: new Date().toISOString(),    // 创建时间
      updated: new Date().toISOString(),    // 最后更新时间
      messageCount: 0,                      // 初始消息数量为0
      cwd: this.config.defaultCwd          // 当前工作目录
    };

    // 创建会话专用目录 (.bytecraft/conversations/<sessionId>/)
    const sessionDir = path.join(this.historyDir, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    // 保存会话元数据到 metadata.json 文件
    // 使用格式化的JSON便于手动查看和调试
    await fs.writeFile(
      path.join(sessionDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // 创建空的JSONL消息历史文件
    // 该文件将存储所有的对话消息，每行一个JSON对象
    await fs.writeFile(
      path.join(sessionDir, 'messages.jsonl'),
      ''
    );

    // 将新创建的会话设置为当前活动会话
    this.currentSessionId = sessionId;
    
    return sessionId;
  }

  /**
   * 加载指定会话的所有消息
   * 
   * 从JSONL文件中读取并解析会话的完整消息历史。
   * 成功加载后会将该会话设置为当前活动会话。
   * 
   * JSONL解析过程：
   * 1. 检查内存缓存
   * 2. 如果缓存无效，从文件读取
   * 3. 按行分割并过滤空行
   * 4. 逐行解析JSON对象
   * 5. 忽略格式错误的行并记录警告
   * 6. 更新缓存并返回解析成功的消息数组
   * 
   * @param sessionId 要加载的会话ID
   * @returns Promise<ConversationMessage[]> 会话中的所有消息
   * @throws Error 当会话不存在时抛出错误
   */
  async loadSession(sessionId: string): Promise<ConversationMessage[]> {
    // 检查缓存
    if (this.messageCache.has(sessionId) && this.isCacheValid(sessionId)) {
      return this.messageCache.get(sessionId)!;
    }

    // 构建消息文件路径
    const messagesFile = path.join(this.historyDir, sessionId, 'messages.jsonl');
    
    try {
      // 读取JSONL文件内容
      const content = await fs.readFile(messagesFile, 'utf-8');
      
      // 如果文件为空，返回空数组
      if (!content.trim()) {
        const emptyMessages: ConversationMessage[] = [];
        this.messageCache.set(sessionId, emptyMessages);
        this.updateCacheTimestamp(sessionId);
        this.currentSessionId = sessionId;
        return emptyMessages;
      }

      const messages: ConversationMessage[] = [];
      
      // 按行分割并过滤空行，JSONL格式每行一个JSON对象
      const lines = content.split('\n').filter(line => line.trim());
      
      // 逐行解析JSON消息
      for (const line of lines) {
        try {
          // 解析单行JSON为ConversationMessage对象
          const message = JSON.parse(line) as ConversationMessage;
          messages.push(message);
        } catch (error) {
          // 记录解析失败的行，但不中断整个加载过程
          // 这确保了即使部分消息损坏，其他消息仍可正常加载
          console.warn('解析消息失败:', line, error);
        }
      }

      // 更新缓存
      this.messageCache.set(sessionId, messages);
      this.updateCacheTimestamp(sessionId);

      // 成功加载后设置为当前活动会话
      this.currentSessionId = sessionId;
      return messages;
      
    } catch (error) {
      // 处理文件不存在的情况
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`会话不存在: ${sessionId}`);
      }
      // 重新抛出其他类型的错误
      throw error;
    }
  }

  /**
   * 保存会话的所有消息到文件
   * 
   * 将内存中的消息数组完整写入到JSONL文件，用于批量保存操作。
   * 该方法会覆盖现有的消息文件，适用于会话导入或完整重建场景。
   * 
   * 保存过程：
   * 1. 确保会话目录存在
   * 2. 将消息数组转换为JSONL格式
   * 3. 写入messages.jsonl文件
   * 4. 更新会话元数据
   * 
   * @param sessionId 目标会话ID
   * @param messages 要保存的消息数组
   */
  async saveSession(sessionId: string, messages: ConversationMessage[]): Promise<void> {
    const sessionDir = path.join(this.historyDir, sessionId);
    const messagesFile = path.join(sessionDir, 'messages.jsonl');
    
    // 确保会话目录存在（支持新会话或重建场景）
    await fs.mkdir(sessionDir, { recursive: true });

    // 将消息数组转换为JSONL格式
    // 每个消息对象转为一行JSON，用换行符连接
    const jsonlContent = messages.map(msg => JSON.stringify(msg)).join('\n');
    await fs.writeFile(messagesFile, jsonlContent);

    // 更新会话元数据中的消息数量和更新时间
    await this.updateSessionMetadata(sessionId, {
      updated: new Date().toISOString(),
      messageCount: messages.length
    });
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    const sessionDir = path.join(this.historyDir, sessionId);
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
      
      // 清除相关缓存
      this.clearSessionCache(sessionId);
    } catch (error) {
      console.warn('删除会话失败:', error);
    }
  }

  /**
   * 列出所有会话
   */
  async listSessions(): Promise<SessionMetadata[]> {
    try {
      const entries = await fs.readdir(this.historyDir, { withFileTypes: true });
      const sessions: SessionMetadata[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sessionId = entry.name;
          
          // 检查缓存
          if (this.metadataCache.has(sessionId) && this.isCacheValid(sessionId)) {
            sessions.push(this.metadataCache.get(sessionId)!);
            continue;
          }

          try {
            const metadataFile = path.join(this.historyDir, sessionId, 'metadata.json');
            const content = await fs.readFile(metadataFile, 'utf-8');
            const metadata = JSON.parse(content) as SessionMetadata;
            
            // 更新缓存
            this.metadataCache.set(sessionId, metadata);
            this.updateCacheTimestamp(sessionId);
            
            sessions.push(metadata);
          } catch (error) {
            console.warn(`读取会话元数据失败: ${sessionId}`, error);
          }
        }
      }

      // 按更新时间排序
      return sessions.sort((a, b) => 
        new Date(b.updated).getTime() - new Date(a.updated).getTime()
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * 添加消息到会话
   */
  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    const messagesFile = path.join(this.historyDir, sessionId, 'messages.jsonl');
    
    try {
      // 先追加消息到JSONL文件
      const jsonLine = JSON.stringify(message) + '\n';
      await fs.appendFile(messagesFile, jsonLine);

      // 文件写入成功后，更新内存缓存
      if (this.messageCache.has(sessionId)) {
        const cachedMessages = this.messageCache.get(sessionId)!;
        cachedMessages.push(message);
        this.updateCacheTimestamp(sessionId);
      }

      // 检查是否为摘要消息，如果是则更新metadata中的摘要信息
      const isSummaryMessage = message.message.role === 'assistant' && 
                              message.message.content.includes('[对话摘要]');
      
      let metadataUpdates: Partial<SessionMetadata> = {
        updated: new Date().toISOString(),
        messageCount: this.messageCache.has(sessionId) ? this.messageCache.get(sessionId)!.length : undefined
      };
      
      if (isSummaryMessage) {
        // 更新摘要相关的metadata
        metadataUpdates = {
          ...metadataUpdates,
          hasSummary: true,
          lastSummaryUuid: message.uuid,
          lastSummaryTime: message.timestamp,
          // 计算当前消息在列表中的索引位置
          lastSummaryIndex: this.messageCache.has(sessionId) 
            ? this.messageCache.get(sessionId)!.length - 1 
            : undefined
        };
        
        // 使用logger记录摘要metadata更新
        const logger = LoggerManager.getInstance().getLogger('conversation-history');
        logger.info('📝 更新摘要metadata', {
          sessionId: sessionId.substring(0, 8),
          summaryUuid: message.uuid,
          summaryTime: message.timestamp
        });
      }

      // 更新会话元数据
      await this.updateSessionMetadata(sessionId, metadataUpdates);
    } catch (error) {
      // 如果文件写入失败，清除相关缓存确保一致性
      this.clearSessionCache(sessionId);
      throw error;
    }
  }

  /**
   * 带去重功能的添加消息到会话
   * 
   * 这个方法会检查消息是否已经存在，避免重复保存
   */
  async addMessageWithDeduplication(sessionId: string, message: ConversationMessage): Promise<void> {
    // 获取现有消息进行去重检查
    const existingMessages = await this.loadSession(sessionId);
    
    // 检查消息是否已存在
    const isDuplicate = existingMessages.some(existingMessage => {
      // 1. 检查UUID是否相同（完全重复）
      if (existingMessage.uuid === message.uuid) {
        return true;
      }
      
      // 2. 检查内容是否相同且时间接近（可能的重复）
      const contentMatch = existingMessage.message.content === message.message.content;
      const typeMatch = existingMessage.type === message.type;
      const timeDiff = Math.abs(
        new Date(existingMessage.timestamp).getTime() - 
        new Date(message.timestamp).getTime()
      );
      
      // 如果内容相同、类型相同且时间差小于5秒，认为是重复消息
      if (contentMatch && typeMatch && timeDiff < 5000) {
        return true;
      }
      
      return false;
    });
    
    if (isDuplicate) {
      console.warn(`跳过重复消息 [${message.type}]: ${message.message.content.substring(0, 50)}...`);
      return;
    }
    
    // 如果不是重复消息，则正常保存
    await this.addMessage(sessionId, message);
  }

  /**
   * 获取会话消息
   */
  async getMessages(sessionId: string): Promise<ConversationMessage[]> {
    return this.loadSession(sessionId);
  }

  /**
   * 清除指定会话的缓存
   */
  clearCache(sessionId?: string): void {
    if (sessionId) {
      this.clearSessionCache(sessionId);
    } else {
      this.clearAllCache();
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { messageCacheSize: number; metadataCacheSize: number; totalSessions: number } {
    return {
      messageCacheSize: this.messageCache.size,
      metadataCacheSize: this.metadataCache.size,
      totalSessions: this.cacheTimestamps.size
    };
  }

  /**
   * 更新会话元数据
   */
  private async updateSessionMetadata(sessionId: string, updates: Partial<SessionMetadata>): Promise<void> {
    const metadataFile = path.join(this.historyDir, sessionId, 'metadata.json');
    
    try {
      const content = await fs.readFile(metadataFile, 'utf-8');
      const metadata = JSON.parse(content) as SessionMetadata;
      const updatedMetadata = { ...metadata, ...updates };
      
      await fs.writeFile(metadataFile, JSON.stringify(updatedMetadata, null, 2));
      
      // 更新缓存
      this.metadataCache.set(sessionId, updatedMetadata);
      this.updateCacheTimestamp(sessionId);
    } catch (error) {
      console.warn('更新会话元数据失败:', error);
    }
  }

  /**
   * 创建对话消息
   */
  createMessage(
    type: 'user' | 'assistant' | 'system',
    content: string,
    parentUuid: string | null = null,
    sessionId?: string
  ): ConversationMessage {
    const currentSessionId = sessionId || this.currentSessionId;
    if (!currentSessionId) {
      throw new Error('没有活动的会话');
    }

    return {
      parentUuid,
      isSidechain: false,
      userType: this.config.userType,
      cwd: this.config.defaultCwd,
      sessionId: currentSessionId,
      version: this.config.version,
      type,
      message: {
        role: type,
        content
      },
      uuid: this.generateUuid(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 从LangChain消息转换为对话消息
   */
  fromLangChainMessage(langchainMessage: any, parentUuid: string | null = null): ConversationMessage {
    const type = langchainMessage._getType();
    const content = typeof langchainMessage.content === 'string' 
      ? langchainMessage.content 
      : JSON.stringify(langchainMessage.content);

    return this.createMessage(
      type === 'human' ? 'user' : type === 'ai' ? 'assistant' : 'system',
      content,
      parentUuid
    );
  }
  
  /**
   * 更新会话标题
   * 
   * @param sessionId 会话ID
   * @param title 新的会话标题
   */
  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await this.updateSessionMetadata(sessionId, {
      title,
      updated: new Date().toISOString()
    });
  }

  /**
   * 智能恢复会话上下文 - 混合架构的核心方法
   * 
   * 从JSONL历史中智能选择要恢复的消息：
   * 1. 查找最后一个摘要记录
   * 2. 如果有摘要：从摘要开始读取所有后续消息
   * 3. 如果没有摘要：读取所有消息
   * 4. 检查token限制，超限则触发压缩
   * 
   * @param sessionId 会话ID
   * @param tokenLimit 模型token限制
   * @param estimateTokens token估算函数
   * @param compress 可选的压缩函数，当超限时调用
   * @returns 恢复的消息列表
   */
  async loadSessionWithContextOptimization(
    sessionId: string,
    tokenLimit: number,
    estimateTokens: (messages: ConversationMessage[]) => number,
    compress?: (messages: ConversationMessage[]) => Promise<ConversationMessage>
  ): Promise<ConversationMessage[]> {
    // 加载完整历史
    const allMessages = await this.loadSession(sessionId);
    
    if (allMessages.length === 0) {
      return [];
    }
    
    // 查找最后一个摘要记录
    let lastSummaryIndex = -1;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].message.role === 'assistant' && 
          allMessages[i].message.content.includes('[对话摘要]')) {
        lastSummaryIndex = i;
        break;
      }
    }
    
    // 构建候选上下文消息
    let contextMessages: ConversationMessage[];
    if (lastSummaryIndex >= 0) {
      // 有摘要：从摘要开始读取所有后续消息
      contextMessages = allMessages.slice(lastSummaryIndex);
      console.log(`🔄 从摘要恢复：摘要 + ${allMessages.length - lastSummaryIndex - 1} 条后续消息`);
    } else {
      // 没摘要：读取所有消息
      contextMessages = allMessages;
      console.log(`🔄 完整恢复：${allMessages.length} 条历史消息`);
    }
    
    // 检查token限制
    const estimatedTokens = estimateTokens(contextMessages);
    console.log(`🔍 上下文检查：${estimatedTokens} tokens / ${tokenLimit} 限制`);
    
    // 如果超限且提供了压缩函数，触发压缩 (使用配置文件中的阈值)
    const contextConfig = getContextManagerConfig();
    if (estimatedTokens > tokenLimit * contextConfig.compressionThreshold && compress) {
      console.log('⚠️ 上下文超限，开始压缩...');
      
      try {
        const summaryMessage = await compress(contextMessages);
        
        // 保存压缩摘要到JSONL（用于下次加载）
        await this.addMessage(sessionId, summaryMessage);
        
        console.log(`✅ 压缩完成并已保存到JSONL`);
        return [summaryMessage];
        
      } catch (error) {
        console.warn('⚠️ 压缩失败，使用滑动窗口降级:', error);
        
        // 压缩失败，使用滑动窗口
        const maxMessages = Math.floor(tokenLimit * 0.8 / 150); // 假设平均每条消息150 tokens
        contextMessages = contextMessages.slice(-maxMessages);
        console.log(`🔄 滑动窗口降级：保留最近 ${contextMessages.length} 条消息`);
      }
    }
    
    return contextMessages;
  }

  /**
   * 检查会话是否包含摘要记录
   * 
   * @param sessionId 会话ID
   * @returns 是否包含摘要
   */
  async hasSessionSummary(sessionId: string): Promise<boolean> {
    const messages = await this.loadSession(sessionId);
    return messages.some(msg => 
      msg.message.role === 'assistant' && 
      msg.message.content.includes('[对话摘要]')
    );
  }

  /**
   * 获取会话的最新摘要
   * 
   * @param sessionId 会话ID
   * @returns 最新的摘要消息，如果没有则返回null
   */
  async getLatestSummary(sessionId: string): Promise<ConversationMessage | null> {
    const messages = await this.loadSession(sessionId);
    
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].message.role === 'assistant' && 
          messages[i].message.content.includes('[对话摘要]')) {
        return messages[i];
      }
    }
    
    return null;
  }

  /**
   * 基于摘要UUID的快速增量加载
   * 
   * 利用metadata中的摘要信息，只加载从最后摘要点开始的消息，
   * 避免读取完整的JSONL文件，提升加载性能。
   * 
   * @param sessionId 会话ID
   * @returns 从最后摘要点开始的消息列表
   */
  async loadSessionFromSummaryPoint(sessionId: string): Promise<ConversationMessage[]> {
    try {
      // 1. 读取metadata获取摘要信息
      const metadataFile = path.join(this.historyDir, sessionId, 'metadata.json');
      const metadataContent = await fs.readFile(metadataFile, 'utf-8');
      const metadata = JSON.parse(metadataContent) as SessionMetadata;
      
      // 2. 如果没有摘要信息，使用普通加载
      if (!metadata.hasSummary || !metadata.lastSummaryUuid) {
        return await this.loadSession(sessionId);
      }
      
      // 3. 从JSONL文件中查找摘要UUID并收集后续消息
      const messagesFile = path.join(this.historyDir, sessionId, 'messages.jsonl');
      const content = await fs.readFile(messagesFile, 'utf-8');
      
      if (!content.trim()) {
        return [];
      }
      
      const lines = content.split('\n').filter(line => line.trim());
      let foundSummary = false;
      const messages: ConversationMessage[] = [];
      
      // 从文件开始查找摘要UUID，找到后开始收集
      for (const line of lines) {
        try {
          const message = JSON.parse(line) as ConversationMessage;
          
          if (!foundSummary) {
            // 查找摘要消息
            if (message.uuid === metadata.lastSummaryUuid) {
              foundSummary = true;
              messages.push(message); // 包含摘要消息本身
            }
          } else {
            // 摘要后的所有消息
            messages.push(message);
          }
        } catch (error) {
          // 使用logger记录解析失败，但不要在控制台显示过多信息
          const logger = LoggerManager.getInstance().getLogger('conversation-history');
          logger.warning('解析消息失败', { line: line.substring(0, 100), error: error instanceof Error ? error.message : String(error) });
        }
      }
      
      // 4. 如果没找到摘要UUID，可能metadata过期，降级到普通加载
      if (!foundSummary) {
        const logger = LoggerManager.getInstance().getLogger('conversation-history');
        logger.warning('未找到摘要UUID，降级到完整加载', {
          sessionId: sessionId.substring(0, 8),
          expectedUuid: metadata.lastSummaryUuid
        });
        return await this.loadSession(sessionId);
      }
      
      const logger = LoggerManager.getInstance().getLogger('conversation-history');
      logger.info('🚀 快速增量加载完成', {
        sessionId: sessionId.substring(0, 8),
        messageCount: messages.length,
        summaryUuid: metadata.lastSummaryUuid
      });
      return messages;
      
    } catch (error) {
      const logger = LoggerManager.getInstance().getLogger('conversation-history');
      logger.warning('快速增量加载失败，降级到普通加载', {
        sessionId: sessionId.substring(0, 8),
        error: error instanceof Error ? error.message : String(error)
      });
      return await this.loadSession(sessionId);
    }
  }

  /**
   * 优化版的检查会话是否包含摘要
   * 
   * 使用metadata快速判断，避免扫描整个JSONL文件
   * 
   * @param sessionId 会话ID
   * @returns 是否包含摘要
   */
  async hasSessionSummaryFast(sessionId: string): Promise<boolean> {
    try {
      const metadataFile = path.join(this.historyDir, sessionId, 'metadata.json');
      const content = await fs.readFile(metadataFile, 'utf-8');
      const metadata = JSON.parse(content) as SessionMetadata;
      
      return !!metadata.hasSummary;
    } catch (error) {
      // metadata读取失败，降级到原有方法
      return await this.hasSessionSummary(sessionId);
    }
  }
}