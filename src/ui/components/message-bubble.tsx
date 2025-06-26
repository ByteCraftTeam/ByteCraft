import React, { memo, useMemo } from "react"
import type { Message } from "../app.js"
import { Box, Text } from "ink"
import { ToolCallDisplay } from "./tool-call-display.js"

interface MessageBubbleProps {
  message: Message
}

// 使用memo包装主组件，只有message发生变化时才重渲染
export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  // 使用useMemo缓存样式计算，避免每次渲染都重新计算
  const style = useMemo(() => {
    switch (message.type) {
      case "user":
        return { color: "cyan", prefix: "❯", bgColor: "blueBright", label: "USER" }
      case "assistant":
        return { color: "green", prefix: "❯", bgColor: "greenBright", label: "AGENT" }
      case "system":
        return { color: "yellow", prefix: "⚡", bgColor: "yellowBright", label: "SYSTEM" }
      case "tool":
        return { color: "magenta", prefix: "🔧", bgColor: "magentaBright", label: "TOOL" }
      default:
        return { color: "white", prefix: "•", bgColor: "white", label: "" }
    }
  }, [message.type])

  // 使用useMemo缓存时间戳格式化，避免每次都重新格式化
  const timestamp = useMemo(() => {
    return message.timestamp.toLocaleTimeString()
  }, [message.timestamp])

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Message header */}
      <Box>
        <Text color={style.color} bold>
          {style.prefix} {style.label}
        </Text>
        <Text color="gray" dimColor>
          {" "}
          • {timestamp}
        </Text>
      </Box>

      {/* Tool call visualization for standalone tool messages */}
      {message.toolCall && (
        <ToolCallDisplay 
          toolCall={message.toolCall}
          isExecuting={!message.toolCall.result}
          showDetailedInfo={false}
        />
      )}

      {/* Message content with embedded tool calls */}
      <Box marginLeft={2} flexDirection="column">
        {message.type === "assistant" && message.embeddedToolCalls ? (
          <MessageContentWithEmbeddedTools 
            content={message.content} 
            embeddedToolCalls={message.embeddedToolCalls}
          />
        ) : (
          <MessageContent content={message.content} />
        )}
        {message.streaming && <Text color="gray">▋</Text>}
      </Box>
    </Box>
  )
})

// 安全的JSON解析函数，防止无限循环和栈溢出
function safeJsonParse(content: string, maxDepth: number = 3): string {
  if (!content || typeof content !== 'string') return content;
  
  let result = content;
  let depth = 0;
  
  // 防止无限循环的安全解析
  while (depth < maxDepth && result.startsWith('"') && result.endsWith('"')) {
    try {
      const parsed = JSON.parse(result);
      if (typeof parsed === 'string' && parsed !== result) {
        result = parsed;
        depth++;
      } else {
        break; // 解析结果不是字符串或没有变化，停止
      }
    } catch {
      break; // 解析失败，停止
    }
  }
  
  return result;
}

// 使用memo包装MessageContent组件，只有content变化时才重渲染
const MessageContent = memo(function MessageContent({ content }: { content: string }) {
  // 使用useMemo缓存内容处理逻辑，避免每次都重新处理
  const processedContent = useMemo(() => {
    // 早期退出检查
    if (!content) return " ";
    if (typeof content !== 'string') return String(content) || " ";
    
    // 限制内容长度，防止过长的字符串导致渲染错误
    const maxContentLength = 10000; // 限制最大内容长度
    if (content.length > maxContentLength) {
      return content.substring(0, maxContentLength) + "... [内容过长，已截断]";
    }
    
    // 使用安全的JSON解析，限制递归深度
    const processed = safeJsonParse(content, 3);
    
    // 确保返回值不为空
    return processed || " ";
  }, [content])
  
  // 使用useMemo缓存行数组的分割和处理
  const processedLines = useMemo(() => {
    // 确保内容不为空
    if (!processedContent || processedContent.trim() === "" || processedContent === '""') {
      return null;
    }
    
    try {
      // 限制行数以防止内存过度使用
      const lines = processedContent.split("\n");
      const maxLines = 500; // 减少最大行数限制
      const limitedLines = lines.length > maxLines ? lines.slice(0, maxLines) : lines;
      
      return limitedLines.map((line, index) => {
        // 确保每行都有安全内容
        let safeLine = line;
        
        // 如果行是空的或只有空白字符，用空格替代
        if (!safeLine || safeLine.trim() === "" || safeLine === '""') {
          safeLine = " ";
        }
        
        // 限制单行长度以防止内存问题
        if (safeLine.length > 2000) { // 减少单行长度限制
          safeLine = safeLine.substring(0, 2000) + "... [截断]";
        }
        
        return { line: safeLine, index };
      });
    } catch (error) {
      // 处理分割错误
      console.warn('MessageContent: 行处理失败', error);
      return [{ line: processedContent.substring(0, 1000), index: 0 }];
    }
  }, [processedContent])
  
  // 如果没有处理后的内容，显示空内容提示
  if (!processedLines) {
    return <Text color="gray">(空内容)</Text>
  }

  // 限制显示的行数以提高性能
  const displayLines = processedLines.length > 200 ? processedLines.slice(0, 200) : processedLines;

  return (
    <Box flexDirection="column">
      {displayLines.map(({ line, index }) => {
        if (line.startsWith("```")) {
          return (
            <Text key={index} color="gray" backgroundColor="black">
              {line}
            </Text>
          )
        }

        if (
          line.trim().startsWith("function") ||
          line.trim().startsWith("const") ||
          line.trim().startsWith("let") ||
          line.trim().startsWith("var")
        ) {
          return (
            <Text key={index} color="blue" backgroundColor="black">
              {line}
            </Text>
          )
        }

        return <Text key={index}>{line}</Text>
      })}
      {processedLines.length > 200 && (
        <Text color="yellow">... 还有 {processedLines.length - 200} 行内容被截断以提高性能</Text>
      )}
    </Box>
  )
})

