import { ConversationMessage } from '@/types/conversation.js';
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

/** 上下文限制配置接口，借鉴 Codex 的多维度限制策略 */
export interface ContextLimits {
  /** 最大消息数量 */
  maxMessages: number;
  /** 最大token数量 */
  maxTokens: number;
  /** 最大字节数 */
  maxBytes: number;
  /** 最大行数 */
  maxLines: number;
  /** 最少保留的最近消息数 */
  minRecentMessages: number;
  /** 系统消息处理策略 */
  systemMessageHandling: 'always_keep' | 'smart_merge' | 'latest_only';
  /** 截断策略 */
  truncationStrategy: 'simple_sliding_window' | 'smart_sliding_window' | 'importance_based';
  /** Token估算模式 */
  tokenEstimationMode: 'simple' | 'enhanced' | 'precise';
  /** 启用敏感信息过滤 */
  enableSensitiveFiltering: boolean;
  /** 启用性能日志 */
  enablePerformanceLogging: boolean;
}

/** 上下文统计信息 */
export interface ContextStats {
  /** 总优化次数 */
  totalOptimizations: number;
  /** 总截断次数 */
  totalTruncations: number;
  /** 平均每条消息的token数 */
  avgTokensPerMessage: number;
  /** 最后一次优化时间 */
  lastOptimizationTime: number;
}

/** 消息重要性评分接口 */
export interface MessageImportance {
  /** 消息索引 */
  index: number;
  /** 重要性分数 (0-1) */
  score: number;
  /** 消息类型 */
  type: 'system' | 'user' | 'assistant' | 'tool';
  /** 是否包含关键信息 */
  hasKeyInfo: boolean;
}

/** 消息有效性检查结果 - 双重历史机制核心接口 */
export interface MessageValidityResult {
  /** 消息是否有效 */
  isValid: boolean;
  /** 失败原因（当isValid为false时） */
  failureReason?: string;
  /** 检查时间戳 */
  checkedAt: number;
}

/** 策划历史统计信息 - 用于监控过滤效果 */
export interface CurationStats {
  /** 原始消息数量 */
  originalCount: number;
  /** 策划后消息数量 */
  curatedCount: number;
  /** 过滤掉的无效轮次数 */
  filteredRounds: number;
  /** 处理耗时（毫秒） */
  processingTime: number;
}

/**
 * 智能上下文管理器
 * 
 * 借鉴 Codex 项目的多层次防护策略：
 * 1. 预防性截断：多维度限制（消息数、token数、字节数、行数）
 * 2. 配置驱动：灵活的限制管理
 * 3. 智能检测：实时监控和动态调整
 * 4. 优雅降级：超限时的智能处理
 * 5. 分层存储：重要性分级保留
 */
export class ContextManager {
  /** 上下文限制配置 */
  private config: ContextLimits;
  
  /** 性能统计 */
  private stats: ContextStats = {
    totalOptimizations: 0,
    totalTruncations: 0,
    avgTokensPerMessage: 100,
    lastOptimizationTime: 0,
  };

  /** 敏感信息过滤模式 - 按长度降序排列，避免短模式破坏长模式匹配 */
  private sensitivePatterns: string[] = [
    'authorization', 'access_token', 'refresh_token', 'secret_key',
    'password', 'api_key', 'bearer', 'secret', 'token', 'auth', 'key'
  ];

  constructor(config?: Partial<ContextLimits>) {
    // 默认配置，借鉴 Codex 的配置策略
    this.config = {
      maxMessages: config?.maxMessages ?? 20,
      maxTokens: config?.maxTokens ?? 32000,
      maxBytes: config?.maxBytes ?? 1024 * 100,  // 100KB，参考 Codex 的 shell 输出限制
      maxLines: config?.maxLines ?? 500,         // 500行，适度放宽
      minRecentMessages: config?.minRecentMessages ?? 5,
      systemMessageHandling: config?.systemMessageHandling ?? 'always_keep',
      truncationStrategy: config?.truncationStrategy ?? 'smart_sliding_window',
      tokenEstimationMode: config?.tokenEstimationMode ?? 'enhanced',
      enableSensitiveFiltering: config?.enableSensitiveFiltering ?? true,
      enablePerformanceLogging: config?.enablePerformanceLogging ?? false,
    };

    if (this.config.enablePerformanceLogging) {
      console.log('🔧 ContextManager initialized with config:', this.config);
    }
  }

