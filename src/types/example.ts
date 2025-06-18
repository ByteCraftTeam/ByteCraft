import { config, getConfig, getModelConfig } from '@/config/config.js';
import type { 
  AppConfig, 
  ModelConfig, 
  ChatMessage, 
  ChatResponse,
  FileInfo,
  UIState,
  Result 
} from '@/types/index.js';

// 示例：使用配置类型
function processConfig(appConfig: AppConfig): void {
  console.log('处理应用配置...');
  console.log('模型名称:', appConfig.model.name);
  console.log('API URL:', appConfig.model.baseURL);
}

// 示例：使用聊天消息类型
function createChatMessage(content: string, role: 'user' | 'assistant' | 'system' = 'user'): ChatMessage {
  return {
    role,
    content,
    timestamp: new Date()
  };
}

// 示例：使用文件信息类型
function analyzeFile(fileInfo: FileInfo): void {
  console.log(`文件: ${fileInfo.name}`);
  console.log(`路径: ${fileInfo.path}`);
  console.log(`大小: ${fileInfo.size} bytes`);
  console.log(`类型: ${fileInfo.type}`);
}

// 示例：使用UI状态类型
function updateUIState(currentState: UIState, updates: Partial<UIState>): UIState {
  return { ...currentState, ...updates };
}

// 示例：使用Result类型进行错误处理
function safeOperation<T>(operation: () => T): Result<T> {
  try {
    const data = operation();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

// 示例：使用所有类型
function demonstrateTypes(): void {
  // 1. 配置类型
  const appConfig = getConfig();
  processConfig(appConfig);

  // 2. 聊天消息类型
  const userMessage = createChatMessage('你好，AI助手！');
  const assistantMessage = createChatMessage('你好！我是你的AI助手。', 'assistant');
  
  console.log('用户消息:', userMessage);
  console.log('助手消息:', assistantMessage);

  // 3. 文件信息类型
  const fileInfo: FileInfo = {
    path: '/path/to/file.ts',
    name: 'file.ts',
    size: 1024,
    type: 'file',
    extension: '.ts',
    lastModified: new Date()
  };
  
  analyzeFile(fileInfo);

  // 4. UI状态类型
  const initialState: UIState = {
    isLoading: false,
    error: null,
    currentView: 'chat'
  };
  
  const updatedState = updateUIState(initialState, { isLoading: true });
  console.log('更新后的UI状态:', updatedState);

  // 5. Result类型
  const result = safeOperation(() => {
    // 模拟一个可能失败的操作
    if (Math.random() > 0.5) {
      throw new Error('随机错误');
    }
    return '操作成功';
  });

  if (result.success) {
    console.log('操作结果:', result.data);
  } else {
    console.log('操作失败:', result.error.message);
  }
}

// 运行示例
demonstrateTypes(); 