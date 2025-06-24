"use client"

import React, { useState, useRef, useEffect } from "react"
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

export function InputBox({ 
  value, 
  onChange, 
  onSubmit, 
  isLoading,
  isFocused = true,
  onFocusChange 
}: InputBoxProps) {
  const [cursorVisible, setCursorVisible] = useState(true)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const originalValue = useRef("")

  // Blinking cursor effect
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Command suggestions
  const getCommandSuggestions = (input: string) => {
    if (!input.startsWith("/")) return []
    const commands = ["/new", "/model", "/load", "/help", "/exit"]
    return commands.filter(cmd => cmd.startsWith(input))
  }

  // Model suggestions for /model command
  const getModelSuggestions = (input: string) => {
    if (!input.startsWith("/model ")) return []
    const modelPrefix = input.slice(7)
    return AVAILABLE_MODELS.filter(model =>
      model.toLowerCase().startsWith(modelPrefix.toLowerCase())
    ).map(model => `/model ${model}`)
  }

  const getSuggestions = (input: string) => {
    const commandSuggestions = getCommandSuggestions(input)
    const modelSuggestions = getModelSuggestions(input)
    return [...commandSuggestions, ...modelSuggestions]
  }

  // 自动控制 showSuggestions
  useEffect(() => {
    const suggestions = getSuggestions(value)
    if (value.startsWith("/") && suggestions.length > 0) {
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
      setSuggestionIndex(0)
    }
  }, [value])

  useInput((input, key) => {
    if (isLoading) return

    // 全局快捷键 - 无论是否处于焦点模式都能使用
    if (key.ctrl && input === "c") {
      process.exit(0)
    }

    // Tab 键：切换焦点模式
    if (key.tab) {
      if (!isFocused) {
        // 如果当前不在焦点模式，Tab键激活输入焦点
        onFocusChange?.(true)
        return
      } else {
        // 如果在焦点模式，Tab键用于自动完成
        const suggestions = getSuggestions(value)
        if (suggestions.length > 0) {
          const selectedSuggestion = suggestions[suggestionIndex]
          onChange(selectedSuggestion)
          setShowSuggestions(false)
          setSuggestionIndex(0)
        }
        return
      }
    }

    // Escape 键：退出输入焦点模式
    if (key.escape) {
      if (isFocused) {
        onFocusChange?.(false)
        setShowSuggestions(false)
        setSuggestionIndex(0)
        return
      }
    }

    // 只有在焦点模式下才处理其他输入
    if (!isFocused) {
      return
    }

    // Handle arrow keys for history navigation (仅在焦点模式)
    if (key.upArrow) {
      if (showSuggestions) {
        const suggestions = getSuggestions(value)
        if (suggestions.length > 0) {
          setSuggestionIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1)
        }
      } else {
        if (historyIndex < commandHistory.length - 1) {
          const newIndex = historyIndex + 1
          setHistoryIndex(newIndex)
          onChange(commandHistory[commandHistory.length - 1 - newIndex])
        }
      }
      return
    }

    if (key.downArrow) {
      if (showSuggestions) {
        const suggestions = getSuggestions(value)
        if (suggestions.length > 0) {
          setSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : 0)
        }
      } else {
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1
          setHistoryIndex(newIndex)
          onChange(commandHistory[commandHistory.length - 1 - newIndex])
        } else if (historyIndex === 0) {
          setHistoryIndex(-1)
          onChange(originalValue.current)
        }
      }
      return
    }

    if (key.return) {
      if (showSuggestions && getSuggestions(value).length > 0) {
        const suggestions = getSuggestions(value)
        const selectedSuggestion = suggestions[suggestionIndex]
        onChange(selectedSuggestion)
        setShowSuggestions(false)
        setSuggestionIndex(0)
      } else {
        if (value.trim()) {
          setCommandHistory(prev => [...prev, value])
          setHistoryIndex(-1)
          originalValue.current = ""
        }
        onSubmit(value)
        onChange("")
        setShowSuggestions(false)
        setSuggestionIndex(0)
      }
      return
    }

    if (key.backspace || key.delete) {
      const newValue = value.slice(0, -1)
      onChange(newValue)
      return
    }

    if (input) {
      const newValue = value + input
      onChange(newValue)
      // 用户开始输入时自动进入焦点模式
      if (!isFocused) {
        onFocusChange?.(true)
      }
    }
  })

  const isSlashCommand = value.startsWith("/")
  const suggestions = getSuggestions(value)

  return (
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
        {isFocused && !isLoading && cursorVisible && <Text color="cyan">▋</Text>}
      </Box>
      
      {/* Status line */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {isLoading ? (
            "Processing..."
          ) : isFocused ? (
            "输入消息 • ↑/↓ 历史记录 • Tab 自动完成 • Esc 退出输入模式"
          ) : (
            "Tab 激活输入 • ↑/↓ 滚动历史 • Ctrl+C 退出"
          )}
        </Text>
      </Box>
    </Box>
  )
}