  /**
   * 优化对话上下文 - 借鉴 Codex 的多层次防护策略
   * 
   * 实现预防+检测+降级的三重保护机制：
   * 1. 预防性检查：多维度限制检测
   * 2. 智能截断：基于重要性的截断策略
   * 3. 优雅降级：确保关键信息不丢失
   * 
   * @param allMessages 完整的对话历史
   * @param systemPrompt 系统提示词  
   * @param currentMessage 当前用户消息
   * @returns 优化后的消息数组
   */
  async optimizeContext(
    allMessages: ConversationMessage[],
    systemPrompt: string,
    currentMessage: string
  ): Promise<BaseMessage[]> {
    const startTime = Date.now();
    this.stats.totalOptimizations++;

    if (this.config.enablePerformanceLogging) {
      console.log(`🧠 开始上下文优化：总消息数 ${allMessages.length}`);
    }

    try {
      // 1. 敏感信息过滤
      const filteredMessages = this.config.enableSensitiveFiltering 
        ? this.filterSensitiveInfo(allMessages)
        : allMessages;

      // 2. 转换消息格式
      const langchainMessages = this.convertToLangChainMessages(filteredMessages);
      
      // 3. 多维度限制检查
      const limitCheckResult = this.performLimitChecks(langchainMessages, systemPrompt, currentMessage);
      
      // 4. 根据检查结果选择截断策略
      const optimizedMessages = await this.applySuitableTruncationStrategy(
        langchainMessages, 
        limitCheckResult
      );
      
      // 5. 构建最终消息数组
      const finalMessages = this.buildFinalMessageArray(
        optimizedMessages, 
        systemPrompt, 
        currentMessage
      );

      // 6. 更新统计信息
      this.updatePerformanceStats(startTime, finalMessages.length - 2);

      if (this.config.enablePerformanceLogging) {
        console.log(`🎯 上下文优化完成：${finalMessages.length} 条消息 (耗时: ${Date.now() - startTime}ms)`);
      }
      
      return finalMessages;

    } catch (error) {
      console.error('❌ 上下文优化失败:', error);
      // 降级策略：使用简单截断
      return this.fallbackOptimization(allMessages, systemPrompt, currentMessage);
    }
  }

  /**
   * 敏感信息过滤 - 借鉴 Codex 的安全策略
   */
  private filterSensitiveInfo(messages: ConversationMessage[]): ConversationMessage[] {
    if (!this.config.enableSensitiveFiltering) {
      return messages;
    }

    return messages.map(msg => {
      let content = msg.message.content;
      
      // 检查并过滤敏感模式 - 只匹配键值对格式，避免误过滤正常讨论
      for (const pattern of this.sensitivePatterns) {
        // 特殊处理：Authorization header 格式
        if (pattern.toLowerCase() === 'authorization') {
          const authRegex = new RegExp(`\\b${pattern}\\b\\s*:\\s*\\w+\\s+[\\w\\-\\.]+`, 'gi');
          content = content.replace(authRegex, `${pattern}: [FILTERED]`);
        } else {
          // 普通格式：pattern + (冒号/等号) + 值，支持引号包围的值
          const regex = new RegExp(`\\b${pattern}\\b\\s*[:=]\\s*[\\w\\-\\."\\']+`, 'gi');
          content = content.replace(regex, `${pattern}: [FILTERED]`);
        }
      }
      
      return {
        ...msg,
        message: {
          ...msg.message,
          content
        }
      };
    });
  }

  /**
   * 多维度限制检查 - 实现 Codex 风格的预防性检测
   */
  private performLimitChecks(
    messages: BaseMessage[], 
    systemPrompt: string, 
    currentMessage: string
  ): {
    exceedsMessages: boolean;
    exceedsTokens: boolean;
    exceedsBytes: boolean;
    exceedsLines: boolean;
    totalBytes: number;
    totalLines: number;
    estimatedTokens: number;
  } {
    // 计算所有内容的总量
    const allContent = [
      systemPrompt,
      ...messages.map(m => this.getMessageContent(m)),
      currentMessage
    ].join('\n');

    const totalBytes = Buffer.byteLength(allContent, 'utf8');
    const totalLines = allContent.split('\n').length;
    const estimatedTokens = this.estimateTokenCount([...messages, new HumanMessage(currentMessage)]) + 
                           this.estimateTokenCount([new SystemMessage(systemPrompt)]);

    return {
      exceedsMessages: messages.length > this.config.maxMessages,
      exceedsTokens: estimatedTokens > this.config.maxTokens,
      exceedsBytes: totalBytes > this.config.maxBytes,
      exceedsLines: totalLines > this.config.maxLines,
      totalBytes,
      totalLines,
      estimatedTokens,
    };
  }

