import { Box, Text } from "ink"
import type { Message } from "../app.js"

interface ToolHistoryProps {
  messages: Message[]
}

export function ToolHistory({ messages }: ToolHistoryProps) {
  const toolMessages = messages.filter(msg => msg.type === "tool" && msg.toolCall?.result)

  if (toolMessages.length === 0) return null

  const getToolIcon = (toolName: string): string => {
    const toolIcons: Record<string, string> = {
      file_manager: "📁",
      code_executor: "⚡",
      command_exec: "💻",
      web_search: "🌐",
      weather: "🌤️",
      tavily_search: "🔍",
      default: "🔧"
    }
    return toolIcons[toolName] || toolIcons.default
  }

  const formatResult = (result: any): string => {
    if (!result) return ""
    if (typeof result === "string") {
      return result.length > 100 ? result.substring(0, 100) + "..." : result
    }
    if (typeof result === "object") {
      try {
        const str = JSON.stringify(result)
        return str.length > 100 ? str.substring(0, 100) + "..." : str
      } catch {
        return String(result)
      }
    }
    return String(result)
  }

  return (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="green" padding={1}>
      <Text color="green" bold>📋 工具调用历史</Text>
      {toolMessages.map((message, index) => {
        const toolCall = message.toolCall!
        const toolIcon = getToolIcon(toolCall.name)
        const resultText = formatResult(toolCall.result)
        const timestamp = message.timestamp.toLocaleTimeString()

        return (
          <Box key={message.id} marginTop={1} flexDirection="column">
            <Box alignItems="center">
              <Text color="green" bold>
                {toolIcon} {toolCall.name}
              </Text>
              <Text color="gray"> • </Text>
              <Text color="gray">{timestamp}</Text>
            </Box>
            {resultText && (
              <Box marginLeft={2} marginTop={1}>
                <Text color="white" dimColor>{resultText}</Text>
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
} 