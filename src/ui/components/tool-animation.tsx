import { Box } from "ink"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { SafeText } from "./safe-text.js"

interface ToolAnimationProps {
  toolName: string
  isExecuting: boolean
  duration?: number
}

export function ToolAnimation({ toolName, isExecuting }: ToolAnimationProps) {
  // 确保工具名称是安全的字符串，使用 useMemo 防止重复计算
  const safeToolName = useMemo(() => {
    if (!toolName) return "unknown"
    if (typeof toolName === 'string' && toolName.trim()) {
      const trimmed = toolName.trim();
      return trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
    }
    if (Array.isArray(toolName)) return toolName.join(',') || "unknown"
    return String(toolName) || "unknown"
  }, [toolName])

  if (!safeToolName || safeToolName === "unknown") {
    return null
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Box alignItems="center">
        <SafeText color="blue" bold>🛠️ {safeToolName}</SafeText>
        <SafeText color="gray"> • </SafeText>
        <SafeText color="yellow">{isExecuting ? "🔄 执行中" : "✅ 完成"}</SafeText>
      </Box>
    </Box>
  )
} 