  /**
   * 应用合适的截断策略
   */
  private async applySuitableTruncationStrategy(
    messages: BaseMessage[],
    limitCheck: ReturnType<typeof this.performLimitChecks>
  ): Promise<BaseMessage[]> {
    // 如果没有超限，直接返回
    if (!limitCheck.exceedsMessages && !limitCheck.exceedsTokens && 
        !limitCheck.exceedsBytes && !limitCheck.exceedsLines) {
      return messages;
    }

    this.stats.totalTruncations++;

    // 根据配置选择截断策略
    switch (this.config.truncationStrategy) {
      case 'simple_sliding_window':
        return this.applySimpleSlidingWindow(messages);
      
      case 'smart_sliding_window':
        return this.applySmartSlidingWindow(messages, limitCheck);
      
      case 'importance_based':
        return this.applyImportanceBasedTruncation(messages, limitCheck);
      
      default:
        return this.applySmartSlidingWindow(messages, limitCheck);
    }
  }

  /**
   * 智能滑动窗口策略 - 借鉴 Codex 的智能截断逻辑
   */
  private applySmartSlidingWindow(
    messages: BaseMessage[],
    limitCheck: ReturnType<typeof this.performLimitChecks>
  ): BaseMessage[] {
    // 分离不同类型的消息
    const systemMessages = messages.filter(msg => msg.getType() === 'system');
    const nonSystemMessages = messages.filter(msg => msg.getType() !== 'system');

    // 系统消息处理
    let keptSystemMessages: BaseMessage[] = [];
    switch (this.config.systemMessageHandling) {
      case 'always_keep':
        keptSystemMessages = systemMessages;
        break;
      case 'latest_only':
        keptSystemMessages = systemMessages.slice(-1);
        break;
      case 'smart_merge':
        keptSystemMessages = this.mergeSystemMessages(systemMessages);
        break;
    }

    // 计算可用的消息预算
    let availableMessageCount = this.config.maxMessages - keptSystemMessages.length;
    availableMessageCount = Math.max(availableMessageCount, this.config.minRecentMessages);

    // 保留最近的消息
    const recentMessages = nonSystemMessages.slice(-availableMessageCount);

    // 如果仍然超出token限制，进一步缩减
    let finalMessages = [...keptSystemMessages, ...recentMessages];
    let currentTokens = this.estimateTokenCount(finalMessages);

    while (currentTokens > this.config.maxTokens && recentMessages.length > this.config.minRecentMessages) {
      recentMessages.shift();
      finalMessages = [...keptSystemMessages, ...recentMessages];
      currentTokens = this.estimateTokenCount(finalMessages);
    }

    if (this.config.enablePerformanceLogging) {
      console.log(`📐 智能滑动窗口：保留 ${finalMessages.length} 条消息，预估 ${currentTokens} tokens`);
    }

    return finalMessages;
  }

  /**
   * 基于重要性的截断策略
   */
  private applyImportanceBasedTruncation(
    messages: BaseMessage[],
    limitCheck: ReturnType<typeof this.performLimitChecks>
  ): BaseMessage[] {
    // 计算每条消息的重要性分数
    const messageImportances = this.calculateMessageImportance(messages);
    
    // 按重要性排序
    messageImportances.sort((a, b) => b.score - a.score);
    
    // 选择最重要的消息，确保不超过限制
    const selectedIndices = new Set<number>();
    let currentTokens = 0;
    let currentMessages = 0;
    
    for (const importance of messageImportances) {
      const message = messages[importance.index];
      const messageTokens = this.estimateTokenCount([message]);
      
      if (currentTokens + messageTokens <= this.config.maxTokens && 
          currentMessages < this.config.maxMessages) {
        selectedIndices.add(importance.index);
        currentTokens += messageTokens;
        currentMessages++;
      }
    }
    
    // 按原始顺序返回选中的消息
    return messages.filter((_, index) => selectedIndices.has(index));
  }

  /**
   * 转换ByteCraft消息格式为LangChain格式
   */
  private convertToLangChainMessages(messages: ConversationMessage[]): BaseMessage[] {
    return messages.map(msg => {
      const role = msg.message.role;
      const content = msg.message.content;

      switch (role) {
        case 'user':
          return new HumanMessage(content);
        case 'assistant':
          return new AIMessage(content);
        case 'system':
          return new SystemMessage(content);
        default:
          // 默认处理为用户消息
          return new HumanMessage(content);
      }
    });
  }

  /**
   * 简单滑动窗口策略
   */
  private applySimpleSlidingWindow(messages: BaseMessage[]): BaseMessage[] {
    if (messages.length <= this.config.maxMessages) {
      return messages;
    }

    // 分离系统消息和其他消息
    const systemMessages = messages.filter(msg => msg.getType() === 'system');
    const otherMessages = messages.filter(msg => msg.getType() !== 'system');

    // 保留最近的消息
    const availableSlots = this.config.maxMessages - systemMessages.length;
    const recentMessages = otherMessages.slice(-Math.max(availableSlots, this.config.minRecentMessages));

    if (this.config.enablePerformanceLogging) {
      console.log(`📦 简单滑动窗口：保留 ${recentMessages.length} 条最近消息`);
    }

    return [...systemMessages, ...recentMessages];
  }

