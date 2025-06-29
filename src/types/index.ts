// ========================================
// 配置相关类型
// ========================================

export interface ModelConfig {
  name: string;
  baseURL: string;
  apiKey: string;
  streaming: boolean;
}

export interface ModelsConfig {
  [alias: string]: ModelConfig;
}

export interface ToolConfig {
  'web-search'?: {
    tavily?: {
      apiKey: string;
    };
  };
}

export interface ContextManagerConfig {
  maxMessages: number;
  maxTokens: number;
  maxBytes: number;
  maxLines: number;
  minRecentMessages: number;
  compressionThreshold: number;
  useConfigTokenLimit?: boolean; // 是否使用配置文件的token限制
  strategy?: "sliding_window_only" | "llm_compression_priority" | "hybrid_balanced"; // 策略选择
}

export interface DebugConfig {
  enableCompression: boolean;
  enableCuration: boolean;
  enablePerformanceLogging: boolean;
  enableSensitiveFiltering: boolean;
}

export interface AppConfig {
  models: ModelsConfig;
  defaultModel?: string; // 默认模型别名
  tools?: ToolConfig; // 工具配置
  contextManager?: ContextManagerConfig; // 上下文管理配置
  debug?: DebugConfig; // 调试配置
}

// ========================================
// AI/LLM 相关类型
// ========================================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason?: string;
}

export interface StreamingChatResponse {
  content: string;
  isComplete: boolean;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ========================================
// 文件系统相关类型
// ========================================

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  type: 'file' | 'directory';
  extension?: string;
  lastModified?: Date;
}

export interface ProjectStructure {
  root: string;
  files: FileInfo[];
  directories: FileInfo[];
}

// ========================================
// UI 相关类型
// ========================================

export interface UIState {
  isLoading: boolean;
  error: string | null;
  currentView: 'chat' | 'config' | 'files' | 'help';
}

export interface ChatUIState {
  messages: ChatMessage[];
  inputValue: string;
  isStreaming: boolean;
}

export interface ConfigUIState {
  modelConfig: ModelConfig;
  isEditing: boolean;
}

// ========================================
// 工具函数相关类型
// ========================================

export interface CodeAnalysis {
  language: string;
  complexity: number;
  lines: number;
  functions: number;
  classes: number;
  imports: string[];
}

export interface SearchResult {
  file: string;
  line: number;
  content: string;
  context: string;
}

// ========================================
// 通用类型
// ========================================

export type Result<T, E = Error> = {
  success: true;
  data: T;
} | {
  success: false;
  error: E;
};

export interface PaginationOptions {
  page: number;
  limit: number;
  total?: number;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// ========================================
// 事件相关类型
// ========================================

export interface AppEvent {
  type: string;
  payload: any;
  timestamp: Date;
}

export interface ChatEvent extends AppEvent {
  type: 'chat_message' | 'chat_response' | 'chat_error';
  payload: ChatMessage | ChatResponse | string;
} 