import { Box } from "ink"
import type { Message } from "../app.js"
import { ToolAnimation } from "./tool-animation.js"
import { SafeText } from "./safe-text.js"
import { StatusMessage } from "@inkjs/ui"
import { useMemo } from "react"
import {Spinner} from '@inkjs/ui';


interface ToolCallDisplayProps {
  toolCall: {
    name: string
    args: any
    result?: any
  }
  isExecuting?: boolean
  showDetailedInfo?: boolean // 新增：是否显示详细信息
}

// 生成工具执行结果的概览文本
function generateToolSummary(toolName: string, args: any, result: any): { variant: "success" | "error" | "warning" | "info", message: string } {
  try {
    // 解析参数和结果
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
    const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
    
    // 根据工具名称和操作生成概览
    switch (toolName) {
      case 'file_manager':
      case 'file_manager_v2':
        if (parsedArgs?.action === 'batch_create_folders' || parsedArgs?.action === 'create_directory') {
          const folders = parsedArgs?.folders || [parsedArgs?.path];
          if (folders && folders.length > 0) {
            return {
              variant: 'success',
              message: `成功创建目录: ${folders.join(', ')}`
            };
          }
        }
        if (parsedArgs?.action === 'batch_create_files') {
          const files = parsedArgs?.files || [];
          if (files.length > 0) {
            return {
              variant: 'success',
              message: `成功创建文件: ${files.length} 个文件`
            };
          }
        }
        if (parsedArgs?.action === 'delete_item') {
          return {
            variant: 'success',
            message: `成功删除: ${parsedArgs?.path}`
          };
        }
        if (parsedArgs?.action === 'batch_delete') {
          const items = parsedArgs?.items || [];
          if (items.length > 0) {
            return {
              variant: 'success',
              message: `成功删除: ${items.length} 个项目`
            };
          }
        }
        if (parsedArgs?.action === 'write') {
          return {
            variant: 'success',
            message: `成功写入文件: ${parsedArgs?.path}`
          };
        }
        if (parsedArgs?.action === 'read_file') {
          return {
            variant: 'info',
            message: `成功读取文件: ${parsedArgs?.path}`
          };
        }
        if (parsedArgs?.action === 'read_folder') {
          return {
            variant: 'info',
            message: `成功读取文件夹: ${parsedArgs?.path}`
          };
        }
        if (parsedArgs?.action === 'precise_edit') {
          return {
            variant: 'success',
            message: `成功编辑文件: ${parsedArgs?.path}`
          };
        }
        break;
        
      case 'code_executor':
        return {
          variant: 'success',
          message: `代码执行完成 (${parsedArgs?.language || 'unknown'})`
        };
        
      case 'command_exec':
        return {
          variant: 'success',
          message: `命令执行完成: ${parsedArgs?.command || 'unknown'}`
        };
        
      case 'web_search':
      case 'tavily_search':
        return {
          variant: 'info',
          message: `搜索完成: ${parsedArgs?.query || 'unknown'}`
        };
        
      default:
        return {
          variant: 'info',
          message: `工具 ${toolName} 执行完成`
        };
    }
    
    // 检查是否有错误
    if (parsedResult?.error) {
      return {
        variant: 'error',
        message: `执行失败: ${parsedResult.error}`
      };
    }
    
    // 默认成功消息
    return {
      variant: 'success',
      message: `工具 ${toolName} 执行成功`
    };
    
  } catch (error) {
    // 如果解析失败，返回通用消息
    return {
      variant: 'info',
      message: `工具 ${toolName} 执行完成`
    };
  }
}

