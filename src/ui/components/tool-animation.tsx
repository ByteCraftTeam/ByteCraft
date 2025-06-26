import { Box } from "ink"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { SafeText } from "./safe-text.js"

interface ToolAnimationProps {
  toolName: string
  isExecuting: boolean
  duration?: number
}

export function ToolAnimation({ toolName, isExecuting, duration = 2000 }: ToolAnimationProps) {
  const [progress, setProgress] = useState(0)
  const [dots, setDots] = useState("")
  const intervalRefs = useRef<{
    progress?: NodeJS.Timeout
    dots?: NodeJS.Timeout
  }>({})
  const isMountedRef = useRef(true)
  const lastUpdateRef = useRef<number>(0)

  // 确保工具名称是安全的字符串，使用 useMemo 防止重复计算
  const safeToolName = useMemo(() => {
    if (!toolName) return "unknown"
    if (typeof toolName === 'string' && toolName.trim()) {
      // 限制工具名称长度以防止显示问题
      const trimmed = toolName.trim();
      return trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
    }
    if (Array.isArray(toolName)) return toolName.join(',') || "unknown"
    return String(toolName) || "unknown"
  }, [toolName])

  // 清理所有定时器的函数
  const clearIntervals = useCallback(() => {
    if (intervalRefs.current.progress) {
      clearInterval(intervalRefs.current.progress)
      intervalRefs.current.progress = undefined
    }
    if (intervalRefs.current.dots) {
      clearInterval(intervalRefs.current.dots)
      intervalRefs.current.dots = undefined
    }
  }, [])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      clearIntervals()
    }
  }, [clearIntervals])

  // 进度条动画 - 使用节流避免过度更新
  useEffect(() => {
    if (!isMountedRef.current) return
    
    clearIntervals()
    
    if (!isExecuting) {
      setProgress(100)
      setDots("")
      return
    }

    const startTime = Date.now()
    intervalRefs.current.progress = setInterval(() => {
      if (!isMountedRef.current) {
        clearIntervals()
        return
      }
      
      const now = Date.now()
      // 节流：限制更新频率
      if (now - lastUpdateRef.current < 300) return
      lastUpdateRef.current = now
      
      const elapsed = now - startTime
      const newProgress = Math.min((elapsed / duration) * 100, 100)
      setProgress(newProgress)
      
      if (newProgress >= 100) {
        clearIntervals()
      }
    }, 400) // 进一步降低更新频率

    return clearIntervals
  }, [isExecuting, duration, clearIntervals])

  // 点点动画 - 减少状态变化频率
  useEffect(() => {
    if (!isMountedRef.current || !isExecuting) {
      setDots("")
      return
    }

    intervalRefs.current.dots = setInterval(() => {
      if (!isMountedRef.current) return
      
      setDots(prev => {
        // 使用简单的循环状态
        switch (prev) {
          case "": return "."
          case ".": return ".."
          case "..": return "..."
          case "...": return ""
          default: return ""
        }
      })
    }, 1200) // 进一步降低更新频率

    return () => {
      if (intervalRefs.current.dots) {
        clearInterval(intervalRefs.current.dots)
      }
    }
  }, [isExecuting])

  // 计算显示内容，使用 useMemo 防止频繁重计算
  const displayContent = useMemo(() => {
    const statusText = !isExecuting ? "✅ 完成" : `🔄 执行中${dots}`
    
    const width = 16 // 减少进度条宽度以提高性能
    const filled = Math.floor((progress / 100) * width)
    const empty = width - filled
    const progressBar = "█".repeat(filled) + "░".repeat(empty)
    
    return { statusText, progressBar, progressPercent: Math.round(progress) }
  }, [isExecuting, dots, progress])

  // 如果工具名称为空或无效，不渲染
  if (!safeToolName || safeToolName === "unknown") {
    return null
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Box alignItems="center">
        <SafeText color="blue" bold>🛠️ {safeToolName}</SafeText>
        <SafeText color="gray"> • </SafeText>
        <SafeText color="yellow">{displayContent.statusText}</SafeText>
      </Box>
      
      {isExecuting && (
        <Box marginTop={1}>
          <SafeText color="cyan">[{displayContent.progressBar}] {displayContent.progressPercent}%</SafeText>
        </Box>
      )}
    </Box>
  )
} 