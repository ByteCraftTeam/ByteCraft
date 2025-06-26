import React from 'react'
import { Text, Box } from 'ink'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.log("🔍 ErrorBoundary caught error:", error)
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.log("🔍 ErrorBoundary componentDidCatch:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>❌ 渲染错误</Text>
          <Text color="gray">{this.state.error?.message}</Text>
          <Text color="yellow">请检查控制台了解详细信息</Text>
        </Box>
      )
    }

    return this.props.children
  }
} 