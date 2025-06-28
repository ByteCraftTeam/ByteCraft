"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Box, useApp, Static } from "ink"
import { ChatInterface } from "./components/chat-interface.js"
import { InputBox } from "./components/text-input.js"
import { StatusBar } from "./components/status-bar.js"
import { WelcomeScreen } from "./components/welcome-screen.js"
import { MemoryManager } from "./components/memory-manager.js"
import { MessageBubble } from "./components/message-bubble.js"
import { AgentLoop, StreamingCallback } from "../utils/agent-loop.js"
import { ErrorBoundary } from "./components/error-boundary.js"
import { getAvailableModels, getDefaultModel } from "../config/config.js"

// 动态获取可用的AI模型列表
export const AVAILABLE_MODELS = getAvailableModels()
export type ModelType = string

// 获取默认模型
const defaultModel = getDefaultModel() || AVAILABLE_MODELS[0] || "deepseek-v3"

export interface Message {
  id: string
  type: "user" | "assistant" | "system" | "tool"
  content: string
  timestamp: Date
  streaming?: boolean
  toolCall?: {
    name: string
    args: any
    result?: any
  }
  // 新增：支持在assistant消息中嵌入工具调用
  embeddedToolCalls?: Array<{
    id: string
    name: string
    args: any
    result?: any
    timestamp: Date
  }>
}

