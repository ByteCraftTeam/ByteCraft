import { Box, Text } from "ink"
import { useState, useEffect } from "react"

interface ToolStatus {
  id: string
  name: string
  args: any
  status: "pending" | "executing" | "completed" | "error"
  startTime: number
  endTime?: number
  result?: any
  error?: string
}

interface ToolStatusManagerProps {
  activeTools: ToolStatus[]
}

export function ToolStatusManager({ activeTools }: ToolStatusManagerProps) {
  const [currentTime, setCurrentTime] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: ToolStatus["status"]) => {
    switch (status) {
      case "pending": return "⏳"
      case "executing": return "🔄"
      case "completed": return "✅"
      case "error": return "❌"
      default: return "•"
    }
  }

  const getStatusColor = (status: ToolStatus["status"]) => {
    switch (status) {
      case "pending": return "yellow"
      case "executing": return "blue"
      case "completed": return "green"
      case "error": return "red"
      default: return "gray"
    }
  }

  const getDuration = (tool: ToolStatus) => {
    const endTime = tool.endTime || currentTime
    const duration = Math.floor((endTime - tool.startTime) / 1000)
    return `${duration}s`
  }

  if (activeTools.length === 0) return null

  return (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="blue" padding={1}>
      <Text color="blue" bold>🛠️ 工具执行状态</Text>
      {activeTools.map((tool) => (
        <Box key={tool.id} marginTop={1} flexDirection="column">
          <Box alignItems="center">
            <Text color={getStatusColor(tool.status) as any}>
              {getStatusIcon(tool.status)} {tool.name}
            </Text>
            <Text color="gray"> • </Text>
            <Text color="gray">{getDuration(tool)}</Text>
            {tool.status === "executing" && (
              <>
                <Text color="gray"> • </Text>
                <Text color="yellow">执行中...</Text>
              </>
            )}
          </Box>
          {tool.error && (
            <Box marginLeft={2} marginTop={1}>
              <Text color="red">❌ 错误: {tool.error}</Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
} 