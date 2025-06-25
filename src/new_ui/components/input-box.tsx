"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Box, Text, useInput } from "ink"
import { AVAILABLE_MODELS } from "../app.js"

interface InputBoxProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  isLoading: boolean
  isFocused?: boolean  // 新增：是否处于输入焦点模式
  onFocusChange?: (focused: boolean) => void  // 新增：焦点变化回调
}

// 性能监控组件
const PerformanceMonitor = ({ componentName }: { componentName: string }) => {
  const renderCount = useRef(0)
  const lastRender = useRef(Date.now())
  
  renderCount.current++
  const now = Date.now()
  const timeSinceLastRender = now - lastRender.current
  lastRender.current = now
  
  // 只在渲染频率过高时记录
  if (timeSinceLastRender < 100 && renderCount.current > 10) {
    // console.log(`🐌 ${componentName} 高频渲染: ${renderCount.current}次, 间隔: ${timeSinceLastRender}ms`)
  }
  
  return null
}

const InputBoxComponent = ({ 
  value, 
  onChange, 
  onSubmit, 
  isLoading,
  isFocused = true,
  onFocusChange 
}: InputBoxProps) => {
  const [cursorVisible, setCursorVisible] = useState(true)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const originalValue = useRef("")

  // 闪烁光标效果 - 只在焦点模式下启用，减少更新频率
  useEffect(() => {
    if (!isFocused) {
      setCursorVisible(false)
      return
    }
    
    // 减少闪烁频率，从500ms增加到800ms
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev)
    }, 800)
    return () => clearInterval(interval)
  }, [isFocused])

  // 防止不必要的重新渲染 - 当输入值变化时不要重置光标状态
  const stableCursorVisible = useMemo(() => {
    return isFocused ? cursorVisible : false
  }, [isFocused, cursorVisible])

  // 使用 useMemo 缓存命令建议
  const getCommandSuggestions = useCallback((input: string) => {
    if (!input.startsWith("/")) return []
    const commands = ["/new", "/model", "/load", "/help", "/exit"]
    return commands.filter(cmd => cmd.startsWith(input))
  }, [])

  const getModelSuggestions = useCallback((input: string) => {
    if (!input.startsWith("/model")) return []
    const modelPrefix = input.slice(7)
    return AVAILABLE_MODELS.filter(model =>
      model.toLowerCase().startsWith(modelPrefix.toLowerCase())
    ).map(model => `/model ${model}`)
  }, [])

  const getSuggestions = useCallback((input: string) => {
    const commandSuggestions = getCommandSuggestions(input)
    const modelSuggestions = getModelSuggestions(input)
    return [...commandSuggestions, ...modelSuggestions]
  }, [getCommandSuggestions, getModelSuggestions])
  
  // 缓存计算结果
  const suggestions = useMemo(() => getSuggestions(value), [value, getSuggestions])
  const isSlashCommand = useMemo(() => value.startsWith("/"), [value])

  // 自动控制 showSuggestions
  useEffect(() => {
    if (value.startsWith("/") && suggestions.length > 0) {
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
      setSuggestionIndex(0)
    }
  }, [value, suggestions])

  useInput((input, key) => {
    if (isLoading) return

    // 全局快捷键 - 优先处理，快速返回
    if (key.ctrl && input === "c") {
      process.exit(0)
    }

    // 焦点模式切换键 - 快速处理
    if (key.tab && !isFocused) {
      onFocusChange?.(true)
      return
    }

    if (key.escape && isFocused) {
      onFocusChange?.(false)
      setShowSuggestions(false)
      setSuggestionIndex(0)
      return
    }

    // 非焦点模式下，快速跳过所有其他处理
    if (!isFocused) {
      return
    }

    // 以下代码只在焦点模式下执行，减少性能开销

    // Tab 键在焦点模式下用于自动完成
    if (key.tab) {
      if (suggestions.length > 0) {
        const selectedSuggestion = suggestions[suggestionIndex]
        onChange(selectedSuggestion)
        setShowSuggestions(false)
        setSuggestionIndex(0)
      }
      return
    }

    // 箭头键处理 - 只在焦点模式下执行
    if (key.upArrow) {
      if (showSuggestions && suggestions.length > 0) {
        setSuggestionIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1)
      } else if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        onChange(commandHistory[commandHistory.length - 1 - newIndex])
      }
      return
    }

    if (key.downArrow) {
      if (showSuggestions && suggestions.length > 0) {
        setSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : 0)
      } else if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        onChange(commandHistory[commandHistory.length - 1 - newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        onChange(originalValue.current)
      }
      return
    }

    // 回车键处理 - 始终发送消息，不管是否有建议
    if (key.return) {
      if (value.trim()) {
        setCommandHistory(prev => [...prev, value])
        setHistoryIndex(-1)
        originalValue.current = ""
      }
      onSubmit(value)
      onChange("")
      setShowSuggestions(false)
      setSuggestionIndex(0)
      return
    }

    // 删除键处理
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1))
      return
    }

    // 普通字符输入
    if (input) {
      onChange(value + input)
    }
  })

  return (
    <Box flexDirection="column">
      {/* 性能监控 */}
      <PerformanceMonitor componentName="InputBox" />
      
      {/* 主内容 */}
    <Box flexDirection="column" borderStyle="round" borderColor={isFocused ? "blue" : "gray"} padding={1}>
      {/* Focus mode indicator */}
      {!isFocused && (
        <Box marginBottom={1}>
          <Text color="yellow">
            🔍 浏览模式 • 按 Tab 键激活输入 • ↑/↓ 滚动聊天历史
          </Text>
        </Box>
      )}
      
      {/* Command hint */}
      {isFocused && isSlashCommand && !showSuggestions && (
        <Box marginBottom={1}>
          <Text color="yellow">💡 Commands: /new /model /load /help /exit</Text>
        </Box>
      )}
      
      {/* Suggestions */}
      {isFocused && showSuggestions && suggestions.length > 0 && (
        <Box marginBottom={1} flexDirection="column">
          <Text color="cyan" bold>Suggestions:</Text>
          {suggestions.map((suggestion, index) => (
            <Box key={suggestion}>
              <Text color={index === suggestionIndex ? "green" : "gray"}>
                {index === suggestionIndex ? "▶ " : "  "}
              </Text>
              <Text color={index === suggestionIndex ? "green" : "white"}>
                {suggestion}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      
      {/* Input line */}
      <Box>
        <Text color={isFocused ? "cyan" : "gray"} bold>
          {isLoading ? "⏳" : isFocused ? "❯" : "○"}
        </Text>
        <Text> </Text>
        <Text color={isFocused && isSlashCommand ? "yellow" : isFocused ? "white" : "gray"}>
          {value}
        </Text>
        {!isLoading && stableCursorVisible && <Text color="cyan">▋</Text>}
      </Box>
      
      {/* Status line */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {isLoading ? (
            "Processing..."
          ) : isFocused ? (
            "输入消息 • ↑/↓ 历史记录滚动 • Tab 自动完成 • Esc 退出输入模式 • 使用 / 查看可用快捷命令"
          ) : (
            "Tab 激活输入 • ↑/↓ 滚动历史 • Ctrl+C 退出"
          )}
        </Text>
      </Box>
    </Box>
    </Box>
  )
}

// 使用React.memo优化渲染性能，只在props真正变化时重新渲染
export const InputBox = React.memo(InputBoxComponent, (prevProps, nextProps) => {
  // 自定义比较函数，避免因为函数引用变化导致的重渲染
  return (
    prevProps.value === nextProps.value &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.isFocused === nextProps.isFocused &&
    // onChange, onSubmit, onFocusChange 是函数，比较引用
    prevProps.onChange === nextProps.onChange &&
    prevProps.onSubmit === nextProps.onSubmit &&
    prevProps.onFocusChange === nextProps.onFocusChange
  )
})
