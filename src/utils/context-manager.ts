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

  /** 敏感信息过滤模式 */
  private sensitivePatterns: string[] = [
    'password', 'token', 'key', 'secret', 'api_key', 
    'access_token', 'refresh_token', 'bearer', 'auth'
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
      
      // 检查并过滤敏感模式
      for (const pattern of this.sensitivePatterns) {
        const regex = new RegExp(`\\b${pattern}\\b[\\s:=]*[\\w\\-\\.]+`, 'gi');
        content = content.replace(regex, `${pattern}: [FILTERED]`);
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
}