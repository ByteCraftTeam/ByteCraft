import React, { memo } from "react"
import { Box, Text } from "ink"

export type StatusVariant = "success" | "error" | "warning" | "info"

interface StatusMessageProps {
  variant: StatusVariant
  children: React.ReactNode
}

export const StatusMessage = memo(function StatusMessage({ variant, children }: StatusMessageProps) {
  const getVariantStyle = () => {
    switch (variant) {
      case "success":
        return {
          icon: "✅",
          color: "green" as const,
          bgColor: "greenBright" as const
        }
      case "error":
        return {
          icon: "❌",
          color: "red" as const,
          bgColor: "redBright" as const
        }
      case "warning":
        return {
          icon: "⚠️",
          color: "yellow" as const,
          bgColor: "yellowBright" as const
        }
      case "info":
        return {
          icon: "ℹ️",
          color: "blue" as const,
          bgColor: "blueBright" as const
        }
      default:
        return {
          icon: "•",
          color: "white" as const,
          bgColor: "white" as const
        }
    }
  }

  const style = getVariantStyle()

  return (
    <Box 
      borderStyle="round" 
      borderColor={style.color}
      paddingX={1}
      paddingY={0}
      marginY={1}
    >
      <Text color={style.color} bold>
        {style.icon} {children}
      </Text>
    </Box>
  )
}) 