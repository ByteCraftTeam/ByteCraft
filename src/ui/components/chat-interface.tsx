import type { Message } from "../app.js"
import { Box, Text, Static } from "ink"
import { Spinner } from "@inkjs/ui"
import { MessageBubble } from "./message-bubble.js"
import { LoadingSpinner } from "./loading-spinner.js"
import { ToolStatusManager } from "./tool-status-manager.js"
import { ToolHistory } from "./tool-history.js"
import React, { memo, useMemo, useRef, useState, useEffect } from "react"
import { AdaptiveMessageRenderer } from "./smart-message-renderer.js"
import { PerformanceMonitor, RenderCounter, MemoryMonitor } from "./performance-monitor.js"

interface ChatInterfaceProps {
  messages: Message[]
  isLoading: boolean
  activeTools?: Array<{
    id: string
    name: string
    args: any
    status: "pending" | "executing" | "completed" | "error"
    startTime: number
    endTime?: number
    result?: any
    error?: string
  }>
  showPerformanceMonitor?: boolean // 是否显示性能监控
}

// 当前消息组件 - 处理最后一条消息（可能正在流式更新）
const CurrentMessage = memo(function CurrentMessage({ 
  message 
}: { 
  message: Message | undefined 
}) {
  if (!message) return null;
  
  return <MessageBubble key={message.id} message={message} />;
});

// 加载状态组件
const LoadingIndicator = memo(function LoadingIndicator() {
  return (
    <Box marginTop={1}>
      <Spinner />
      <Text color="gray"> AI is thinking...</Text>
    </Box>
  );
});

// 优化的历史消息组件 - 使用更稳定的渲染策略
const OptimizedHistoryMessages = memo(function OptimizedHistoryMessages({ 
  messages 
}: { 
  messages: Message[] 
}) {
  // 使用useMemo缓存渲染结果，只有当消息数量或ID变化时才重新渲染
  const renderedMessages = useMemo(() => {
    return messages.map((message) => (
      <MessageBubble key={message.id} message={message} />
    ));
  }, [messages.map(m => m.id).join(',')]); // 只依赖消息ID数组，不依赖内容

  return <>{renderedMessages}</>;
});

// 智能历史消息渲染器 - 根据消息数量选择最佳策略
const SmartHistoryRenderer = memo(function SmartHistoryRenderer({ 
  messages 
}: { 
  messages: Message[] 
}) {
  // 根据消息数量选择渲染策略
  const strategy = useMemo(() => {
    const count = messages.length;
    if (count === 0) return 'empty';
    if (count <= 10) return 'static'; // 少量消息使用Static
    if (count <= 50) return 'optimized'; // 中等数量使用优化渲染
    return 'adaptive'; // 大量消息使用自适应渲染
  }, [messages.length]);

  switch (strategy) {
    case 'empty':
      return null;
    case 'static':
      return (
        <Static items={messages}>
          {(message) => (
            <MessageBubble key={message.id} message={message} />
          )}
        </Static>
      );
    case 'optimized':
      return <OptimizedHistoryMessages messages={messages} />;
    case 'adaptive':
      return (
        <AdaptiveMessageRenderer 
          messages={messages} 
          blockId="history"
        />
      );
    default:
      return null;
  }
});

export function ChatInterface({ 
  messages, 
  isLoading, 
  activeTools = [],
  showPerformanceMonitor = false 
}: ChatInterfaceProps) {
  // 使用useMemo计算当前消息，避免不必要的重新计算
  const currentMessage = useMemo(() => {
    return messages.length > 0 ? messages[messages.length - 1] : undefined;
  }, [messages]);

  // 使用useMemo计算历史消息，依赖整个messages数组以确保内容变化时重新渲染
  const historyMessages = useMemo(() => {
    return messages.slice(0, -1);
  }, [messages]); // 依赖整个messages数组，确保内容变化时重新渲染

  // 检测是否正在生成（当前消息正在流式更新）
  const isGenerating = useMemo(() => {
    return currentMessage?.streaming === true || isLoading;
  }, [currentMessage?.streaming, isLoading]);

  // 渲染计数器，用于性能监控
  const renderCount = useRef(0);
  renderCount.current += 1;

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      {/* 性能监控组件（可选） */}
      {showPerformanceMonitor && (
        <>
          <PerformanceMonitor 
            messages={messages} 
            renderCount={renderCount.current}
            isVisible={showPerformanceMonitor}
          />
          <RenderCounter 
            componentName="ChatInterface" 
            isVisible={showPerformanceMonitor}
          />
          <MemoryMonitor isVisible={showPerformanceMonitor} />
        </>
      )}

      {/* 历史消息 - 使用智能渲染策略 */}
      {historyMessages.length > 0 && (
        <SmartHistoryRenderer messages={historyMessages} />
      )}

      {/* 当前消息 - 可能正在流式更新 */}
      <CurrentMessage message={currentMessage} />

      {/* Tool Status Manager */}
      {/* <ToolStatusManager activeTools={activeTools} /> */}

      {/* Tool History */}
      {/* <ToolHistory messages={messages} /> */}

      {/* 加载状态指示器 */}
      {isLoading && <LoadingIndicator />}
    </Box>
  )
}