  /**
   * 合并系统消息
   */
  private mergeSystemMessages(systemMessages: BaseMessage[]): BaseMessage[] {
    if (systemMessages.length <= 1) {
      return systemMessages;
    }

    // 合并所有系统消息的内容
    const mergedContent = systemMessages
      .map(msg => this.getMessageContent(msg))
      .join('\n\n---\n\n');

    return [new SystemMessage(mergedContent)];
  }

  /**
   * 计算消息重要性
   */
  private calculateMessageImportance(messages: BaseMessage[]): MessageImportance[] {
    return messages.map((message, index) => {
      let score = 0.5; // 基础分数
      const content = this.getMessageContent(message);
      const type = message.getType() as 'system' | 'user' | 'assistant' | 'tool';

      // 系统消息最重要
      if (type === 'system') {
        score = 1.0;
      }

      // 包含关键词的消息更重要
      const keywordBonus = this.calculateKeywordBonus(content);
      score += keywordBonus;

      // 最近的消息更重要
      const recentBonus = (index / messages.length) * 0.3;
      score += recentBonus;

      // 长度适中的消息更重要
      const lengthScore = this.calculateLengthScore(content);
      score += lengthScore;

      return {
        index,
        score: Math.min(score, 1.0),
        type,
        hasKeyInfo: keywordBonus > 0,
      };
    });
  }

  /**
   * 计算关键词奖励分数
   */
  private calculateKeywordBonus(content: string): number {
    const keywords = ['error', 'bug', 'fix', 'important', 'warning', 'config', 'setup'];
    let bonus = 0;
    
    for (const keyword of keywords) {
      if (content.toLowerCase().includes(keyword)) {
        bonus += 0.1;
      }
    }
    
    return Math.min(bonus, 0.3);
  }

  /**
   * 计算长度分数
   */
  private calculateLengthScore(content: string): number {
    const length = content.length;
    // 倾向于长度适中的消息（100-500字符）
    if (length >= 100 && length <= 500) {
      return 0.1;
    } else if (length > 1000) {
      return -0.1;
    }
    return 0;
  }

  /**
   * 获取消息内容
   */
  private getMessageContent(message: BaseMessage): string {
    return typeof message.content === 'string' 
      ? message.content 
      : JSON.stringify(message.content);
  }

  /**
   * 构建最终消息数组
   */
  private buildFinalMessageArray(
    optimizedMessages: BaseMessage[],
    systemPrompt: string,
    currentMessage: string
  ): BaseMessage[] {
    // 移除已有的系统消息，因为我们要添加新的
    const nonSystemMessages = optimizedMessages.filter(msg => msg.getType() !== 'system');
    
    return [
      new SystemMessage(systemPrompt),
      ...nonSystemMessages,
      new HumanMessage(currentMessage)
    ];
  }

  /**
   * 更新性能统计
   */
  private updatePerformanceStats(startTime: number, finalMessageCount: number): void {
    this.stats.lastOptimizationTime = Date.now() - startTime;
    
    // 动态更新平均token数
    if (finalMessageCount > 0) {
      this.stats.avgTokensPerMessage = Math.round(
        (this.stats.avgTokensPerMessage * 0.9) + (finalMessageCount * 0.1)
      );
    }
  }

  /**
   * 降级优化策略
   */
  private fallbackOptimization(
    allMessages: ConversationMessage[],
    systemPrompt: string,
    currentMessage: string
  ): BaseMessage[] {
    console.warn('🚨 使用降级策略进行上下文优化');
    
    // 简单截断：只保留最近的几条消息
    const recentMessages = allMessages.slice(-this.config.minRecentMessages);
    const langchainMessages = this.convertToLangChainMessages(recentMessages);
    
    return [
      new SystemMessage(systemPrompt),
      ...langchainMessages,
      new HumanMessage(currentMessage)
    ];
  }

  /**
   * 增强的token估算 - 借鉴 Codex 的精确计算思路
   */
  private estimateTokenCount(messages: BaseMessage[]): number {
    switch (this.config.tokenEstimationMode) {
      case 'simple':
        return this.simpleTokenEstimation(messages);
      case 'enhanced':
        return this.enhancedTokenEstimation(messages);
      case 'precise':
        return this.preciseTokenEstimation(messages);
      default:
        return this.enhancedTokenEstimation(messages);
    }
  }