export interface AppState {
  messages: Message[]
  currentModel: ModelType
  isLoading: boolean
  showWelcome: boolean
  activeTools: Array<{
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

// 安全的工具签名生成函数，避免大对象JSON序列化
function generateToolSignature(toolName: string, args: any): string {
  try {
    // 使用简化的签名，避免完整JSON序列化
    const timestamp = Date.now();
    const argKeys = args && typeof args === 'object' ? Object.keys(args).join(',') : '';
    return `${toolName}-${argKeys}-${timestamp}`;
  } catch {
    // 降级为基本签名
    return `${toolName}-${Date.now()}-${Math.random()}`;
  }
}

// 安全的JSON序列化函数，带有大小限制
function safeJsonStringify(obj: any, maxSize: number = 1024): string {
  try {
    if (!obj) return '';
    
    let result = '';
    if (typeof obj === 'string') {
      result = obj;
    } else if (typeof obj === 'object') {
      // 对于大对象，只序列化关键字段
      if (Object.keys(obj).length > 10) {
        const simplified = {
          keys: Object.keys(obj).slice(0, 5),
          count: Object.keys(obj).length,
          type: Array.isArray(obj) ? 'array' : 'object'
        };
        result = JSON.stringify(simplified);
      } else {
        result = JSON.stringify(obj, null, 2);
      }
    } else {
      result = String(obj);
    }
    
    // 限制大小
    if (result.length > maxSize) {
      result = result.substring(0, maxSize) + '... [截断]';
    }
    
    return result;
  } catch {
    return String(obj) || '';
  }
}

// 将 ConversationMessage 转换为 UI Message 格式
function convertConversationMessageToUIMessage(convMessage: any): Message {
  // 检查是否有有效的工具调用
  const hasValidToolCalls = convMessage.message?.tool_calls && 
    Array.isArray(convMessage.message.tool_calls) && 
    convMessage.message.tool_calls.length > 0;
  
  // 如果有工具调用，创建专门的工具调用消息
  if (hasValidToolCalls && convMessage.message.tool_calls.length > 0) {
    const toolCall = convMessage.message.tool_calls[0];
    
    // 提取工具名称
    let toolName = "unknown";
    if (toolCall && typeof toolCall === 'object') {
      if (toolCall.name) {
        toolName = toolCall.name;
      } else if (toolCall.id) {
        if (Array.isArray(toolCall.id)) {
          const lastPart = toolCall.id[toolCall.id.length - 1] || "unknown";
          if (lastPart === 'FileManagerToolV2') {
            toolName = 'file_manager_v2';
          } else {
            toolName = lastPart.replace(/Tool$/, '').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
          }
        } else if (typeof toolCall.id === 'string') {
          toolName = toolCall.id;
        }
      }
    }
    
    // 提取工具参数（保留原始JSON格式）
    let toolArgs = {};
    if (toolCall.args) {
      try {
        toolArgs = typeof toolCall.args === 'string' ? JSON.parse(toolCall.args) : toolCall.args;
      } catch {
        toolArgs = { raw: toolCall.args };
      }
    }
    
    // 生成工具调用的格式化描述
    let toolDescription = `工具调用: ${toolName}\n\n`;
    
    // 添加参数信息（保留原始JSON格式）
    if (Object.keys(toolArgs).length > 0) {
      toolDescription += `调用参数:\n${JSON.stringify(toolArgs, null, 2)}\n\n`;
    }
    
    // 添加工具调用ID信息
    if (convMessage.message.tool_call_id) {
      toolDescription += `调用ID: ${convMessage.message.tool_call_id}\n\n`;
    }
    
    // 添加状态信息
    toolDescription += `状态: 已完成`;
    
    return {
      id: convMessage.uuid || `tool-${Date.now()}-${Math.random()}`,
      type: "assistant", // 使用 assistant 类型，这样会显示为 Agent 块
      content: toolDescription,
      timestamp: new Date(convMessage.timestamp || Date.now()),
      streaming: false,
      // 保留原始工具调用信息
      toolCall: {
        name: toolName,
        args: toolArgs,
        result: convMessage.message.tool_call_id ? { tool_call_id: convMessage.message.tool_call_id } : undefined
      }
    };
  }
  
  // 普通消息（非工具调用）
  return {
    id: convMessage.uuid || `msg-${Date.now()}-${Math.random()}`,
    type: convMessage.type || 'user',
    content: convMessage.message?.content || convMessage.content || '',
    timestamp: new Date(convMessage.timestamp || Date.now()),
    streaming: false
  };
}

// 加载session的历史消息并转换为UI格式
async function loadSessionMessages(agentLoop: any, sessionId: string): Promise<Message[]> {
  try {
    // 加载session到AgentLoop
    await agentLoop.loadSession(sessionId);
    
    // 获取历史消息
    const historyMessages = await agentLoop.getCurrentSessionHistory();
    
    // 转换为UI消息格式，并整合工具调用和结果
    const uiMessages: Message[] = [];
    const toolCallMap = new Map<string, any>(); // 存储工具调用信息
    
    for (let i = 0; i < historyMessages.length; i++) {
      const convMessage = historyMessages[i];
      
      // 检查是否有工具调用
      const hasValidToolCalls = convMessage.message?.tool_calls && 
        Array.isArray(convMessage.message.tool_calls) && 
        convMessage.message.tool_calls.length > 0;
      
      if (hasValidToolCalls && convMessage.message.tool_calls.length > 0) {
        const toolCall = convMessage.message.tool_calls[0];
        const toolCallId = toolCall.id;
        
        // 存储工具调用信息
        toolCallMap.set(toolCallId, {
          message: convMessage,
          toolCall: toolCall
        });
        
        // 查找对应的结果消息
        let toolResult = null;
        for (let j = i + 1; j < historyMessages.length; j++) {
          const nextMessage = historyMessages[j];
          if (nextMessage.message?.tool_call_id === toolCallId) {
            // 找到结果消息
            try {
              toolResult = JSON.parse(nextMessage.message.content);
            } catch {
              toolResult = nextMessage.message.content;
            }
            break;
          }
        }
        
        // 创建整合的工具调用消息
        const toolName = toolCall.name || "unknown";
        const toolArgs = toolCall.args || {};
        
        let toolDescription = `工具调用: ${toolName}\n\n`;
        
        // 添加参数信息（保留原始JSON格式）
        if (Object.keys(toolArgs).length > 0) {
          toolDescription += `调用参数:\n${JSON.stringify(toolArgs, null, 2)}\n\n`;
        }
        
        // 添加结果信息
        if (toolResult) {
          toolDescription += `调用结果:\n${JSON.stringify(toolResult, null, 2)}\n\n`;
        }
        
        // 添加工具调用ID信息
        if (toolCallId) {
          toolDescription += `调用ID: ${toolCallId}\n\n`;
        }
        
        // 添加状态信息
        toolDescription += `状态: 已完成`;
        
        const toolMessage: Message = {
          id: convMessage.uuid || `tool-${Date.now()}-${Math.random()}`,
          type: "assistant",
          content: "", // 设置为空字符串，避免重复显示
          timestamp: new Date(convMessage.timestamp || Date.now()),
          streaming: false,
          toolCall: {
            name: toolName,
            args: toolArgs,
            result: toolResult
          }
        };
        
        uiMessages.push(toolMessage);
        
        // 跳过结果消息，因为已经整合到工具调用消息中了
        continue;
      }
      
      // 检查是否是工具结果消息（已经被整合，跳过）
      if (convMessage.message?.tool_call_id && toolCallMap.has(convMessage.message.tool_call_id)) {
        continue;
      }
      
      // 普通消息
      const uiMessage = convertConversationMessageToUIMessage(convMessage);
      uiMessages.push(uiMessage);
    }
    
    return uiMessages;
  } catch (error) {
    console.error('加载session消息失败:', error);
    return [];
  }
}

export default function App({ 
  initialModel, 
  initialSessionId 
}: { 
  initialModel?: string
  initialSessionId?: string 
} = {}) {
  const [state, setState] = useState<AppState>({
    messages: [],
    currentModel: initialModel || defaultModel,
    isLoading: false,
    showWelcome: true, // 总是先显示欢迎界面
    activeTools: [],
  })

  const [input, setInput] = useState("")
  const { exit } = useApp()
  const agentLoopRef = useRef<AgentLoop | null>(null)
  const lastContentRef = useRef("")
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const aiMessageIdRef = useRef<string>("")
  
  // 添加组件挂载状态ref
  const isMountedRef = useRef(true)
  // 使用Map替代Set，提供更好的内存控制
  const processedToolCallsRef = useRef<Map<string, number>>(new Map())

  // 新增：输入焦点状态
  const [inputFocused, setInputFocused] = useState(true)
  
  // 使用useCallback包装焦点变化回调以确保稳定性
  const handleFocusChange = useCallback((focused: boolean) => {
    setInputFocused(focused)
  }, [])

  // 获取当前会话ID
  const getCurrentSessionId = useCallback(() => {
    return agentLoopRef.current?.getCurrentSessionId() || "无会话"
  }, [])

  // 获取可用会话列表（支持分页）
  const getAvailableSessions = useCallback(async (page: number = 0, pageSize: number = 10) => {
    if (!agentLoopRef.current) {
      return { sessions: [], total: 0 }
    }
    try {
      const allSessions = await agentLoopRef.current.listSessions()
      const total = allSessions.length
      const startIndex = page * pageSize
      const endIndex = startIndex + pageSize
      const paginatedSessions = allSessions
        .slice(startIndex, endIndex)
        .map(session => ({
          sessionId: session.sessionId,
          title: session.title || `Session ${session.sessionId.slice(0, 8)}...`
        }))
      
      return {
        sessions: paginatedSessions,
        total: total
      }
    } catch (error) {
      console.error("Failed to get sessions:", error)
      return { sessions: [], total: 0 }
    }
  }, [])

  // 内存管理回调
  const handleMemoryCleanup = useCallback((cleanedCount: number) => {
    setState((prev) => {
      const newMessages = prev.messages.slice(-800); // 保留最新800条消息
      console.log(`🧹 清理了 ${prev.messages.length - newMessages.length} 条旧消息`);
      return {
        ...prev,
        messages: newMessages,
        // 同时清理对应的活动工具
        activeTools: prev.activeTools.filter(tool => 
          Date.now() - tool.startTime < 3600000 // 保留1小时内的工具
        )
      };
    });
  }, []);

  // 清理工具调用记录的函数
  const cleanupToolCallHistory = useCallback(() => {
    const now = Date.now();
    const maxAge = 300000; // 5分钟
    
    for (const [signature, timestamp] of processedToolCallsRef.current.entries()) {
      if (now - timestamp > maxAge) {
        processedToolCallsRef.current.delete(signature);
      }
    }
    
    // 如果Map变得过大，强制清理
    if (processedToolCallsRef.current.size > 100) {
      processedToolCallsRef.current.clear();
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      console.log("🔍 App component unmounting, cleaning up...")
      isMountedRef.current = false
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      // 清理工具调用记录
      processedToolCallsRef.current.clear();
      // 清理AgentLoop资源
      if (agentLoopRef.current) {
        agentLoopRef.current.destroy?.();
      }
    }
  }, [])

  // 定期清理工具调用历史
  useEffect(() => {
    const cleanupInterval = setInterval(cleanupToolCallHistory, 60000); // 每分钟清理一次
    return () => clearInterval(cleanupInterval);
  }, [cleanupToolCallHistory]);

  // 防抖更新函数
  const debouncedUpdate = useCallback((aiMessageId: string, content: string) => {
    if (!isMountedRef.current) return
    
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((msg) =>
            msg.id === aiMessageId ? { ...msg, content: content || " " } : msg
          ),
        }))
      }
    }, 50) // 增加防抖时间以减少更新频率
  }, [])

  // 使用useEffect确保AgentLoop只初始化一次
  useEffect(() => {
    if (!agentLoopRef.current) {
      agentLoopRef.current = new AgentLoop(state.currentModel)
    }
  }, [])

  // 初始化指定的会话
  useEffect(() => {
    if (initialSessionId && agentLoopRef.current) {
      const loadSession = async () => {
        try {
          await agentLoopRef.current!.loadSession(initialSessionId);
          addSystemMessage(`已加载会话: ${initialSessionId.slice(0, 8)}...`);
          
          // 加载历史消息并转换为UI格式
          const historyMessages = await loadSessionMessages(agentLoopRef.current!, initialSessionId);
          
          // 更新UI状态，显示历史消息
          setState(prev => ({ 
            ...prev, 
            messages: historyMessages,
            showWelcome: false 
          }));
          
          addSystemMessage(`已加载 ${historyMessages.length} 条历史消息`);
        } catch (error) {
          console.error('加载会话失败:', error);
          addSystemMessage(`加载会话失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      loadSession();
    }
  }, [initialSessionId]);

  // 顶层定义所有流式回调
  const onToken = useCallback((token: string) => {
    if (!isMountedRef.current) return
    // console.log("🔍 onToken received:", token.length, "chars")
    lastContentRef.current += token
    debouncedUpdate(aiMessageIdRef.current, lastContentRef.current)
  }, [debouncedUpdate])

  const onToolCall = useCallback((toolName: string, args: any) => {
    // 使用更合适的方式记录调试信息，避免在 React 组件中直接使用 console.log
    if (process.env.NODE_ENV === 'development') {
      // 只在开发环境下记录调试信息
      const debugInfo = {
        toolName,
        toolNameType: typeof toolName,
        argsType: typeof args,
        isMounted: isMountedRef.current
      };
      // 可以写入到文件或使用其他日志系统
      // 这里暂时注释掉，避免影响 UI 渲染
      // console.log("🔍 App onToolCall received:", debugInfo);
    }
    
    if (!isMountedRef.current) {
      return
    }
    
    // 使用安全的签名生成，避免大对象序列化
    const toolSignature = generateToolSignature(toolName, args);
    if (processedToolCallsRef.current.has(toolSignature)) {
      return
    }
    processedToolCallsRef.current.set(toolSignature, Date.now());
    
    const safeToolName = toolName || "unknown"
    const safeArgs = args || {}
    
    const toolId = `tool-${Date.now()}-${Math.random()}`
    
    // 查找当前正在流式更新的assistant消息
    setState((prev) => {
      const currentAssistantMsg = prev.messages.find(
        msg => msg.id === aiMessageIdRef.current && msg.type === "assistant"
      )
      
      if (!currentAssistantMsg) {
        // 如果没有找到当前assistant消息，创建独立的tool消息（fallback）
        const toolMsg: Message = {
          id: toolId,
          type: "tool",
          content: `调用工具 ${safeToolName}...`,
          timestamp: new Date(),
          toolCall: { name: safeToolName, args: safeArgs },
        }
        
        return {
          ...prev,
          messages: [...prev.messages, toolMsg],
          activeTools: [
            ...prev.activeTools,
            {
              id: toolId,
              name: safeToolName,
              args: safeArgs,
              status: "executing" as const,
              startTime: Date.now(),
            }
          ]
        }
      }
      
      // 将工具调用嵌入到当前assistant消息中
      const newMessages = prev.messages.map(msg => {
        if (msg.id === aiMessageIdRef.current && msg.type === "assistant") {
          const embeddedToolCall = {
            id: toolId,
            name: safeToolName,
            args: safeArgs,
            timestamp: new Date()
          }
          
          // 如果当前消息内容为空或很少，先添加一个提示文本
          let updatedContent = msg.content;
          if (!updatedContent || updatedContent.trim() === "") {
            updatedContent = "正在处理您的请求...\n";
          }
          
          return {
            ...msg,
            content: updatedContent,
            embeddedToolCalls: [...(msg.embeddedToolCalls || []), embeddedToolCall]
          }
        }
        return msg
      })
      
      return {
        ...prev,
        messages: newMessages,
        activeTools: [
          ...prev.activeTools,
          {
            id: toolId,
            name: safeToolName,
            args: safeArgs,
            status: "executing" as const,
            startTime: Date.now(),
          }
        ]
      }
    })
  }, [])

  const onToolResult = useCallback((toolName: string, result: any) => {
    /*
    console.log("🔍 App onToolResult received:", {
      toolName,
      toolNameType: typeof toolName,
      resultType: typeof result,
      isMounted: isMountedRef.current
    })
    */
    
    if (!isMountedRef.current) {
      // console.log("🔍 onToolResult: component unmounted, ignoring")
      return
    }
    
    const safeToolName = toolName || "unknown"
    // 使用安全的格式化
    let resultText = "执行完成"
    
    if (result) {
      try {
        if (typeof result === 'string') {
          resultText = result.length > 1000 ? result.substring(0, 1000) + '... [截断]' : result;
        } else {
          resultText = safeJsonStringify(result, 1000);
        }
      } catch (error) {
        // console.log("🔍 Error formatting result:", error)
        resultText = "结果格式化失败"
      }
    }
    
    setState((prev) => {
      // 首先尝试更新嵌入在assistant消息中的工具调用
      let updatedMessages = prev.messages.map(msg => {
        if (msg.type === "assistant" && msg.embeddedToolCalls) {
          const updatedEmbeddedToolCalls = msg.embeddedToolCalls.map(toolCall => {
            // 使用多种匹配策略：工具名称、工具ID、参数匹配等
            const normalizedToolName = toolCall.name.toLowerCase().replace(/[_-]/g, '');
            const normalizedSafeToolName = safeToolName.toLowerCase().replace(/[_-]/g, '');
            
            const toolNameMatches = toolCall.name === safeToolName || 
                                   toolCall.name.includes(safeToolName) || 
                                   safeToolName.includes(toolCall.name) ||
                                   normalizedToolName === normalizedSafeToolName ||
                                   normalizedToolName.includes(normalizedSafeToolName) ||
                                   normalizedSafeToolName.includes(normalizedToolName);
            
            // 如果工具名称匹配且没有结果，或者这是最后一个没有结果的工具调用
            if ((toolNameMatches && !toolCall.result) || 
                (!toolCall.result && !msg.embeddedToolCalls?.some(tc => tc.result && tc.name !== toolCall.name))) {
              return {
                ...toolCall,
                result
              }
            }
            return toolCall
          })
          
          if (JSON.stringify(updatedEmbeddedToolCalls) !== JSON.stringify(msg.embeddedToolCalls)) {
            return {
              ...msg,
              embeddedToolCalls: updatedEmbeddedToolCalls
            }
          }
        }
        return msg
      })
      
      // 如果没有找到嵌入的工具调用，尝试更新独立的tool消息（fallback）
      if (JSON.stringify(updatedMessages) === JSON.stringify(prev.messages)) {
        const toolMessageIdx = prev.messages.findIndex(
          (msg) => msg.type === "tool" && 
          msg.toolCall?.name === safeToolName && 
          !msg.toolCall?.result
        )
        
        if (toolMessageIdx !== -1) {
          updatedMessages = [...prev.messages]
          updatedMessages[toolMessageIdx] = {
            ...updatedMessages[toolMessageIdx],
            content: `${updatedMessages[toolMessageIdx].content}\n工具结果: ${resultText}`,
            toolCall: { 
              ...updatedMessages[toolMessageIdx].toolCall!, 
              result 
            },
          }
        }
      }
      
      return {
        ...prev,
        messages: updatedMessages,
        activeTools: prev.activeTools.map(tool => 
          tool.name === safeToolName 
            ? { ...tool, status: "completed" as const, result, endTime: Date.now() }
            : tool
        )
      }
    })
  }, [])

  const onComplete = useCallback((finalResponse: string) => {
    if (!isMountedRef.current) return
    
    // console.log("🔍 onComplete called:", {
    //   finalResponse: finalResponse?.substring(0, 100),
    //   lastContentLength: lastContentRef.current?.length,
    //   lastContentPreview: lastContentRef.current?.substring(0, 100)
    // })
    
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }
    
    setState((prev) => ({
      ...prev,
      isLoading: false,
      messages: prev.messages.map(msg => 
        msg.id === aiMessageIdRef.current ? {
          ...msg, 
          streaming: false,
          content: lastContentRef.current || finalResponse || "回复完成"
        } : msg
      ),
    }))
  }, [])

  const onError = useCallback((err: Error) => {
    if (!isMountedRef.current) return
    
    setState((prev) => ({
      ...prev,
      isLoading: false,
      messages: [
        ...prev.messages,
        {
          id: `error-${Date.now()}`,
          type: "system",
          content: `对话出错: ${err.message}`,
          timestamp: new Date(),
        },
      ],
    }))
  }, [])

  // Handle slash commands
  const handleSlashCommand = (command: string) => {
    const [cmd, ...args] = command.slice(1).split(" ")

    switch (cmd) {
      case "new":
        // 清理旧的工具调用记录
        processedToolCallsRef.current.clear();
        
        // 强制清空所有状态，确保UI立即更新
        setState((prev) => ({
          ...prev,
          messages: [], // 清空消息
          showWelcome: false, // 不显示欢迎页面，因为用户已经在使用中
          activeTools: [], // 清理活动工具
          isLoading: false, // 确保不在加载状态
        }))
        
        // 创建新会话
        if (agentLoopRef.current) {
          agentLoopRef.current.createNewSession().then(sessionId => {
            addSystemMessage(`Started new session: ${sessionId?.slice(0, 8)}...`)
          }).catch(error => {
            addSystemMessage(`Failed to create new session: ${error.message}`)
          })
        } else {
          addSystemMessage("Started new session")
        }
        break

      case "model":
        const newModel = args[0] || defaultModel
        if (AVAILABLE_MODELS.includes(newModel)) {
          setState((prev) => ({ ...prev, currentModel: newModel }))
          addSystemMessage(`Switched to model: ${newModel}`)
          // 重新初始化AgentLoop
          if (agentLoopRef.current) {
            agentLoopRef.current.destroy?.();
            agentLoopRef.current = new AgentLoop(newModel);
          }
        } else {
          addSystemMessage(`Invalid model: ${newModel}. Available models: ${AVAILABLE_MODELS.join(", ")}`)
        }
        break

      case "load":
        const sessionId = args[0]
        if (!sessionId) {
          addSystemMessage("Usage: /load <session-id>")
          break
        }
        // 使用AgentLoop加载会话
        if (agentLoopRef.current) {
          agentLoopRef.current.loadSessionSmart(sessionId).then(async (success) => {
            if (success) {
              addSystemMessage(`Loaded session: ${sessionId}`)
              
              // 加载历史消息并转换为UI格式
              const historyMessages = await loadSessionMessages(agentLoopRef.current!, sessionId);
              
              // 更新UI状态，显示历史消息
              setState((prev) => ({
                ...prev,
                messages: historyMessages,
                showWelcome: false,
              }))
              
              addSystemMessage(`Loaded ${historyMessages.length} messages from session: ${sessionId}`)
            } else {
              addSystemMessage(`Failed to load session: ${sessionId}`)
            }
          }).catch(error => {
            addSystemMessage(`Error loading session: ${error.message}`)
          })
        } else {
          addSystemMessage("AgentLoop not initialized")
        }
        break

      case "clear":
        // 清理内存和缓存
        processedToolCallsRef.current.clear();
        if (agentLoopRef.current) {
          agentLoopRef.current.clearCache();
        }
        addSystemMessage("Cleared cache and memory")
        break

      case "help":
        addSystemMessage("Available commands: /new, /model <name>, /load <session>, /clear, /help, /exit")
        addSystemMessage(`Available models: ${AVAILABLE_MODELS.join(", ")}`)
        break

      case "exit":
        exit()
        break

      default:
        addSystemMessage(`Unknown command: /${cmd}`)
    }
  }

  const addSystemMessage = (content: string) => {
    const message: Message = {
      id: `system-${Date.now()}`,
      type: "system",
      content,
      timestamp: new Date(),
    }
    setState((prev) => ({ ...prev, messages: [...prev.messages, message] }))
  }

  const handleSubmit = useCallback(async (inputText: string) => {
    if (!inputText.trim()) return
    if (inputText.startsWith("/")) {
      handleSlashCommand(inputText)
      return
    }
    
    // 提交后自动退出焦点模式，方便查看回复
    setInputFocused(false)
    
    if (state.showWelcome) {
      setState((prev) => ({ ...prev, showWelcome: false }))
    }
    
    // 清理旧的工具调用记录
    cleanupToolCallHistory();
    
    // 添加用户消息
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: "user",
      content: inputText,
      timestamp: new Date(),
    }
    
    // 添加 assistant 消息（流式内容）
    const aiMessageId = `ai-${Date.now()}`
    aiMessageIdRef.current = aiMessageId
    const aiMessage: Message = {
      id: aiMessageId,
      type: "assistant",
      content: "",
      timestamp: new Date(),
      streaming: true,
    }
    
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage, aiMessage],
      isLoading: true,
    }))
    
    // 重置内容引用
    lastContentRef.current = ""
    
    // 调用 AgentLoop 流式对话
    const agentLoop = agentLoopRef.current!
    
    try {
      await agentLoop.processMessage(inputText, {
        onToken,
        onToolCall,
        onToolResult,
        onComplete,
        onError,
      })
    } catch (error) {
      console.error('handleSubmit error:', error);
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [cleanupToolCallHistory, onToken, onToolCall, onToolResult, onComplete, onError, state.showWelcome])

  return (
    <ErrorBoundary>
      <Box flexDirection="column" height="100%">
        {/* 内存管理器 - 不渲染任何内容但负责内存清理 */}
        <MemoryManager 
          messages={state.messages} 
          maxMessages={1000}
          cleanupInterval={300000} // 5分钟
          onCleanup={handleMemoryCleanup}
        />
        
        {/* 状态栏 - 固定静态内容 */}
        <Static items={[{ model: state.currentModel, sessionId: getCurrentSessionId(), key: 'status-bar' }]}>
          {(item) => (
            <StatusBar 
              key={item.key}
              model={item.model} 
              sessionId={item.sessionId} 
              messageCount={state.messages.length} 
            />
          )}
        </Static>

        <Box flexGrow={1} flexDirection="column">
          {/* 欢迎屏幕 - 完全静态 */}
          {state.showWelcome && (
            <Static items={[{ key: 'welcome-screen' }]}>
              {(item) => <WelcomeScreen key={item.key} />}
            </Static>
          )}
          
          {/* 聊天界面 - 处理所有消息，内部使用静态块优化 */}
          <ChatInterface 
            messages={state.messages} 
            isLoading={state.isLoading} 
            activeTools={state.activeTools}
          />
        </Box>

        {/* <InputBox 
          value={input} 
          onChange={setInput} 
          onSubmit={handleSubmit} 
          isLoading={state.isLoading}
          isFocused={inputFocused}
          onFocusChange={handleFocusChange}
          currentSession={getCurrentSessionId()}
          currentModel={state.currentModel}
          placeholder="输入消息开始对话，或使用 / 查看可用命令..."
          getAvailableSessions={getAvailableSessions}
        /> */}
        <InputBox 
          value={input} 
          onChange={setInput} 
          onSubmit={handleSubmit} 
          isLoading={state.isLoading}
          isFocused={inputFocused}
          onFocusChange={setInputFocused}
          currentSession={getCurrentSessionId()}
          currentModel={state.currentModel}
          getAvailableSessions={getAvailableSessions}
        />
      </Box>
    </ErrorBoundary>
  )
}
