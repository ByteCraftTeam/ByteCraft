import type { Message } from "../app.js"
import { Box, Text } from "ink"
import { MessageBubble } from "./message-bubble.js"
import { LoadingSpinner } from "./loading-spinner.js"
import { ToolStatusManager } from "./tool-status-manager.js"
import { ToolHistory } from "./tool-history.js"

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
}

export function ChatInterface({ messages, isLoading, activeTools = [] }: ChatInterfaceProps) {
  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {/* Tool Status Manager */}
      <ToolStatusManager activeTools={activeTools} />

      {/* Tool History */}
      <ToolHistory messages={messages} />

      {isLoading && (
        <Box marginTop={1}>
          <LoadingSpinner />
          <Text color="gray"> AI is thinking...</Text>
        </Box>
      )}
    </Box>
  )
}