  /**
   * 简单token估算
   */
  private simpleTokenEstimation(messages: BaseMessage[]): number {
    const totalChars = messages.reduce((sum, msg) => {
      const content = this.getMessageContent(msg);
      return sum + content.length;
    }, 0);

    return Math.ceil(totalChars / 3);
  }

  /**
   * 增强token估算 - 考虑不同语言特性
   */
  private enhancedTokenEstimation(messages: BaseMessage[]): number {
    let totalTokens = 0;

    for (const message of messages) {
      const content = this.getMessageContent(message);
      
      // 消息角色和结构的token成本
      totalTokens += 4; // 角色标记和结构
      
      // 内容token估算
      const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
      const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
      const symbols = content.length - chineseChars - englishWords;
      
      // 中文：~1.5字符/token，英文：~4字符/token，符号：~2字符/token
      totalTokens += Math.ceil(chineseChars / 1.5) + 
                     Math.ceil(englishWords / 0.75) + 
                     Math.ceil(symbols / 2);
    }

    return totalTokens;
  }

  /**
   * 精确token估算 - 未来可集成tiktoken等库
   */
  private preciseTokenEstimation(messages: BaseMessage[]): number {
    // TODO: 集成 tiktoken 或其他精确的tokenizer
    // 目前使用增强估算作为降级
    return this.enhancedTokenEstimation(messages);
  }

  /**
   * 创建对话摘要 - 高级功能
   * 
   * 对于非常长的对话，可以创建摘要来保留重要上下文
   */
  private async createConversationSummary(messages: BaseMessage[]): Promise<string> {
    // TODO: 实现对话摘要功能
    // 可以使用另一个LLM调用来生成对话摘要
    // 或者使用规则基于的摘要方法
    
    const messageCount = messages.length;
    const timespan = "最近的对话"; // 可以基于消息时间戳计算
    
    // 提取关键信息
    const keyMessages = messages.filter(msg => {
      const content = this.getMessageContent(msg);
      return this.calculateKeywordBonus(content) > 0;
    });
    
    const summaryPoints = keyMessages.slice(0, 3).map(msg => {
      const content = this.getMessageContent(msg);
      return content.substring(0, 100) + (content.length > 100 ? '...' : '');
    });
    
    return `[对话摘要] ${timespan}，共${messageCount}条消息。关键点：\n${summaryPoints.join('\n')}`;
  }

  /**
   * 获取详细的上下文统计信息 - 借鉴 Codex 的统计策略
   */
  getContextStats(allMessages: ConversationMessage[]): {
    totalMessages: number;
    estimatedTokens: number;
    totalBytes: number;
    totalLines: number;
    willTruncate: boolean;
    truncationReasons: string[];
    performanceStats: ContextStats;
    config: ContextLimits;
  } {
    const langchainMessages = this.convertToLangChainMessages(allMessages);
    const estimatedTokens = this.estimateTokenCount(langchainMessages);
    
    // 计算总字节数和行数
    const allContent = langchainMessages
      .map(m => this.getMessageContent(m))
      .join('\n');
    const totalBytes = Buffer.byteLength(allContent, 'utf8');
    const totalLines = allContent.split('\n').length;
    
    // 检查截断原因
    const truncationReasons: string[] = [];
    if (allMessages.length > this.config.maxMessages) {
      truncationReasons.push(`消息数量超限 (${allMessages.length}/${this.config.maxMessages})`);
    }
    if (estimatedTokens > this.config.maxTokens) {
      truncationReasons.push(`Token数量超限 (${estimatedTokens}/${this.config.maxTokens})`);
    }
    if (totalBytes > this.config.maxBytes) {
      truncationReasons.push(`字节数超限 (${totalBytes}/${this.config.maxBytes})`);
    }
    if (totalLines > this.config.maxLines) {
      truncationReasons.push(`行数超限 (${totalLines}/${this.config.maxLines})`);
    }
    
    return {
      totalMessages: allMessages.length,
      estimatedTokens,
      totalBytes,
      totalLines,
      willTruncate: truncationReasons.length > 0,
      truncationReasons,
      performanceStats: { ...this.stats },
      config: { ...this.config }
    };
  }

  /**
   * 更新配置 - 支持动态配置调整
   */
  updateConfig(newConfig: Partial<ContextLimits>): void {
    const oldConfig = { ...this.config };
    
    // 更新配置
    Object.assign(this.config, newConfig);
    
    if (this.config.enablePerformanceLogging) {
      console.log('⚙️  上下文管理器配置已更新');
      console.log('旧配置:', oldConfig);
      console.log('新配置:', this.config);
    }
  }