// 生成工具执行过程中的简洁描述
function generateActionSummary(toolName: string, args: any): string {
  try {
    // 解析参数
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
    
    // 根据工具名称和操作生成简洁描述
    switch (toolName) {
      case 'file_manager':
      case 'file_manager_v2':
        if (parsedArgs?.action === 'batch_create_folders' || parsedArgs?.action === 'create_directory') {
          const folders = parsedArgs?.folders || [parsedArgs?.path];
          if (folders && folders.length > 0) {
            return `正在创建目录: ${folders.join(', ')}`;
          }
        }
        if (parsedArgs?.action === 'batch_create_files') {
          const files = parsedArgs?.files || [];
          if (files.length > 0) {
            return `正在创建文件: ${files.length} 个文件`;
          }
        }
        if (parsedArgs?.action === 'delete_item') {
          return `正在删除: ${parsedArgs?.path}`;
        }
        if (parsedArgs?.action === 'batch_delete') {
          const items = parsedArgs?.items || [];
          if (items.length > 0) {
            return `正在删除: ${items.length} 个项目`;
          }
        }
        if (parsedArgs?.action === 'write') {
          return `正在写入文件: ${parsedArgs?.path}`;
        }
        if (parsedArgs?.action === 'read_file') {
          return `正在读取文件: ${parsedArgs?.path}`;
        }
        if (parsedArgs?.action === 'read_folder') {
          return `正在读取文件夹: ${parsedArgs?.path}`;
        }
        if (parsedArgs?.action === 'precise_edit') {
          return `正在编辑文件: ${parsedArgs?.path}`;
        }
        break;
        
      case 'code_executor':
        return `正在执行代码 (${parsedArgs?.language || 'unknown'})`;
        
      case 'command_exec':
        return `正在执行命令: ${parsedArgs?.command || 'unknown'}`;
        
      case 'web_search':
      case 'tavily_search':
        return `正在搜索: ${parsedArgs?.query || 'unknown'}`;
        
      default:
        return `正在执行 ${toolName}`;
    }
    
    // 默认描述
    return `正在执行 ${toolName}`;
    
  } catch (error) {
    // 如果解析失败，返回通用描述
    return `正在执行 ${toolName}`;
  }
}

