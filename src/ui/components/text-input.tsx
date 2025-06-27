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
  currentSession?: string
  currentModel?: string
  getAvailableSessions?: (page?: number, pageSize?: number) => Promise<{sessions: Array<{sessionId: string, title: string}>, total: number}>
}

export function InputBox({ 
  value, 
  onChange, 
  onSubmit, 
  isLoading,
  isFocused = true,
  onFocusChange,
  currentSession = "未知会话",
  currentModel = "未选择模型",
  getAvailableSessions
}: InputBoxProps) {
  const [cursorVisible, setCursorVisible] = useState(true)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [availableSessions, setAvailableSessions] = useState<Array<{sessionId: string, title: string}>>([])
  const [sessionPage, setSessionPage] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)
  const originalValue = useRef("")

  const SESSIONS_PER_PAGE = 10

  // Blinking cursor effect
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // 加载指定页的session
  const loadSessionPage = async (page: number) => {
    if (!getAvailableSessions) return
    
    try {
      const result = await getAvailableSessions(page, SESSIONS_PER_PAGE)
      setAvailableSessions(result.sessions)
      setTotalSessions(result.total)
      setSessionPage(page)
    } catch (error) {
      console.error("Failed to get available sessions:", error)
      setAvailableSessions([])
      setTotalSessions(0)
    }
  }

  // Command suggestions
  const getCommandSuggestions = (input: string) => {
    if (!input.startsWith("/")) return []
    const commands = ["/new", "/model", "/load", "/help", "/exit"]
    return commands.filter(cmd => cmd.startsWith(input))
  }

  // Model suggestions for /model command
  const getModelSuggestions = (input: string) => {
    if (!input.startsWith("/model")) return []
    const modelPrefix = input.slice(7)
    return AVAILABLE_MODELS.filter(model =>
      model.toLowerCase().startsWith(modelPrefix.toLowerCase())
    ).map(model => `/model ${model}`)
  }

  // Session suggestions for /load command
  const getSessionSuggestions = (input: string) => {
    if (!input.startsWith("/load")) return []
    
    // 如果只是"/load"，显示当前页的所有sessions
    if (input === "/load") {
      return availableSessions.map(session => `/load ${session.sessionId}`)
    }
    
    // 如果是"/load "开头，显示当前页或进行搜索
    if (input.startsWith("/load")) {
      const sessionPrefix = input.slice(6).trim() // "/load " = 6 characters
      if (!sessionPrefix) {
        // 没有搜索词，显示当前页所有sessions
        return availableSessions.map(session => `/load ${session.sessionId}`)
      }
      
      // 有搜索词，在当前页中过滤
      return availableSessions
        .filter(session => 
          session.sessionId.toLowerCase().includes(sessionPrefix.toLowerCase()) ||
          session.title.toLowerCase().includes(sessionPrefix.toLowerCase())
        )
        .map(session => `/load ${session.sessionId}`)
    }
    
    return []
  }

  const getSuggestions = (input: string) => {
    const commandSuggestions = getCommandSuggestions(input)
    const modelSuggestions = getModelSuggestions(input)
    const sessionSuggestions = getSessionSuggestions(input)
    return [...commandSuggestions, ...modelSuggestions, ...sessionSuggestions]
  }

  // 当用户输入/load时，获取可用session列表
  useEffect(() => {
    if (value.startsWith("/load") && getAvailableSessions) {
      loadSessionPage(0) // 总是从第一页开始
    }
  }, [value, getAvailableSessions])

  // 重置分页当input改变时
  useEffect(() => {
    if (value.startsWith("/load")) {
      setSessionPage(0)
      setSuggestionIndex(0)
    } else {
      // 清空session相关状态
      setAvailableSessions([])
      setTotalSessions(0)
      setSessionPage(0)
    }
  }, [value])

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
        const isSessionSuggestion = value.startsWith("/load")
        
        if (suggestionIndex > 0) {
          setSuggestionIndex(prev => prev - 1)
        } else if (isSessionSuggestion && sessionPage > 0) {
          const newPage = sessionPage - 1
          loadSessionPage(newPage).then(() => {
            setTimeout(() => {
              setSuggestionIndex(Math.min(SESSIONS_PER_PAGE - 1, availableSessions.length - 1))
            }, 0)
          })
        } else {
          setSuggestionIndex(suggestions.length - 1)
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
        const isSessionSuggestion = value.startsWith("/load")
        const maxPages = Math.ceil(totalSessions / SESSIONS_PER_PAGE)
        
        if (suggestionIndex < suggestions.length - 1) {
          setSuggestionIndex(prev => prev + 1)
        } else if (isSessionSuggestion && sessionPage < maxPages - 1) {
          const newPage = sessionPage + 1
          loadSessionPage(newPage).then(() => {
            setTimeout(() => {
              setSuggestionIndex(0)
            }, 0)
          })
        } else {
          setSuggestionIndex(0)
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
            浏览模式 • 按 Tab 键激活输入 • ↑/↓ 滚动聊天历史
          </Text>
        </Box>
      )}
      
      {/* Command hint */}
      {isFocused && isSlashCommand && !showSuggestions && suggestions.length === 0 && (
        <Box marginBottom={1}>
          <Text color="yellow">💡 Commands: /new /model /load /help /exit</Text>
        </Box>
      )}
      
      {/* Suggestions */}
      {isFocused && showSuggestions && suggestions.length > 0 && (
        <Box marginBottom={1} flexDirection="column">
          <Box justifyContent="space-between" alignItems="center">
            <Text color="cyan" bold>Suggestions:</Text>
            {value.startsWith("/load") && totalSessions > SESSIONS_PER_PAGE && (
              <Text color="gray" dimColor>
                第 {sessionPage + 1}/{Math.ceil(totalSessions / SESSIONS_PER_PAGE)} 页 ({totalSessions} 个会话)
              </Text>
            )}
          </Box>
          {suggestions.map((suggestion, index) => {
            // 检查是否是session建议，如果是则显示额外信息
            const isSessionSuggestion = suggestion.startsWith("/load ")
            const sessionId = isSessionSuggestion ? suggestion.slice(6) : ""
            const sessionInfo = isSessionSuggestion ? availableSessions.find(s => s.sessionId === sessionId) : null
            
            return (
              <Box key={suggestion}>
                <Text color={index === suggestionIndex ? "green" : "gray"}>
                  {index === suggestionIndex ? "▶ " : "  "}
                </Text>
                <Text color={index === suggestionIndex ? "green" : "white"}>
                  {suggestion}
                </Text>
                {sessionInfo && (
                  <Text color={index === suggestionIndex ? "yellow" : "gray"}>
                    {` (${sessionInfo.title})`}
                  </Text>
                )}
              </Box>
            )
          })}
          {value.startsWith("/load") && totalSessions > SESSIONS_PER_PAGE && (
            <Box marginTop={1}>
              <Text color="gray" dimColor>
                使用 ↑/↓ 箭头键浏览更多会话
              </Text>
            </Box>
          )}
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
        <Text color="blue">
          {isLoading ? (
            "Processing..."
          ) : isFocused ? (
            "输入消息 • ↑/↓ 历史记录滚动 • Tab 自动补全 • Esc 退出输入模式 • 使用 / 查看可用快捷命令"
          ) : (
            "Tab 激活输入 • ↑/↓ 滚动历史 • Ctrl+C 退出"
          )}
        </Text>
      </Box>
      
      {/* Session and Model info */}
      <Box marginTop={1} justifyContent="space-between">
        <Text color="blue" dimColor>
          当前会话: {currentSession.length > 30 ? `${currentSession.slice(0, 30)}...` : currentSession}
        </Text>
        <Text color="yellow">
          {currentModel}
        </Text>
      </Box>
    </Box>
  )
}