  /**
   * 重置性能统计
   */
  resetStats(): void {
    this.stats = {
      totalOptimizations: 0,
      totalTruncations: 0,
      avgTokensPerMessage: 100,
      lastOptimizationTime: 0,
    };
    
    if (this.config.enablePerformanceLogging) {
      console.log('📊 性能统计已重置');
    }
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    efficiency: number;
    avgOptimizationTime: number;
    truncationRate: number;
    recommendations: string[];
  } {
    const efficiency = this.stats.totalOptimizations > 0 
      ? 1 - (this.stats.totalTruncations / this.stats.totalOptimizations)
      : 1;
    
    const truncationRate = this.stats.totalOptimizations > 0
      ? this.stats.totalTruncations / this.stats.totalOptimizations
      : 0;
    
    const recommendations: string[] = [];
    
    if (truncationRate > 0.5) {
      recommendations.push('考虑增加最大消息数或token限制');
    }
    if (this.stats.lastOptimizationTime > 100) {
      recommendations.push('优化操作耗时较长，考虑使用简单截断策略');
    }
    if (this.stats.avgTokensPerMessage > 200) {
      recommendations.push('消息平均长度较长，考虑启用摘要功能');
    }
    
    return {
      efficiency,
      avgOptimizationTime: this.stats.lastOptimizationTime,
      truncationRate,
      recommendations
    };
  }

  /**
   * 添加敏感模式
   */
  addSensitivePattern(pattern: string): void {
    if (!this.sensitivePatterns.includes(pattern)) {
      this.sensitivePatterns.push(pattern);
      if (this.config.enablePerformanceLogging) {
        console.log(`🔒 添加敏感模式: ${pattern}`);
      }
    }
  }

  /**
   * 移除敏感模式  
   */
  removeSensitivePattern(pattern: string): void {
    const index = this.sensitivePatterns.indexOf(pattern);
    if (index > -1) {
      this.sensitivePatterns.splice(index, 1);
      if (this.config.enablePerformanceLogging) {
        console.log(`🔓 移除敏感模式: ${pattern}`);
      }
    }
  }

  /**
   * 导出配置
   */
  exportConfig(): ContextLimits {
    return { ...this.config };
  }

  /**
   * 导入配置
   */
  importConfig(config: ContextLimits): void {
    this.config = { ...config };
    if (this.config.enablePerformanceLogging) {
      console.log('📥 配置已导入:', this.config);
    }
  }

  /**
   * 生成策划历史 - 双重历史机制的核心方法
   * 
   * 借鉴 Gemini CLI 的双重历史机制，通过算法过滤无效的对话轮次：
   * 1. 识别和过滤失败的 AI 响应（包含错误标识、中断标识等）
   * 2. 移除对应的用户输入-AI响应对，保持对话逻辑完整性
   * 3. 提供详细的过滤统计信息，便于监控和调优
   * 4. 实现零破坏性修改，不影响现有功能
   * 
   * 算法流程：
   * - 遍历消息数组，按用户-助手对进行分组
   * - 对每个AI响应进行有效性检查
   * - 若AI响应无效，则移除整个对话轮次
   * - 若AI响应有效，则保留整个对话轮次
   * 
   * @param messages 原始消息数组
   * @returns 策划后的消息数组和统计信息
   */
  generateCuratedHistory(messages: ConversationMessage[]): {
    curatedMessages: ConversationMessage[];
    stats: CurationStats;
  } {
    const startTime = Date.now();
    const curatedMessages: ConversationMessage[] = [];
    let filteredRounds = 0;
    let i = 0;
    
    if (this.config.enablePerformanceLogging) {
      console.log(`🔍 开始对话策划：处理 ${messages.length} 条消息`);
    }
    
    while (i < messages.length) {
      if (messages[i].message.role === 'user') {
        // 保存用户消息的索引，稍后可能需要移除
        const userMessageIndex = curatedMessages.length;
        curatedMessages.push(messages[i]);
        i++;
        
        // 收集紧随其后的 AI 响应
        const aiResponses: ConversationMessage[] = [];
        let hasValidResponse = false;
        
        while (i < messages.length && messages[i].message.role === 'assistant') {
          const response = messages[i];
          aiResponses.push(response);
          
          // 检查 AI 响应的有效性
          const validityResult = this.validateResponse(response);
          if (validityResult.isValid) {
            hasValidResponse = true;
          } else if (this.config.enablePerformanceLogging) {
            console.log(`⚠️  发现无效AI响应：${validityResult.failureReason}`);
          }
          
          i++;
        }
        
        // 决定是否保留这个对话轮次
        if (hasValidResponse && aiResponses.length > 0) {
          // 保留有效的 AI 响应
          curatedMessages.push(...aiResponses);
          if (this.config.enablePerformanceLogging && !aiResponses.every(r => this.validateResponse(r).isValid)) {
            console.log(`✅ 保留对话轮次（包含有效响应）`);
          }
        } else if (aiResponses.length > 0) {
          // 移除对应的用户输入（因为 AI 响应无效）
          curatedMessages.splice(userMessageIndex, 1);
          filteredRounds++;
          
          if (this.config.enablePerformanceLogging) {
            console.log(`🗑️  过滤无效对话轮次：AI响应失败，共移除 ${aiResponses.length + 1} 条消息`);
          }
        }
      } else {
        // 处理孤立的系统消息或其他类型消息
        // 系统消息通常应该保留，因为它们包含重要的上下文信息
        curatedMessages.push(messages[i]);
        i++;
      }
    }
    
    const processingTime = Date.now() - startTime;
    
    const stats: CurationStats = {
      originalCount: messages.length,
      curatedCount: curatedMessages.length,
      filteredRounds,
      processingTime
    };
    
    if (this.config.enablePerformanceLogging) {
      console.log(`📋 对话策划完成：${messages.length} → ${curatedMessages.length} 条消息`);
      console.log(`   过滤了 ${filteredRounds} 个无效轮次，耗时 ${processingTime}ms`);
      console.log(`   过滤率：${((filteredRounds / Math.max(1, Math.floor(messages.length / 2))) * 100).toFixed(1)}%`);
    }
    
    return { curatedMessages, stats };
  }