export function ToolCallDisplay({ toolCall, isExecuting = false, showDetailedInfo = false }: ToolCallDisplayProps) {
  // 添加调试日志
  /*
  console.log("🔍 ToolCallDisplay render:", {
    toolName: toolCall?.name,
    args: toolCall?.args,
    result: toolCall?.result,
    isExecuting
  })
  */

  const displayData = useMemo(() => {
    // 确保 toolCall 存在
    if (!toolCall) {
      // console.log("🔍 ToolCallDisplay: toolCall is null/undefined")
      return {
        safeToolName: "unknown",
        toolIcon: "🔧",
        status: { icon: "❌", color: "red", text: "错误" },
        argsText: "",
        resultText: "",
        shouldShowArgs: false,
        shouldShowResult: false
      }
    }

    // 安全的格式化函数 - 确保永远不返回空字符串
    const formatArgs = (args: any): string => {
      if (!args || Object.keys(args).length === 0) return " " // 返回空格而不是空字符串
      
      try {
        const formatted = JSON.stringify(args, null, 2)
        return formatted || " "
      } catch {
        return String(args) || " "
      }
    }

    const formatResult = (result: any): string => {
      if (!result) return " " // 返回空格而不是空字符串
      
      try {
        if (typeof result === 'string') {
          return result || " "
        } else {
          const formatted = JSON.stringify(result, null, 2)
          return formatted || " "
        }
      } catch {
        return String(result) || " "
      }
    }

    // 确保工具名称是安全的字符串
    let safeToolName = "unknown"
    if (typeof toolCall.name === 'string' && toolCall.name.trim()) {
      safeToolName = toolCall.name.trim()
    } else if (Array.isArray(toolCall.name)) {
      safeToolName = toolCall.name.join(',') || "unknown"
    } else {
      safeToolName = String(toolCall.name || "unknown")
    }

    const toolIcon = (() => {
      const toolIcons: Record<string, string> = {
        file_manager: "📁",
        file_manager_v2: "📁",
        code_executor: "⚡", 
        command_exec: "💻",
        web_search: "🌐",
        weather: "🌤️",
        tavily_search: "🔍",
        default: "🔧"
      }
      return toolIcons[safeToolName] || toolIcons.default
    })()

    const status = (() => {
      if (isExecuting) {
        return { icon: "⏳", color: "yellow", text: "执行中..." }
      }
      if (toolCall.result) {
        return { icon: "✅", color: "green", text: "已完成" }
      }
      return { icon: "🔄", color: "blue", text: "准备中" }
    })()

    const argsText = formatArgs(toolCall.args)
    const resultText = formatResult(toolCall.result)

    /*
    console.log("🔍 ToolCallDisplay formatted data:", {
      safeToolName,
      argsText: `"${argsText}"`,
      resultText: `"${resultText}"`,
      argsTextLength: argsText.length,
      resultTextLength: resultText.length
    })
    */

    return {
      safeToolName,
      toolIcon,
      status,
      argsText,
      resultText,
      shouldShowArgs: argsText.trim().length > 0 && argsText !== '""' && argsText !== " ",
      shouldShowResult: resultText.trim().length > 0 && resultText !== '""' && resultText !== " "
    }
  }, [toolCall, isExecuting])

  // 如果没有有效的工具调用数据，返回一个安全的占位符
  if (!toolCall || !displayData) {
    // console.log("🔍 ToolCallDisplay: Returning safe placeholder")
    return (
      <Box flexDirection="column" marginLeft={2} marginY={1}>
        <SafeText color="red">❌ 工具调用数据无效</SafeText>
      </Box>
    )
  }

  // 如果工具执行完成且不需要显示详细信息，显示状态概览
  if (!isExecuting && toolCall.result && !showDetailedInfo) {
    const summary = generateToolSummary(displayData.safeToolName, toolCall.args, toolCall.result);
    return (
      <Box flexDirection="column" marginLeft={2} marginY={1}>
        <StatusMessage variant={summary.variant}>
          {summary.message}
        </StatusMessage>
      </Box>
      
    );
  }

  // 如果工具正在执行且不需要显示详细信息，显示简洁的执行状态
  if (isExecuting && !showDetailedInfo) {
    const actionSummary = generateActionSummary(displayData.safeToolName, toolCall.args);
    return (
      <Box flexDirection="column" marginLeft={2} marginY={1}>
        <Box alignItems="center">
          <SafeText color="magenta" bold>
            {displayData.toolIcon} {displayData.safeToolName}
          </SafeText>
          <SafeText color="gray"> • </SafeText>
          {/* <SafeText color="yellow">
            ⏳ 执行中...
          </SafeText> */}
          <Spinner label="执行中..." />
        </Box>
        <Box marginTop={1}>
          <SafeText color="gray">{actionSummary}</SafeText>
        </Box>
        <Box marginTop={1}>
          <SafeText color="yellow">▰▰▰▰▰▰▰▰▰▰</SafeText>
        </Box>
      </Box>
    );
  }

  // console.log("🔍 ToolCallDisplay: About to render with data:", displayData)

  return (
    <Box flexDirection="column" marginLeft={2} marginY={1}>
      {/* Tool Animation */}
      <ToolAnimation 
        toolName={displayData.safeToolName}
        isExecuting={isExecuting}
      />

      {/* Tool Header */}
      <Box alignItems="center">
        <SafeText color="magenta" bold>
          {displayData.toolIcon} {displayData.safeToolName}
        </SafeText>
        <SafeText color="gray"> • </SafeText>
        <SafeText color={displayData.status.color as any}>
          {displayData.status.icon} {displayData.status.text}
        </SafeText>
      </Box>

      {/* Tool Arguments */}
      {displayData.shouldShowArgs && (
        <Box marginTop={1} flexDirection="column">
          <SafeText color="cyan" dimColor>📝 参数:</SafeText>
          <Box marginLeft={2}>
            <SafeText color="gray">{displayData.argsText}</SafeText>
          </Box>
        </Box>
      )}

      {/* Tool Result */}
      {displayData.shouldShowResult && (
        <Box marginTop={1} flexDirection="column">
          <SafeText color="green" dimColor>📤 结果:</SafeText>
          <Box marginLeft={2}>
            <SafeText color="white">{displayData.resultText}</SafeText>
          </Box>
        </Box>
      )}

      {/* Execution Progress Bar (for executing tools) */}
      {isExecuting && (
        <Box marginTop={1}>
          <SafeText color="yellow">▰▰▰▰▰▰▰▰▰▰</SafeText>
        </Box>
      )}
    </Box>
  )
} 