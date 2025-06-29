import React, { memo, useMemo } from "react"
import type { Message } from "../app.js"
import { MessageBubble } from "./message-bubble.js"
import { OptimizedStaticMessageBlock, ReliableStaticMessageBlock } from "./static-message-block.js"
import { BatchedStaticMessageBlock } from "./static-message-block.js"

interface SmartMessageRendererProps {
  messages: Message[]
  blockId: string
  threshold?: number // 超过此数量时使用批量渲染
}

/**
 * 智能消息渲染器
 * 根据消息数量自动选择最佳的渲染策略：
 * - 少量消息：直接渲染
 * - 中等数量：使用可靠的静态块
 * - 大量消息：使用批量渲染
 */
export const SmartMessageRenderer = memo(function SmartMessageRenderer({ 
  messages, 
  blockId,
  threshold = 20 // 默认阈值
}: SmartMessageRendererProps) {
  // 根据消息数量选择渲染策略
  const renderStrategy = useMemo(() => {
    if (messages.length === 0) return 'empty';
    if (messages.length <= 5) return 'direct'; // 少量消息直接渲染
    if (messages.length <= threshold) return 'reliable'; // 中等数量使用可靠块
    return 'batched'; // 大量消息使用批量渲染
  }, [messages.length, threshold]);

  // 直接渲染策略 - 适用于少量消息
  const directRender = useMemo(() => {
    if (renderStrategy !== 'direct') return null;
    
    return messages.map((message) => (
      <MessageBubble key={`${blockId}-${message.id}`} message={message} />
    ));
  }, [messages, blockId, renderStrategy]);

  // 可靠块渲染策略 - 适用于中等数量消息
  const reliableRender = useMemo(() => {
    if (renderStrategy !== 'reliable') return null;
    
    return (
      <ReliableStaticMessageBlock 
        messages={messages} 
        blockId={blockId}
      />
    );
  }, [messages, blockId, renderStrategy]);

  // 批量渲染策略 - 适用于大量消息
  const batchedRender = useMemo(() => {
    if (renderStrategy !== 'batched') return null;
    
    // 根据消息数量动态调整批次大小
    const batchSize = Math.max(10, Math.floor(messages.length / 5));
    
    return (
      <BatchedStaticMessageBlock 
        messages={messages} 
        blockId={blockId}
        batchSize={batchSize}
      />
    );
  }, [messages, blockId, renderStrategy]);

  // 根据策略返回对应的渲染结果
  switch (renderStrategy) {
    case 'empty':
      return null;
    case 'direct':
      return <>{directRender}</>;
    case 'reliable':
      return reliableRender;
    case 'batched':
      return batchedRender;
    default:
      return null;
  }
});

/**
 * 高性能消息渲染器
 * 专门用于渲染大量历史消息，使用虚拟化技术
 */
export const HighPerformanceMessageRenderer = memo(function HighPerformanceMessageRenderer({ 
  messages, 
  blockId,
  maxVisibleMessages = 30 // 最大可见消息数量
}: SmartMessageRendererProps & { maxVisibleMessages?: number }) {
  // 计算可见的消息范围
  const visibleMessages = useMemo(() => {
    if (messages.length <= maxVisibleMessages) {
      return messages;
    }
    
    // 只显示最后maxVisibleMessages条消息
    return messages.slice(-maxVisibleMessages);
  }, [messages, maxVisibleMessages]);

  // 计算被隐藏的消息数量
  const hiddenCount = useMemo(() => {
    return Math.max(0, messages.length - maxVisibleMessages);
  }, [messages.length, maxVisibleMessages]);

  return (
    <>
      {/* 显示隐藏消息的提示 */}
      {hiddenCount > 0 && (
        <MessageBubble 
          key={`${blockId}-hidden-indicator`}
          message={{
            id: `${blockId}-hidden-indicator`,
            type: 'system',
            content: `... 还有 ${hiddenCount} 条历史消息被隐藏以提高性能`,
            timestamp: new Date(),
            streaming: false
          }}
        />
      )}
      
      {/* 渲染可见消息 */}
      <ReliableStaticMessageBlock 
        messages={visibleMessages} 
        blockId={`${blockId}-visible`}
      />
    </>
  );
});

/**
 * 自适应消息渲染器
 * 根据系统性能和消息数量自动调整渲染策略
 */
export const AdaptiveMessageRenderer = memo(function AdaptiveMessageRenderer({ 
  messages, 
  blockId 
}: SmartMessageRendererProps) {
  // 根据消息数量动态选择策略
  const strategy = useMemo(() => {
    const count = messages.length;
    
    if (count === 0) return 'empty';
    if (count <= 10) return 'smart';
    if (count <= 50) return 'high-performance';
    return 'ultra-performance';
  }, [messages.length]);

  switch (strategy) {
    case 'empty':
      return null;
    case 'smart':
      return (
        <SmartMessageRenderer 
          messages={messages} 
          blockId={blockId}
          threshold={15}
        />
      );
    case 'high-performance':
      return (
        <HighPerformanceMessageRenderer 
          messages={messages} 
          blockId={blockId}
          maxVisibleMessages={30}
        />
      );
    case 'ultra-performance':
      return (
        <HighPerformanceMessageRenderer 
          messages={messages} 
          blockId={blockId}
          maxVisibleMessages={20}
        />
      );
    default:
      return null;
  }
}); 