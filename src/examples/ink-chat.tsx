import React, { useState, useRef } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { AgentLoop, StreamingCallback } from '../utils/agent-loop.js';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  toolCalls?: Array<{ name: string; args: any }>;
  toolResults?: Array<{ name: string; result: any }>;
};

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentLoop] = useState(() => new AgentLoop('deepseek-v3'));
  const [streamingMsg, setStreamingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const streamingRef = useRef('');
  const { exit } = useApp();

  useInput((inputKey, key) => {
    if (key.return && !isLoading) {
      if (input.trim().toLowerCase() === '/exit') {
        exit();
        return;
      }
      handleSend();
    }
  });

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    setMessages((msgs) => [...msgs, { role: 'user', content: input }]);
    setInput('');
    setIsLoading(true);
    setStreamingMsg('');
    streamingRef.current = '';

    const assistantMsgIdx = messages.length + 1;
    setMessages((msgs) => [...msgs, { role: 'assistant', content: '', streaming: true }]);

    const callback: StreamingCallback = {
      onToken: (token) => {
        streamingRef.current += token;
        setStreamingMsg(streamingRef.current);
        setMessages((msgs) =>
          msgs.map((msg, idx) =>
            idx === assistantMsgIdx ? { ...msg, content: streamingRef.current, streaming: true } : msg
          )
        );
      },
      onToolCall: (toolName, args) => {
        setMessages((msgs) =>
          msgs.map((msg, idx) =>
            idx === assistantMsgIdx
              ? {
                  ...msg,
                  toolCalls: [...(msg.toolCalls || []), { name: toolName, args }]
                }
              : msg
          )
        );
      },
      onToolResult: (toolName, result) => {
        setMessages((msgs) =>
          msgs.map((msg, idx) =>
            idx === assistantMsgIdx
              ? {
                  ...msg,
                  toolResults: [...(msg.toolResults || []), { name: toolName, result }]
                }
              : msg
          )
        );
      },
      onComplete: (final) => {
        setIsLoading(false);
        setStreamingMsg('');
        setMessages((msgs) =>
          msgs.map((msg, idx) =>
            idx === assistantMsgIdx ? { ...msg, content: final, streaming: false } : msg
          )
        );
      },
      onError: (err) => {
        setIsLoading(false);
        setError(err.message);
        setMessages((msgs) =>
          msgs.map((msg, idx) =>
            idx === assistantMsgIdx ? { ...msg, content: `❌ 错误: ${err.message}`, streaming: false } : msg
          )
        );
      }
    };

    try {
      await agentLoop.processMessage(input, callback);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || String(err));
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="cyanBright">ByteCraft CLI 对话 (输入 /exit 退出)</Text>
      <Box flexDirection="column" marginTop={1} marginBottom={1}>
        {messages.length === 0 && <Text dimColor>开始你的对话吧！</Text>}
        {messages.map((msg, idx) => (
          <Box key={idx} flexDirection="column" marginBottom={1}>
            <Text color={msg.role === 'user' ? 'green' : 'yellow'}>
              {msg.role === 'user' ? '你：' : 'AI：'}
            </Text>
            <Text>
              {msg.content}
              {msg.streaming && <Text color="gray"> ▍</Text>}
            </Text>
            {msg.toolCalls &&
              msg.toolCalls.map((tool, i) => (
                <Text key={i} color="blue">
                  🛠️ 工具调用: {tool.name} {JSON.stringify(tool.args)}
                </Text>
              ))}
            {msg.toolResults &&
              msg.toolResults.map((tool, i) => (
                <Text key={i} color="magenta">
                  ✅ 工具结果: {tool.name} {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result)}
                </Text>
              ))}
          </Box>
        ))}
      </Box>
      {error && (
        <Text color="red">
          错误: {error}
        </Text>
      )}
      <Box>
        <Text color="blueBright">{isLoading ? 'AI 正在思考...' : '>'} </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          placeholder="请输入内容，回车发送"
          focus={!isLoading}
        />
      </Box>
    </Box>
  );
};

render(<Chat />);