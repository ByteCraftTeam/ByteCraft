import React, { memo, useEffect, useRef, useState } from "react"
import { Box, Text } from "ink"

interface PerformanceMonitorProps {
  messages: any[]
  renderCount: number
  isVisible?: boolean
}

/**
 * 性能监控组件
 * 监控消息渲染的性能指标
 */
export const PerformanceMonitor = memo(function PerformanceMonitor({ 
  messages, 
  renderCount,
  isVisible = false 
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    messageCount: 0,
    averageRenderTime: 0,
    totalRenders: 0
  });

  const renderStartTime = useRef<number>(0);
  const lastRenderTime = useRef<number>(0);

  // 监控渲染性能
  useEffect(() => {
    const now = performance.now();
    
    if (renderStartTime.current > 0) {
      const renderTime = now - renderStartTime.current;
      lastRenderTime.current = renderTime;
      
      setMetrics(prev => ({
        renderTime,
        messageCount: messages.length,
        averageRenderTime: (prev.averageRenderTime * prev.totalRenders + renderTime) / (prev.totalRenders + 1),
        totalRenders: prev.totalRenders + 1
      }));
    }
    
    renderStartTime.current = now;
  }, [renderCount, messages.length]);

  if (!isVisible) return null;

  return (
    <Box 
      borderStyle="round" 
      borderColor="gray" 
      paddingX={1} 
      paddingY={0}
      marginY={1}
    >
      <Text color="gray" dimColor>
        📊 性能监控 | 
        消息: {metrics.messageCount} | 
        渲染: {metrics.renderTime.toFixed(2)}ms | 
        平均: {metrics.averageRenderTime.toFixed(2)}ms | 
        总渲染: {metrics.totalRenders}
      </Text>
    </Box>
  );
});

/**
 * 渲染计数器组件
 * 用于跟踪组件的渲染次数
 */
export const RenderCounter = memo(function RenderCounter({ 
  componentName,
  isVisible = false 
}: { 
  componentName: string
  isVisible?: boolean 
}) {
  const renderCount = useRef(0);
  
  useEffect(() => {
    renderCount.current += 1;
  });

  if (!isVisible) return null;

  return (
    <Text color="gray" dimColor>
      🔄 {componentName}: {renderCount.current}
    </Text>
  );
});

/**
 * 内存使用监控组件
 * 监控内存使用情况
 */
export const MemoryMonitor = memo(function MemoryMonitor({ 
  isVisible = false 
}: { 
  isVisible?: boolean 
}) {
  const [memoryInfo, setMemoryInfo] = useState({
    used: 0,
    total: 0,
    percentage: 0
  });

  useEffect(() => {
    const updateMemoryInfo = () => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        const used = Math.round(memUsage.heapUsed / 1024 / 1024); // MB
        const total = Math.round(memUsage.heapTotal / 1024 / 1024); // MB
        const percentage = Math.round((used / total) * 100);
        
        setMemoryInfo({ used, total, percentage });
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000); // 每5秒更新一次

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) return null;

  return (
    <Box 
      borderStyle="round" 
      borderColor="blue" 
      paddingX={1} 
      paddingY={0}
      marginY={1}
    >
      <Text color="blue">
        💾 内存: {memoryInfo.used}MB / {memoryInfo.total}MB ({memoryInfo.percentage}%)
      </Text>
    </Box>
  );
}); 