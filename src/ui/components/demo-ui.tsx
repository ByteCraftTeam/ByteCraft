#!/usr/bin/env node

import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { Spinner, StatusMessage } from '@inkjs/ui';
import { CRAFT_LOGO } from '@/utils/art/logo';
import chalk from 'chalk';

// 清除终端输出
console.clear();

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isCode?: boolean;
  language?: string;
  isStreaming?: boolean;
  toolCall?: {
    name: string;
    status: 'loading' | 'success' | 'error' | 'warning' | 'info';
    message: string;
  };
}

const App = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m ByteCraft AI. How can I help you with your code today?\n\nType /model to switch AI models.',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [currentModel, setCurrentModel] = useState('DeepSeek');

  const { exit } = useApp();

  const models = [
    { name: 'DeepSeek', description: 'Fast and efficient coding assistant' },
    { name: 'OpenAI', description: 'Advanced reasoning and analysis' },
    { name: 'Claude', description: 'Creative and detailed explanations' }
  ];

  // 监听程序退出事件
  useEffect(() => {
    const handleExit = () => {
      process.stdout.write('\x1Bc');
    };

    const handleBeforeExit = () => {
      process.stdout.write('\x1Bc');
    };

    process.on('exit', handleExit);
    process.on('beforeExit', handleBeforeExit);
    process.on('SIGINT', () => {
      process.stdout.write('\x1Bc');
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      process.stdout.write('\x1Bc');
      process.exit(0);
    });

    return () => {
      process.off('exit', handleExit);
      process.off('beforeExit', handleBeforeExit);
    };
  }, []);

  useInput((input, key) => {
    if (key.escape) {
      if (showModelSelector) {
        setShowModelSelector(false);
      } else {
        process.stdout.write('\x1Bc');
        exit();
      }
    }

    if (key.ctrl && input === 'c') {
      process.stdout.write('\x1Bc');
      exit();
    }

    if (showModelSelector) {
      // 模型选择模式
      if (key.upArrow) {
        setSelectedModelIndex(prev => (prev > 0 ? prev - 1 : models.length - 1));
      }
      if (key.downArrow) {
        setSelectedModelIndex(prev => (prev < models.length - 1 ? prev + 1 : 0));
      }
      if (key.return) {
        const selectedModel = models[selectedModelIndex];
        setCurrentModel(selectedModel.name);
        setShowModelSelector(false);
        
        // 添加模型切换消息
        const modelMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: `Switched to ${selectedModel.name} model. ${selectedModel.description}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, modelMessage]);
      }
      return;
    }

    // 处理输入
    if (input && input.length > 0 && !key.ctrl && !key.meta) {
      setInputValue(prev => {
        const newValue = prev.slice(0, cursorPosition) + input + prev.slice(cursorPosition);
        setCursorPosition(cursorPosition + input.length);
        
        // 如果正在显示选择器，隐藏它
        if (showModelSelector) {
          setShowModelSelector(false);
        }
        
        return newValue;
      });
    }

    // 处理退格键
    if (key.backspace || key.delete) {
      setInputValue(prev => {
        if (cursorPosition > 0) {
          const newValue = prev.slice(0, cursorPosition - 1) + prev.slice(cursorPosition);
          setCursorPosition(cursorPosition - 1);
          return newValue;
        }
        return prev;
      });
    }

    // 处理方向键
    if (key.leftArrow) {
      setCursorPosition(prev => Math.max(0, prev - 1));
    }
    if (key.rightArrow) {
      setCursorPosition(prev => Math.min(inputValue.length, prev + 1));
    }

    // 处理回车键
    if (key.return) {
      if (showModelSelector) {
        // 在模型选择模式下，回车键由模型选择逻辑处理
        return;
      }
      
      // 检查是否是特殊指令
      if (inputValue.trim() === '/model') {
        setShowModelSelector(true);
        setSelectedModelIndex(0);
        setInputValue('');
        setCursorPosition(0);
      } else if (inputValue.trim() === '/clear') {
        // 清除所有消息，恢复到初始状态
        setMessages([
          {
            id: Date.now().toString(),
            type: 'assistant',
            content: 'Hello! I\'m ByteCraft AI. How can I help you with your code today?\n\nType /model to switch AI models.\nType /clear to clear the conversation.',
            timestamp: new Date(),
          }
        ]);
        setInputValue('');
        setCursorPosition(0);
        setShowModelSelector(false);
      } else if (inputValue.trim()) {
        // 发送普通消息
        sendMessage(inputValue.trim());
        setInputValue('');
        setCursorPosition(0);
      }
    }
  });

  const streamText = (fullText: string, messageId: string) => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < fullText.length) {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: fullText.slice(0, currentIndex + 1) }
            : msg
        ));
        currentIndex++;
      } else {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, isStreaming: false }
            : msg
        ));
        clearInterval(interval);
      }
    }, 20); // 每20ms显示一个字符，比之前的50ms快2.5倍
  };

  const simulateToolCall = (messageId: string) => {
    const tools = [
      {
        name: 'code_analyzer',
        status: 'success' as const,
        message: 'Code analysis completed successfully'
      },
      {
        name: 'dependency_checker',
        status: 'warning' as const,
        message: 'Found outdated dependencies'
      },
      {
        name: 'security_scanner',
        status: 'error' as const,
        message: 'Security vulnerabilities detected'
      },
      {
        name: 'performance_optimizer',
        status: 'info' as const,
        message: 'Performance optimization suggestions available'
      }
    ];

    const randomTool = tools[Math.floor(Math.random() * tools.length)];

    // 先显示loading状态
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, toolCall: { ...randomTool, status: 'loading' } }
        : msg
    ));

    // 3秒后显示结果
    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, toolCall: randomTool }
          : msg
      ));
    }, 3000);
  };

  const sendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    // 模拟AI回复
    setTimeout(() => {
      const responses = [
        {
          content: `Here's how you can solve that:\n\n\`\`\`javascript\nfunction solution(input) {\n  // Your code here\n  return result;\n}\n\`\`\``,
          isCode: true,
          language: 'javascript'
        },
        {
          content: `I understand you're asking about "${content}". Let me help you with that.`,
          isCode: false
        },
        {
          content: `\`\`\`python\ndef process_data(data):\n    result = []\n    for item in data:\n        if item > 0:\n            result.append(item * 2)\n    return result\n\`\`\``,
          isCode: true,
          language: 'python'
        }
      ];

      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        isCode: randomResponse.isCode,
        language: randomResponse.language,
        isStreaming: true,
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);

      // 开始流式生成
      streamText(randomResponse.content, assistantMessage.id);

      // 模拟工具调用
      simulateToolCall(assistantMessage.id);
    }, 1000 + Math.random() * 2000);
  };

  const renderMessage = (message: Message) => {
    const isUser = message.type === 'user';

    return (
      <Box key={message.id} flexDirection="column" marginY={1}>
        <Box marginBottom={1}>
          <Text color={isUser ? 'blue' : 'green'} bold>
            {isUser ? 'You:' : 'AI:'}
          </Text>
          {message.isStreaming && (
            <Text color="yellow"> (typing...)</Text>
          )}
        </Box>
        
        <Box marginLeft={2}>
          {message.isCode ? (
            <Text color="cyan">
              {message.content}
            </Text>
          ) : (
            <Text color="white">{message.content}</Text>
          )}
        </Box>

        {/* 工具调用状态 */}
        {message.toolCall && (
          <Box marginTop={1} marginLeft={2}>
            {message.toolCall.status === 'loading' ? (
              <Box alignItems="center">
                <Spinner label={`Calling ${message.toolCall.name}...`} />
              </Box>
            ) : (
              <StatusMessage variant={message.toolCall.status}>
                {message.toolCall.message}
              </StatusMessage>
            )}
          </Box>
        )}
      </Box>
    );
  };

  const renderModelSelector = () => (
    <Box flexDirection="column" marginBottom={1}>
      <Box borderStyle="round" paddingX={1} paddingY={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>Select AI Model:</Text>
        </Box>
        {models.map((model, index) => (
          <Box key={model.name} marginY={0}>
            <Text color={index === selectedModelIndex ? 'green' : 'white'}>
              {index === selectedModelIndex ? '▶ ' : '  '}{model.name}
            </Text>
            <Text color="gray"> - {model.description}</Text>
          </Box>
        ))}
        <Box marginTop={1}>
          <Text color="gray">↑↓ Navigate | Enter Select | ESC Cancel</Text>
        </Box>
      </Box>
    </Box>
  );

  const renderInput = () => {
    const beforeCursor = inputValue.slice(0, cursorPosition);
    const afterCursor = inputValue.slice(cursorPosition);
    const cursorChar = cursorPosition < inputValue.length ? inputValue[cursorPosition] : ' ';

    return (
      <Box flexDirection="column" marginTop={2}>
        <Box borderStyle="round" paddingX={1} paddingY={0}>
          <Text color="green" bold>You: </Text>
          <Text color="white">{beforeCursor}</Text>
          <Text color="white" backgroundColor="green">{cursorChar}</Text>
          <Text color="white">{afterCursor}</Text>
        </Box>
        
        {isTyping && (
          <Box marginTop={1} alignItems="center">
            <Spinner label="AI is thinking" />
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={2}>
      {/* Logo */}
      <Box marginBottom={3} justifyContent="center">
        <Text>{CRAFT_LOGO}</Text>
      </Box>

      {/* Current Model */}
      <Box marginBottom={2} justifyContent="center">
        <Text color="yellow" bold>Current Model: {currentModel}</Text>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1}>
        {messages.map(renderMessage)}
      </Box>

      {/* Model Selector (if active) */}
      {showModelSelector && renderModelSelector()}

      {/* Input */}
      {renderInput()}
    </Box>
  );
};

render(<App />);