// 处理包含嵌入工具调用的消息内容
const MessageContentWithEmbeddedTools = memo(function MessageContentWithEmbeddedTools({ 
  content, 
  embeddedToolCalls 
}: { 
  content: string
  embeddedToolCalls: Array<{
    id: string
    name: string
    args: any
    result?: any
    timestamp: Date
  }>
}) {
  // 使用useMemo缓存内容处理逻辑
  const processedContent = useMemo(() => {
    if (!content) return " ";
    if (typeof content !== 'string') return String(content) || " ";
    
    // 限制内容长度，防止过长的字符串导致渲染错误
    const maxContentLength = 10000;
    if (content.length > maxContentLength) {
      return content.substring(0, maxContentLength) + "... [内容过长，已截断]";
    }
    
    const processed = safeJsonParse(content, 3);
    return processed || " ";
  }, [content])
  
  // 将内容按行分割，并在适当位置插入工具调用
  const contentWithTools = useMemo(() => {
    if (!processedContent || processedContent.trim() === "" || processedContent === '""') {
      return embeddedToolCalls.map((toolCall, index) => ({
        type: 'tool' as const,
        toolCall,
        index
      }));
    }
    
    try {
      const lines = processedContent.split("\n");
      const maxLines = 500; // 减少最大行数限制
      const limitedLines = lines.length > maxLines ? lines.slice(0, maxLines) : lines;
      
      // 创建混合内容：文本行和工具调用
      const mixedContent = [];
      let lineIndex = 0;
      let toolIndex = 0;
      
      // 按工具调用的时间戳顺序插入
      const sortedToolCalls = [...embeddedToolCalls].sort((a, b) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      );
      
      // 计算每个工具调用应该插入的位置
      // 让工具调用在文本内容的早期阶段显示，实现"工具调用块先输出"的效果
      const toolInsertPositions = sortedToolCalls.map((_, index) => {
        // 在文本的前1/4部分插入工具调用，确保工具调用优先显示
        const insertAt = Math.floor(limitedLines.length * (index + 1) / (sortedToolCalls.length + 3));
        return Math.min(insertAt, Math.floor(limitedLines.length * 0.25)); // 限制在前25%的位置
      });
      
      for (let i = 0; i < limitedLines.length; i++) {
        // 检查是否应该在这个位置插入工具调用
        while (toolIndex < sortedToolCalls.length && i >= toolInsertPositions[toolIndex]) {
          mixedContent.push({
            type: 'tool' as const,
            toolCall: sortedToolCalls[toolIndex],
            index: toolIndex++
          });
        }
        
        // 添加文本行
        const line = limitedLines[i];
        let safeLine = line;
        
        if (!safeLine || safeLine.trim() === "" || safeLine === '""') {
          safeLine = " ";
        }
        
        if (safeLine.length > 2000) { // 减少单行长度限制
          safeLine = safeLine.substring(0, 2000) + "... [截断]";
        }
        
        mixedContent.push({
          type: 'text' as const,
          content: safeLine,
          index: lineIndex++
        });
      }
      
      // 如果还有未插入的工具调用，添加到末尾
      while (toolIndex < sortedToolCalls.length) {
        mixedContent.push({
          type: 'tool' as const,
          toolCall: sortedToolCalls[toolIndex],
          index: toolIndex++
        });
      }
      
      return mixedContent;
    } catch (error) {
      console.warn('MessageContentWithEmbeddedTools: 内容处理失败', error);
      return embeddedToolCalls.map((toolCall, index) => ({
        type: 'tool' as const,
        toolCall,
        index
      }));
    }
  }, [processedContent, embeddedToolCalls])
  
  // 限制显示的内容数量以提高性能
  const displayContent = contentWithTools.length > 200 ? contentWithTools.slice(0, 200) : contentWithTools;

  return (
    <Box flexDirection="column">
      {displayContent.map((item) => {
        if (item.type === 'text') {
          const line = item.content;
          
          if (line.startsWith("```")) {
            return (
              <Text key={`text-${item.index}`} color="gray" backgroundColor="black">
                {line}
              </Text>
            )
          }

          if (
            line.trim().startsWith("function") ||
            line.trim().startsWith("const") ||
            line.trim().startsWith("let") ||
            line.trim().startsWith("var")
          ) {
            return (
              <Text key={`text-${item.index}`} color="blue" backgroundColor="black">
                {line}
              </Text>
            )
          }

          return <Text key={`text-${item.index}`}>{line}</Text>
        } else {
          // 工具调用
          return (
            <Box key={`tool-${item.index}`} marginY={1} flexDirection="column">
              <ToolCallDisplay 
                toolCall={item.toolCall}
                isExecuting={!item.toolCall.result}
                showDetailedInfo={false}
              />
            </Box>
          )
        }
      })}
      {contentWithTools.length > 200 && (
        <Text color="yellow">... 还有 {contentWithTools.length - 200} 项内容被截断以提高性能</Text>
      )}
    </Box>
  )
})
