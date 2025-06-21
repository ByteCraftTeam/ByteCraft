import prompts from './prompts.json';

export function getSystemPrompt(): string {
  return prompts.system_prompt;
} 