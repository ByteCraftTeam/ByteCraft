import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { AppConfig, ModelConfig, ModelsConfig, ContextManagerConfig, DebugConfig } from '../types/index.js';

// 默认配置
const defaultConfig: AppConfig = {
  models: {
    "deepseek-v3": {
      name: "deepseek-v3-250324",
      baseURL: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
      apiKey: "",
      streaming: true
    }
  },
  defaultModel: "deepseek-v3",
  tools: {}
};

// 默认配置文件路径
const DEFAULT_CONFIG_FILE_PATH = path.join(process.cwd(), 'config.yaml');

// 当前使用的配置文件路径
let currentConfigPath: string = DEFAULT_CONFIG_FILE_PATH;

// 缓存的配置实例
let cachedConfig: AppConfig | null = null;

/**
 * 设置配置文件路径
 * @param configPath 配置文件路径
 */
export function setConfigPath(configPath: string): void {
  const resolvedPath = path.resolve(configPath);
  if (currentConfigPath !== resolvedPath) {
    currentConfigPath = resolvedPath;
    // 清除缓存，强制重新加载配置
    cachedConfig = null;
    console.log(`📁 配置文件路径已设置为: ${resolvedPath}`);
  }
}

/**
 * 获取当前配置文件路径
 * @returns 当前配置文件路径
 */
export function getConfigPath(): string {
  return currentConfigPath;
}

/**
 * 读取配置文件
 * @param configPath 可选的配置文件路径，如果不提供则使用当前设置的路径
 * @returns 配置对象
 */
export function loadConfig(configPath?: string): AppConfig {
  // 如果指定了新的配置文件路径，更新当前路径
  if (configPath) {
    setConfigPath(configPath);
  }

  // 如果已有缓存配置，直接返回
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    // 检查配置文件是否存在
    if (!fs.existsSync(currentConfigPath)) {
      console.warn(`配置文件 ${currentConfigPath} 不存在，使用默认配置`);
      cachedConfig = defaultConfig;
      return cachedConfig;
    }

    // 读取配置文件内容
    const configContent = fs.readFileSync(currentConfigPath, 'utf8');
    
    // 解析YAML内容
    const parsedConfig = yaml.load(configContent) as AppConfig;
    
    // 验证配置完整性
    if (!parsedConfig || !parsedConfig.models) {
      console.warn('配置文件格式不正确，使用默认配置');
      cachedConfig = defaultConfig;
      return cachedConfig;
    }

    // 合并默认配置和用户配置
    const mergedConfig: AppConfig = {
      models: {
        ...defaultConfig.models,
        ...parsedConfig.models
      },
      defaultModel: parsedConfig.defaultModel || defaultConfig.defaultModel,
      tools: parsedConfig.tools || defaultConfig.tools,
      contextManager: parsedConfig.contextManager,
      debug: parsedConfig.debug
    };
    // console.log("mergedConfig", mergedConfig);
    // 验证合并后的配置
    if (!validateConfig(mergedConfig)) {
      console.warn('合并后的配置验证失败，使用默认配置');
      cachedConfig = defaultConfig;
      return cachedConfig;
    }

    cachedConfig = mergedConfig;
    console.log(`✅ 已加载配置文件: ${currentConfigPath}`);
    return cachedConfig;
  } catch (error) {
    console.error(`读取配置文件 ${currentConfigPath} 时发生错误:`, error);
    console.warn('使用默认配置');
    cachedConfig = defaultConfig;
    return cachedConfig;
  }
}

/**
 * 保存配置到文件
 * @param config 配置对象
 * @param configPath 可选的保存路径，如果不提供则使用当前配置文件路径
 */
export function saveConfig(config: AppConfig, configPath?: string): void {
  const savePath = configPath ? path.resolve(configPath) : currentConfigPath;
  
  try {
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 80,
      noRefs: true
    });
    
    fs.writeFileSync(savePath, yamlContent, 'utf8');
    // 清除缓存，下次加载时会重新读取
    cachedConfig = null;
    console.log('配置已保存到', savePath);
  } catch (error) {
    console.error('保存配置文件时发生错误:', error);
    throw error;
  }
}

/**
 * 验证配置是否有效
 * @param config 配置对象
 * @returns 是否有效
 */
