import React from 'react';
import { render } from 'ink';
import { ChatInterface } from './dist/ui/components/chat-interface.js';

// 模拟消息数据
const createMockMessages = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    type: i % 2 === 0 ? 'user' : 'assistant',
    content: `这是第 ${i + 1} 条消息内容，用于测试渲染性能优化效果。`,
    timestamp: new Date(Date.now() - (count - i) * 1000),
    streaming: false
  }));
};

// 测试不同数量的消息渲染性能
const testRenderPerformance = () => {
  console.log('🧪 开始测试渲染性能优化...\n');
  
  const testCases = [5, 20, 50, 100];
  
  testCases.forEach(count => {
    console.log(`📊 测试 ${count} 条消息的渲染性能:`);
    
    const messages = createMockMessages(count);
    const startTime = performance.now();
    
    // 模拟渲染过程
    const { unmount } = render(
      React.createElement(ChatInterface, {
        messages: messages,
        isLoading: false,
        showPerformanceMonitor: true
      })
    );
    
    const renderTime = performance.now() - startTime;
    console.log(`   渲染时间: ${renderTime.toFixed(2)}ms`);
    console.log(`   平均每条消息: ${(renderTime / count).toFixed(2)}ms\n`);
    
    // 清理
    unmount();
  });
  
  console.log('✅ 渲染性能测试完成！');
};

// 测试流式更新时的性能
const testStreamingPerformance = () => {
  console.log('🔄 开始测试流式更新性能...\n');
  
  const baseMessages = createMockMessages(20);
  const streamingMessage = {
    id: 'streaming-msg',
    type: 'assistant',
    content: '',
    timestamp: new Date(),
    streaming: true
  };
  
  const messages = [...baseMessages, streamingMessage];
  
  console.log('📊 测试流式更新时的渲染性能:');
  const startTime = performance.now();
  
  // 模拟多次内容更新
  for (let i = 0; i < 10; i++) {
    const updatedMessages = messages.map(msg => 
      msg.id === 'streaming-msg' 
        ? { ...msg, content: `正在生成内容...${'.'.repeat(i + 1)}` }
        : msg
    );
    
    const { unmount } = render(
      React.createElement(ChatInterface, {
        messages: updatedMessages,
        isLoading: false,
        showPerformanceMonitor: true
      })
    );
    
    unmount();
  }
  
  const totalTime = performance.now() - startTime;
  console.log(`   总更新次数: 10`);
  console.log(`   总时间: ${totalTime.toFixed(2)}ms`);
  console.log(`   平均每次更新: ${(totalTime / 10).toFixed(2)}ms\n`);
  
  console.log('✅ 流式更新性能测试完成！');
};

// 运行测试
testRenderPerformance();
testStreamingPerformance(); 