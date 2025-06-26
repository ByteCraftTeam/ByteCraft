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
  currentSession?: string  // 新增：当前session信息
  currentModel?: string    // 新增：当前模型信息
  placeholder?: string     // 新增：占位符文本
  getAvailableSessions?: (page?: number, pageSize?: number) => Promise<{sessions: Array<{sessionId: string, title: string}>, total: number}>  // 修改：支持分页
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
  onFocusChange,
  currentSession = "未知会话",
  currentModel = "未选择模型",
  placeholder = "输入消息或使用 / 命令...",
  getAvailableSessions
}: InputBoxProps) => {
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

  // 闪烁光标效果 - 只在焦点模式下且有输入内容时启用
  useEffect(() => {
    if (!isFocused) {
      setCursorVisible(false)
      return
    }
    
    // 如果没有输入内容，光标保持静态显示
    if (!value) {
      setCursorVisible(true)
      return
    }
    
    // 有输入内容时才开始闪烁，减少闪烁频率到800ms
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev)
    }, 800)
    return () => clearInterval(interval)
  }, [isFocused, value])

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

  const getSessionSuggestions = useCallback((input: string) => {
    if (!input.startsWith("/load")) return []
    
    // 如果只是"/load"，显示当前页的所有sessions
    if (input === "/load") {
      return availableSessions.map(session => `/load ${session.sessionId}`)
    }
    
    // 如果是"/load "开头，显示当前页或进行搜索
    if (input.startsWith("/load ")) {
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
  }, [availableSessions])

  const getSuggestions = useCallback((input: string) => {
    const commandSuggestions = getCommandSuggestions(input)
    const modelSuggestions = getModelSuggestions(input)
    const sessionSuggestions = getSessionSuggestions(input)
    return [...commandSuggestions, ...modelSuggestions, ...sessionSuggestions]
  }, [getCommandSuggestions, getModelSuggestions, getSessionSuggestions])
  
  // 缓存计算结果
  const suggestions = useMemo(() => getSuggestions(value), [value, getSuggestions])
  const isSlashCommand = useMemo(() => value.startsWith("/"), [value])

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

  // 加载指定页的session
  const loadSessionPage = useCallback(async (page: number) => {
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
  }, [getAvailableSessions, SESSIONS_PER_PAGE])

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
        const isSessionSuggestion = value.startsWith("/load")
        
        if (suggestionIndex > 0) {
          setSuggestionIndex(prev => prev - 1)
                 } else if (isSessionSuggestion && sessionPage > 0) {
           // 到达顶部且有上一页，加载上一页并定位到末尾
           const newPage = sessionPage - 1
           loadSessionPage(newPage).then(() => {
             // 使用setTimeout确保状态更新完成
             setTimeout(() => {
               setSuggestionIndex(Math.min(SESSIONS_PER_PAGE - 1, availableSessions.length - 1))
             }, 0)
           })
        } else {
          // 普通循环到末尾
          setSuggestionIndex(suggestions.length - 1)
        }
      } else if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        onChange(commandHistory[commandHistory.length - 1 - newIndex])
      }
      return
    }

    if (key.downArrow) {
      if (showSuggestions && suggestions.length > 0) {
        const isSessionSuggestion = value.startsWith("/load")
        const maxPages = Math.ceil(totalSessions / SESSIONS_PER_PAGE)
        
        if (suggestionIndex < suggestions.length - 1) {
          setSuggestionIndex(prev => prev + 1)
                 } else if (isSessionSuggestion && sessionPage < maxPages - 1) {
           // 到达底部且有下一页，加载下一页并定位到开头
           const newPage = sessionPage + 1
           loadSessionPage(newPage).then(() => {
             // 使用setTimeout确保状态更新完成
             setTimeout(() => {
               setSuggestionIndex(0)
             }, 0)
           })
        } else {
          // 普通循环到开头
          setSuggestionIndex(0)
        }
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
        {value ? (
          <Text color={isFocused && isSlashCommand ? "yellow" : isFocused ? "white" : "gray"}>
            {value}
          </Text>
        ) : (
          isFocused && (
            <Text color="gray" dimColor>
              {placeholder}
            </Text>
          )
        )}
        {!isLoading && stableCursorVisible && <Text color="cyan">▋</Text>}
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
    prevProps.currentSession === nextProps.currentSession &&
    prevProps.currentModel === nextProps.currentModel &&
    prevProps.placeholder === nextProps.placeholder &&
    // onChange, onSubmit, onFocusChange, getAvailableSessions 是函数，比较引用
    prevProps.onChange === nextProps.onChange &&
    prevProps.onSubmit === nextProps.onSubmit &&
    prevProps.onFocusChange === nextProps.onFocusChange &&
    prevProps.getAvailableSessions === nextProps.getAvailableSessions
  )
})
