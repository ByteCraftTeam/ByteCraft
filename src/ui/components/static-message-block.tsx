import React, { memo, useMemo } from "react"
import type { Message } from "../app.js"
import { MessageBubble } from "./message-bubble.js"

interface StaticMessageBlockProps {
  messages: Message[]
  blockId: string // 用于标识这个静态块
}

/**
 * 静态消息块组件
 * 使用React.memo和useMemo优化性能，专门用于渲染历史消息
 * 只有当消息数组真正变化时才重新渲染
 */
export const StaticMessageBlock = memo(function StaticMessageBlock({ 
  messages, 
  blockId 
}: StaticMessageBlockProps) {
  // 使用useMemo缓存消息渲染，只有当消息数组变化时才重新计算
  const renderedMessages = useMemo(() => {
    return messages.map((message) => (
      <MessageBubble 
        key={`${blockId}-${message.id}`} 
        message={message} 
      />
    ));
  }, [messages, blockId]); // 依赖blockId确保不同块之间的独立性

  return <>{renderedMessages}</>;
}, (prevProps, nextProps) => {
  // 自定义比较函数，只有当消息数量或消息ID变化时才重新渲染
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false; // 需要重新渲染
  }
  
  // 检查消息ID是否发生变化
  for (let i = 0; i < prevProps.messages.length; i++) {
    if (prevProps.messages[i].id !== nextProps.messages[i].id) {
      return false; // 需要重新渲染
    }
  }
  
  return true; // 不需要重新渲染
});

/**
 * 优化的静态消息块组件
 * 进一步优化性能，使用更精确的依赖控制
 */
export const OptimizedStaticMessageBlock = memo(function OptimizedStaticMessageBlock({ 
  messages, 
  blockId 
}: StaticMessageBlockProps) {
  // 使用useMemo缓存消息ID数组，用于依赖比较
  const messageIds = useMemo(() => {
    return messages.map(msg => msg.id);
  }, [messages]);

  // 使用useMemo缓存消息内容的哈希值，用于检测内容变化
  const messageContentHashes = useMemo(() => {
    return messages.map(msg => {
      // 创建一个简单的哈希值来检测内容变化
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return `${msg.id}-${content.length}-${content.substring(0, 50)}`;
    });
  }, [messages]);

  // 使用useMemo缓存渲染结果，依赖消息ID数组和内容哈希值
  const renderedMessages = useMemo(() => {
    return messages.map((message, index) => (
      <MessageBubble 
        key={`${blockId}-${message.id}-${index}`} 
        message={message} 
      />
    ));
  }, [messageIds, messageContentHashes, blockId]); // 依赖消息ID数组和内容哈希值

  return <>{renderedMessages}</>;
});

/**
 * 可靠的静态消息块组件
 * 确保消息内容变化时能正确重新渲染，同时保持性能优化
 */
export const ReliableStaticMessageBlock = memo(function ReliableStaticMessageBlock({ 
  messages, 
  blockId 
}: StaticMessageBlockProps) {
  // 使用useMemo缓存渲染结果，直接依赖messages数组
  const renderedMessages = useMemo(() => {
    return messages.map((message, index) => (
      <MessageBubble 
        key={`${blockId}-${message.id}-${index}`} 
        message={message} 
      />
    ));
  }, [messages, blockId]); // 直接依赖messages数组，确保内容变化时重新渲染

  return <>{renderedMessages}</>;
});

/**
 * 批量静态消息块组件
 * 将消息分成多个块，每个块独立渲染，提高性能
 */
export const BatchedStaticMessageBlock = memo(function BatchedStaticMessageBlock({ 
  messages, 
  blockId,
  batchSize = 10 // 每个块包含的消息数量
}: StaticMessageBlockProps & { batchSize?: number }) {
  // 将消息分成多个批次
  const messageBatches = useMemo(() => {
    const batches = [];
    for (let i = 0; i < messages.length; i += batchSize) {
      batches.push(messages.slice(i, i + batchSize));
    }
    return batches;
  }, [messages, batchSize]);

  // 渲染每个批次
  const renderedBatches = useMemo(() => {
    return messageBatches.map((batch, batchIndex) => (
      <StaticMessageBlock
        key={`${blockId}-batch-${batchIndex}`}
        messages={batch}
        blockId={`${blockId}-batch-${batchIndex}`}
      />
    ));
  }, [messageBatches, blockId]);

  return <>{renderedBatches}</>;
}); 