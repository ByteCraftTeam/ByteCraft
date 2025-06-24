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
        return { color: "green", prefix: "🤖", bgColor: "greenBright", label: "AGENT" }
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

      {/* Tool call visualization */}
      {message.toolCall && (
        <ToolCallDisplay 
          toolCall={message.toolCall}
          isExecuting={!message.toolCall.result}
        />
      )}

      {/* Message content */}
      <Box marginLeft={2} flexDirection="column">
        <MessageContent content={message.content} />
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
      const maxLines = 1000; // 限制最大行数
      const limitedLines = lines.length > maxLines ? lines.slice(0, maxLines) : lines;
      
      return limitedLines.map((line, index) => {
        // 确保每行都有安全内容
        let safeLine = line;
        
        // 如果行是空的或只有空白字符，用空格替代
        if (!safeLine || safeLine.trim() === "" || safeLine === '""') {
          safeLine = " ";
        }
        
        // 限制单行长度以防止内存问题
        if (safeLine.length > 10000) {
          safeLine = safeLine.substring(0, 10000) + "... [截断]";
        }
        
        return { line: safeLine, index };
      });
    } catch (error) {
      // 处理分割错误
      console.warn('MessageContent: 行处理失败', error);
      return [{ line: processedContent, index: 0 }];
    }
  }, [processedContent])
  
  // 如果没有处理后的内容，显示空内容提示
  if (!processedLines) {
    return <Text color="gray">(空内容)</Text>
  }

  // 限制显示的行数以提高性能
  const displayLines = processedLines.length > 500 ? processedLines.slice(0, 500) : processedLines;

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
      {processedLines.length > 500 && (
        <Text color="yellow">... 还有 {processedLines.length - 500} 行内容被截断以提高性能</Text>
      )}
    </Box>
  )
})
