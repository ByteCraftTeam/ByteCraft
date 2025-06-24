import { Box, Text } from "ink"
import { AVAILABLE_MODELS } from "../app.js"
import { CRAFT_LOGO_LINES } from "../../utils/art/logo.js"

export function WelcomeScreen() {
  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      <Box flexDirection="column" alignItems="center">
        {CRAFT_LOGO_LINES.map((line: { text: string; color: string }, idx: number) => (
          <Text key={idx} color={line.color} bold>{line.text}</Text>
        ))}
      </Box>

      <Box marginTop={2} flexDirection="column" alignItems="center">
        <Text color="green">全自动终端编程Agent</Text>
        <Text color="yellow">开始你的全新编程体验吧！</Text>
      </Box>

      <Box marginTop={2} flexDirection="column">
        <Text color="yellow" bold>
          Available Commands:
        </Text>
        <Text color="white"> /new - Start a new session</Text>
        <Text color="white"> /model - Switch AI model</Text>
        <Text color="white"> /load - Load a session</Text>
        <Text color="white"> /help - Show help</Text>
        <Text color="white"> /exit - Exit the application</Text>
      </Box>

      <Box marginTop={2} flexDirection="column">
        <Text color="magenta" bold>
          Available Models:
        </Text>
        <Text color="white"> {AVAILABLE_MODELS.join(", ")}</Text>
      </Box>

      <Box marginTop={2} flexDirection="column">
        <Text color="blue" bold>
          Enhanced Features:
        </Text>
        <Text color="white"> ↑/↓ - Navigate command history</Text>
        <Text color="white"> Tab - Auto-complete commands</Text>
        <Text color="white"> Esc - Close suggestions</Text>
      </Box>

      <Box marginTop={2}>
        <Text color="gray" dimColor>
          Type your first message to begin coding with AI assistance...
        </Text>
      </Box>
    </Box>
  )
}