  /**
   * 验证 AI 响应的有效性 - 双重历史机制的核心验证逻辑
   * 
   * 检查规则（按优先级排序）：
   * 1. 内容基本有效性：不能为空，长度合理
   * 2. 错误标识检查：不包含明显的错误标识符
   * 3. 中断标识检查：不包含处理中断或未完成的标识
   * 4. 格式完整性：如果是JSON格式，必须可解析
   * 5. 内容质量：避免过于简短或无意义的响应
   * 
   * 设计原则：
   * - 宁可保留可疑内容，也不过度过滤
   * - 关注明显的失败标识，而非主观质量判断
   * - 支持中英文错误模式识别
   * 
   * @param message 要验证的消息
   * @returns 验证结果，包含是否有效、失败原因和检查时间戳
   */
  private validateResponse(message: ConversationMessage): MessageValidityResult {
    const content = message.message.content;
    const checkedAt = Date.now();
    
    // 检查1：内容基本有效性
    if (!content || content.trim() === '') {
      return {
        isValid: false,
        failureReason: '响应内容为空',
        checkedAt
      };
    }
    
    // 检查2：内容长度检查（过短可能是错误响应）
    // 设置较低的阈值，避免误判简短但有效的响应
    if (content.trim().length < 5) {
      return {
        isValid: false,
        failureReason: '响应内容过短（可能是错误响应）',
        checkedAt
      };
    }
    
    // 检查3：明显的错误标识检查
    // 这些模式通常表示AI处理失败或遇到错误
    const errorPatterns = [
      '[ERROR]',
      'FAILED',
      '❌',
      '错误',
      '失败',
      '无法完成',
      '无法处理',
      '出现问题',
      'Something went wrong',
      'An error occurred',
      'Failed to',
      'Unable to',
      'Cannot process',
      'Error:',
      'Exception:',
      '处理异常',
      '系统错误'
    ];
    
    const lowerContent = content.toLowerCase();
    for (const pattern of errorPatterns) {
      if (lowerContent.includes(pattern.toLowerCase())) {
        return {
          isValid: false,
          failureReason: `包含错误标识: ${pattern}`,
          checkedAt
        };
      }
    }
    
    // 检查4：中断标识检查
    // 这些模式表示AI响应被中断或未完成
    const interruptionPatterns = [
      '...思考中...',
      '正在处理',
      '请稍等',
      'Processing...',
      'Thinking...',
      'Loading...',
      '加载中',
      '处理中',
      '等待响应',
      'Waiting for',
      '正在生成'
    ];
    
    for (const pattern of interruptionPatterns) {
      if (content.includes(pattern)) {
        return {
          isValid: false,
          failureReason: `包含中断标识: ${pattern}`,
          checkedAt
        };
      }
    }
    
    // 检查5：JSON 格式完整性检查
    // 如果响应看起来像JSON，确保它是有效的
    const trimmedContent = content.trim();
    if ((trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) ||
        (trimmedContent.startsWith('[') && trimmedContent.endsWith(']'))) {
      try {
        JSON.parse(trimmedContent);
      } catch (error) {
        return {
          isValid: false,
          failureReason: 'JSON格式无效',
          checkedAt
        };
      }
    }
    
    // 检查6：重复内容检查
    // 检测明显的重复模式（可能表示AI卡住）
    const words = content.split(/\s+/);
    if (words.length >= 10) {
      const repeatedWord = words.find(word => 
        word.length > 2 && 
        words.filter(w => w === word).length > words.length * 0.3
      );
      if (repeatedWord) {
        return {
          isValid: false,
          failureReason: `检测到异常重复内容: ${repeatedWord}`,
          checkedAt
        };
      }
    }
    
    // 通过所有检查，认为响应有效
    return {
      isValid: true,
      checkedAt
    };
  }

