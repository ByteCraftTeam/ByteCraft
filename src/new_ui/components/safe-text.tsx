import { Text } from "ink"
import React from "react"

interface SafeTextProps {
  children?: React.ReactNode
  color?: string
  bold?: boolean
  dimColor?: boolean
  backgroundColor?: string
}

export function SafeText({ children, ...props }: SafeTextProps) {
  // 确保内容永远不是空字符串
  let safeContent = children
  
  if (typeof children === 'string') {
    if (children === '' || children.trim() === '') {
      safeContent = ' ' // 用空格替代空字符串
    }
  } else if (children === null || children === undefined) {
    safeContent = ' '
  } else if (Array.isArray(children)) {
    // 处理数组情况
    const validChildren = children.filter(child => 
      child !== null && child !== undefined && child !== ''
    )
    if (validChildren.length === 0) {
      safeContent = ' '
    } else {
      safeContent = validChildren
    }
  }
  
  // 添加调试日志来追踪问题
  if (safeContent === '') {
    // console.log("🚨 SafeText: Still got empty string after processing:", {
    //   originalChildren: children,
    //   safeContent,
    //   props
    // })
    safeContent = ' ' // 强制替换为空格
  }
  
  return <Text {...props}>{safeContent}</Text>
} 