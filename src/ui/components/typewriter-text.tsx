"use client"

import { useState, useEffect } from "react"
import { Text } from "ink"

interface TypewriterTextProps {
  text: string
}

export function TypewriterText({ text }: TypewriterTextProps) {
  return (
    <Text>
      {text}
      <Text color="gray">▋</Text>
    </Text>
  )
}