  /**
   * 增强的上下文优化方法 - 集成双重历史机制
   * 
   * 新增功能：
   * 1. 双重历史策划 - 在原有优化前先过滤无效对话轮次
   * 2. 保持原有的重要性评分机制完全不变
   * 3. 提供详细的优化统计信息和过程日志
   * 4. 支持策划功能的开关控制
   * 
   * 处理流程：
   * 1. 可选的对话策划（过滤无效轮次）
   * 2. 应用原有的智能优化逻辑
   * 3. 收集和返回详细的统计信息
   * 4. 错误时自动降级到原有方法
   * 
   * @param allMessages 完整的对话历史
   * @param systemPrompt 系统提示词
   * @param currentMessage 当前用户消息
   * @param enableCuration 是否启用策划功能（默认启用）
   * @returns 包含优化后消息和统计信息的结果对象
   */
  async optimizeContextEnhanced(
    allMessages: ConversationMessage[],
    systemPrompt: string,
    currentMessage: string,
    enableCuration: boolean = true
  ): Promise<{
    messages: BaseMessage[];
    optimization: {
      original: number;
      curated: number;
      final: number;
      curationEnabled: boolean;
    };
    stats: {
      curationStats?: CurationStats;
      originalStats: any;
    };
  }> {
    const startTime = Date.now();
    this.stats.totalOptimizations++;

    if (this.config.enablePerformanceLogging) {
      console.log(`🧠 开始增强上下文优化：总消息数 ${allMessages.length}`);
      console.log(`   策划功能：${enableCuration ? '启用' : '禁用'}`);
    }

    try {
      let workingMessages = allMessages;
      let curationStats: CurationStats | undefined;
      
      // 步骤1：策划历史（如果启用）
      // 这一步会过滤掉包含错误或中断标识的无效对话轮次
      if (enableCuration) {
        const curationResult = this.generateCuratedHistory(allMessages);
        workingMessages = curationResult.curatedMessages;
        curationStats = curationResult.stats;
        
        if (this.config.enablePerformanceLogging) {
          console.log(`✂️  策划完成：过滤了 ${curationStats.filteredRounds} 个无效轮次`);
          console.log(`   消息数变化：${allMessages.length} → ${workingMessages.length}`);
        }
      }
      
      // 步骤2：应用原有的优化逻辑（保持不变）
      // 这确保了现有的重要性评分、截断策略等功能完全不受影响
      const finalMessages = await this.optimizeContext(
        workingMessages,
        systemPrompt,
        currentMessage
      );
      
      // 步骤3：收集统计信息
      const originalStats = this.getContextStats(allMessages);
      
      const result = {
        messages: finalMessages,
        optimization: {
          original: allMessages.length,
          curated: workingMessages.length,
          final: finalMessages.length,
          curationEnabled: enableCuration
        },
        stats: {
          curationStats,
          originalStats
        }
      };
      
      if (this.config.enablePerformanceLogging) {
        console.log(`🎯 增强优化完成：${allMessages.length} → ${workingMessages.length} → ${finalMessages.length} 条消息`);
        console.log(`⏱️  总耗时: ${Date.now() - startTime}ms`);
        
        // 显示优化效果统计
        if (curationStats && curationStats.filteredRounds > 0) {
          const reductionRate = ((allMessages.length - finalMessages.length) / allMessages.length * 100).toFixed(1);
          console.log(`📊 优化效果：减少 ${reductionRate}% 的内容，提升上下文质量`);
        }
      }
      
      return result;

    } catch (error) {
      console.error('❌ 增强上下文优化失败:', error);
      // 降级到原有方法，确保系统稳定性
      const fallbackMessages = await this.optimizeContext(allMessages, systemPrompt, currentMessage);
      return {
        messages: fallbackMessages,
        optimization: {
          original: allMessages.length,
          curated: allMessages.length,
          final: fallbackMessages.length,
          curationEnabled: false
        },
        stats: {
          originalStats: this.getContextStats(allMessages)
        }
      };
    }
  }
}