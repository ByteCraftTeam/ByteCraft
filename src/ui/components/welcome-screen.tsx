import { Box, Text, useStdout } from "ink"
import { AVAILABLE_MODELS } from "../app.js"
import { CRAFT_LOGO_LINES } from "../../utils/art/logo.js"

export function WelcomeScreen() {
  const { stdout } = useStdout()
  const terminalWidth = stdout?.columns || 80

  return (
    <Box 
      flexDirection="column" 
      alignItems="center" 
      justifyContent="center"
      width={terminalWidth}
      paddingY={2}
    >
      {/* Logo 区域 */}
      <Box flexDirection="column" alignItems="center" marginBottom={2}>
        {CRAFT_LOGO_LINES.map((line: { text: string; color: string }, idx: number) => (
          <Text key={idx} color={line.color} bold>{line.text}</Text>
        ))}
      </Box>

      {/* 主标题区域 */}
      {/* <Box marginY={1} flexDirection="column" alignItems="center"> */}
        {/* <Text color="green" bold>全自动终端编程Agent</Text> */}
        {/* <Text color="yellow">开始你的全新编程体验吧！</Text> */}
      {/* </Box> */}

      {/* 可用命令区域 */}
      {/* <Box marginY={1} flexDirection="column" alignItems="center"> */}
        {/* <Text color="cyan" bold>Available Commands:</Text> */}
        {/* <Box flexDirection="column" alignItems="center" marginTop={1}> */}
          {/* <Text color="white">/new - Start a new session</Text> */}
          {/* <Text color="white">/model - Switch AI model</Text> */}
          {/* <Text color="white">/load - Load a session</Text> */}
          {/* <Text color="white">/help - Show help</Text> */}
          {/* <Text color="white">/exit - Exit the application</Text> */}
        {/* </Box> */}
      {/* </Box> */}

      {/* 可用模型区域 */}
      {/* <Box marginY={1} flexDirection="column" alignItems="center">
        <Text color="magenta" bold>Available Models:</Text>
        <Text color="white" wrap="wrap">{AVAILABLE_MODELS.join(", ")}</Text>
      </Box> */}

      {/* 增强功能区域 */}
      <Box marginY={1} flexDirection="column" alignItems="center">
        <Text color="blue" bold>Enhanced Features:</Text>
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Text color="white">↑/↓ - Navigate command history</Text>
          <Text color="white">Tab - Auto-complete commands</Text>
          <Text color="white">Esc - Close suggestions</Text>
        </Box>
      </Box>

      {/* 底部提示 */}
      <Box marginTop={1} alignItems="center">
        <Text color="gray" dimColor>
          Type your first message to begin coding with AI assistance...
        </Text>
      </Box>
    </Box>
  )
}