export function validateConfig(config: AppConfig): boolean {
  if (!config.models || Object.keys(config.models).length === 0) {
    return false;
  }
  
  // 验证默认模型是否存在
  if (config.defaultModel && !config.models[config.defaultModel]) {
    console.warn(`默认模型 "${config.defaultModel}" 不存在`);
    return false;
  }
  
  // 验证所有模型配置
  for (const [alias, modelConfig] of Object.entries(config.models)) {
    if (!modelConfig.name || !modelConfig.baseURL) {
      console.warn(`模型配置 ${alias} 缺少必要字段 (name 或 baseURL)`);
      return false;
    }
    
    // 检查API Key是否为空（只警告，不阻止使用）
    if (!modelConfig.apiKey) {
      console.warn(`⚠️  模型 ${alias} 的 API Key 为空，请配置有效的 API Key`);
    }
  }
  
  return true;
}

/**
 * 根据别名获取模型配置
 * @param alias 模型别名
 * @returns 模型配置
 */
export function getModelConfig(alias?: string): ModelConfig {
  const config = loadConfig();
  const modelAlias = alias || config.defaultModel;
  
  if (!modelAlias) {
    throw new Error('未指定模型别名且未设置默认模型');
  }
  
  const modelConfig = config.models[modelAlias];
  if (!modelConfig) {
    throw new Error(`模型别名 "${modelAlias}" 不存在。可用模型: ${Object.keys(config.models).join(', ')}`);
  }
  
  return modelConfig;
}

/**
 * 获取所有可用的模型别名
 * @returns 模型别名列表
 */
export function getAvailableModels(): string[] {
  const config = loadConfig();
  return Object.keys(config.models);
}

/**
 * 获取默认模型别名
 * @returns 默认模型别名
 */
export function getDefaultModel(): string | undefined {
  const config = loadConfig();
  return config.defaultModel;
}

/**
 * 获取工具配置
 * @returns 工具配置
 */
export function getToolConfig() {
  const config = loadConfig();
  return config.tools || {};
}

/**
 * 获取Tavily API Key
 * @returns Tavily API Key
 */
export function getTavilyApiKey(): string | undefined {
  const toolConfig = getToolConfig();
  return toolConfig['web-search']?.tavily?.apiKey;
}

/**
 * 清除配置缓存（用于重新加载配置）
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

// 导出默认配置实例
export const config = loadConfig();

// 导出配置获取函数
export function getConfig(): AppConfig {
  return loadConfig();
}

// 导出配置更新函数
export function updateConfig(updates: Partial<AppConfig>): void {
  const currentConfig = loadConfig();
  Object.assign(currentConfig, updates);
  saveConfig(currentConfig);
}

export function updateModelConfig(alias: string, updates: Partial<ModelConfig>): void {
  const currentConfig = loadConfig();
  if (!currentConfig.models[alias]) {
    currentConfig.models[alias] = {
      name: "",
      baseURL: "",
      apiKey: "",
      streaming: true
    };
  }
  Object.assign(currentConfig.models[alias], updates);
  saveConfig(currentConfig);
}

export function setDefaultModel(alias: string): void {
  const currentConfig = loadConfig();
  if (!currentConfig.models[alias]) {
    throw new Error(`模型别名 "${alias}" 不存在`);
  }
  currentConfig.defaultModel = alias;
  saveConfig(currentConfig);
}

/**
 * 获取上下文管理器配置
 * @returns 上下文管理器配置
 */
export function getContextManagerConfig(): ContextManagerConfig {
  const config = loadConfig();
  
  // 如果配置文件中没有配置，返回默认值
  const defaultContextConfig: ContextManagerConfig = {
    maxMessages: 25,
    maxTokens: 64000, // 提高到64k以适应现代大模型
    maxBytes: 100000,
    maxLines: 1000,
    minRecentMessages: 8,
    compressionThreshold: 0.9,
    useConfigTokenLimit: false,
    strategy: "llm_compression_priority" // 默认优先使用LLM压缩
  };
  
  return config.contextManager || defaultContextConfig;
}

/**
 * 获取调试配置
 * @returns 调试配置
 */
export function getDebugConfig(): DebugConfig {
  const config = loadConfig();
  
  // 如果配置文件中没有配置，返回默认值
  const defaultDebugConfig: DebugConfig = {
    enableCompression: true,
    enableCuration: false, // 默认关闭策划功能，因为存在过度过滤的问题
    enablePerformanceLogging: true,
    enableSensitiveFiltering: true
  };
  
  return config.debug || defaultDebugConfig;
}
