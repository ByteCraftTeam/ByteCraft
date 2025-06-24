import { Box } from "ink"
import type { Message } from "../app.js"
import { ToolAnimation } from "./tool-animation.js"
import { SafeText } from "./safe-text.js"
import { useMemo } from "react"

interface ToolCallDisplayProps {
  toolCall: {
    name: string
    args: any
    result?: any
  }
  isExecuting?: boolean
}

export function ToolCallDisplay({ toolCall, isExecuting = false }: ToolCallDisplayProps) {
  // 添加调试日志
  /*
  console.log("🔍 ToolCallDisplay render:", {
    toolName: toolCall?.name,
    args: toolCall?.args,
    result: toolCall?.result,
    isExecuting
  })
  */

  const displayData = useMemo(() => {
    // 确保 toolCall 存在
    if (!toolCall) {
      // console.log("🔍 ToolCallDisplay: toolCall is null/undefined")
      return {
        safeToolName: "unknown",
        toolIcon: "🔧",
        status: { icon: "❌", color: "red", text: "错误" },
        argsText: "",
        resultText: "",
        shouldShowArgs: false,
        shouldShowResult: false
      }
    }

    // 安全的格式化函数 - 确保永远不返回空字符串
    const formatArgs = (args: any): string => {
      if (!args || Object.keys(args).length === 0) return " " // 返回空格而不是空字符串
      
      try {
        const formatted = JSON.stringify(args, null, 2)
        return formatted || " "
      } catch {
        return String(args) || " "
      }
    }

    const formatResult = (result: any): string => {
      if (!result) return " " // 返回空格而不是空字符串
      
      try {
        if (typeof result === 'string') {
          return result || " "
        } else {
          const formatted = JSON.stringify(result, null, 2)
          return formatted || " "
        }
      } catch {
        return String(result) || " "
      }
    }

    // 确保工具名称是安全的字符串
    let safeToolName = "unknown"
    if (typeof toolCall.name === 'string' && toolCall.name.trim()) {
      safeToolName = toolCall.name.trim()
    } else if (Array.isArray(toolCall.name)) {
      safeToolName = toolCall.name.join(',') || "unknown"
    } else {
      safeToolName = String(toolCall.name || "unknown")
    }

    const toolIcon = (() => {
      const toolIcons: Record<string, string> = {
        file_manager: "📁",
        code_executor: "⚡", 
        command_exec: "💻",
        web_search: "🌐",
        weather: "🌤️",
        tavily_search: "🔍",
        default: "🔧"
      }
      return toolIcons[safeToolName] || toolIcons.default
    })()

    const status = (() => {
      if (isExecuting) {
        return { icon: "⏳", color: "yellow", text: "执行中..." }
      }
      if (toolCall.result) {
        return { icon: "✅", color: "green", text: "已完成" }
      }
      return { icon: "🔄", color: "blue", text: "准备中" }
    })()

    const argsText = formatArgs(toolCall.args)
    const resultText = formatResult(toolCall.result)

    /*
    console.log("🔍 ToolCallDisplay formatted data:", {
      safeToolName,
      argsText: `"${argsText}"`,
      resultText: `"${resultText}"`,
      argsTextLength: argsText.length,
      resultTextLength: resultText.length
    })
    */

    return {
      safeToolName,
      toolIcon,
      status,
      argsText,
      resultText,
      shouldShowArgs: argsText.trim().length > 0 && argsText !== '""' && argsText !== " ",
      shouldShowResult: resultText.trim().length > 0 && resultText !== '""' && resultText !== " "
    }
  }, [toolCall, isExecuting])

  // 如果没有有效的工具调用数据，返回一个安全的占位符
  if (!toolCall || !displayData) {
    // console.log("🔍 ToolCallDisplay: Returning safe placeholder")
    return (
      <Box flexDirection="column" marginLeft={2} marginY={1}>
        <SafeText color="red">❌ 工具调用数据无效</SafeText>
      </Box>
    )
  }

  // console.log("🔍 ToolCallDisplay: About to render with data:", displayData)

  return (
    <Box flexDirection="column" marginLeft={2} marginY={1}>
      {/* Tool Animation */}
      <ToolAnimation 
        toolName={displayData.safeToolName}
        isExecuting={isExecuting}
      />

      {/* Tool Header */}
      <Box alignItems="center">
        <SafeText color="magenta" bold>
          {displayData.toolIcon} {displayData.safeToolName}
        </SafeText>
        <SafeText color="gray"> • </SafeText>
        <SafeText color={displayData.status.color as any}>
          {displayData.status.icon} {displayData.status.text}
        </SafeText>
      </Box>

      {/* Tool Arguments */}
      {displayData.shouldShowArgs && (
        <Box marginTop={1} flexDirection="column">
          <SafeText color="cyan" dimColor>📝 参数:</SafeText>
          <Box marginLeft={2}>
            <SafeText color="gray">{displayData.argsText}</SafeText>
          </Box>
        </Box>
      )}

      {/* Tool Result */}
      {displayData.shouldShowResult && (
        <Box marginTop={1} flexDirection="column">
          <SafeText color="green" dimColor>📤 结果:</SafeText>
          <Box marginLeft={2}>
            <SafeText color="white">{displayData.resultText}</SafeText>
          </Box>
        </Box>
      )}

      {/* Execution Progress Bar (for executing tools) */}
      {isExecuting && (
        <Box marginTop={1}>
          <SafeText color="yellow">▰▰▰▰▰▰▰▰▰▰</SafeText>
        </Box>
      )}
    </Box>
  )
} 