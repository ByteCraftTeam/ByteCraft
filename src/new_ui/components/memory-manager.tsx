import { useEffect, useRef, useCallback } from "react"

interface MemoryManagerProps {
  messages: any[]
  maxMessages?: number
  cleanupInterval?: number
  onCleanup?: (cleaned: number) => void
}

export function MemoryManager({ 
  messages, 
  maxMessages = 1000, 
  cleanupInterval = 300000, // 5分钟
  onCleanup 
}: MemoryManagerProps) {
  const lastCleanupRef = useRef<number>(Date.now())
  const isMountedRef = useRef(true)
  
  // 清理过期消息的函数
  const cleanupMessages = useCallback(() => {
    if (!isMountedRef.current) return
    
    const now = Date.now()
    if (now - lastCleanupRef.current < cleanupInterval) return
    
    const messageCount = messages.length
    if (messageCount > maxMessages) {
      const toRemove = messageCount - maxMessages
      // console.log(`🧹 MemoryManager: 清理 ${toRemove} 条旧消息`)
      onCleanup?.(toRemove)
      lastCleanupRef.current = now
    }
  }, [messages.length, maxMessages, cleanupInterval, onCleanup])
  
  // 强制垃圾回收（如果可用）
  const forceGarbageCollection = useCallback(() => {
    if (typeof global !== 'undefined' && global.gc) {
      try {
        global.gc()
        // console.log('🧹 MemoryManager: 强制垃圾回收完成')
      } catch (error) {
        // 忽略GC错误
      }
    }
  }, [])
  
  // 定期清理
  useEffect(() => {
    const interval = setInterval(() => {
      cleanupMessages()
      // 每10分钟尝试一次垃圾回收
      if (Date.now() % 600000 < cleanupInterval) {
        forceGarbageCollection()
      }
    }, cleanupInterval)
    
    return () => {
      clearInterval(interval)
      isMountedRef.current = false
    }
  }, [cleanupMessages, cleanupInterval, forceGarbageCollection])
  
  // 当消息数量超过阈值时立即清理
  useEffect(() => {
    if (messages.length > maxMessages * 1.2) {
      cleanupMessages()
    }
  }, [messages.length, maxMessages, cleanupMessages])
  
  // 这个组件不渲染任何内容
  return null
} 