"use client"

import { useState, useEffect } from "react"
import { Box, Text } from "ink"

interface StatusBarProps {
  model: string
  sessionId: string
  messageCount: number
}

export function StatusBar({ model, sessionId, messageCount }: StatusBarProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <Box justifyContent="space-between" paddingX={2} paddingY={1} borderStyle="round" borderColor="green">
      <Box>
        <Text color="green" bold>
          ByteCraft - AI Coding Agent
        </Text>
        <Text color="gray"> • Model: </Text>
        <Text color="cyan">{model}</Text>
      </Box>

      <Box>
        <Text color="gray">Session: </Text>
        <Text color="yellow">{sessionId.length > 8 ? `${sessionId.slice(0, 8)}...` : sessionId}</Text>
        <Text color="gray"> • Messages: </Text>
        <Text color="magenta">{messageCount}</Text>
        <Text color="gray"> • </Text>
        <Text color="blue">{currentTime.toLocaleTimeString()}</Text>
      </Box>
    </Box>
  )
}
