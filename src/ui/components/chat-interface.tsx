import type { Message } from "../app.js"
import { Box, Text, Static } from "ink"
import { MessageBubble } from "./message-bubble.js"
import { LoadingSpinner } from "./loading-spinner.js"
import { ToolStatusManager } from "./tool-status-manager.js"
import { ToolHistory } from "./tool-history.js"
import React, { memo, useMemo, useRef } from "react"
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
      <LoadingSpinner />
      <Text color="gray"> AI is thinking...</Text>
    </Box>
  );
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

  // 生成唯一的块ID
  const historyBlockId = useMemo(() => {
    return `history-${messages.length}-${Date.now()}`;
  }, [messages.length]);

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

      {/* 历史消息 - 使用Static块优化渲染性能 */}
      {historyMessages.length > 0 && (
        <Static items={historyMessages}>
          {(message) => (
            <MessageBubble key={message.id} message={message} />
          )}
        </Static>
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
