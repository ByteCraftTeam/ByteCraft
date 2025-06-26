"use client"

import { useState, useEffect } from "react"
import { Text } from "ink"

export function LoadingSpinner() {
  const [frame, setFrame] = useState(0)
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length)
    }, 100)

    return () => clearInterval(timer)
  }, [])

  return <Text color="cyan">{frames[frame]}</Text>
}
