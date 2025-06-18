import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { AppConfig, ModelConfig } from '../types/index.js';

// 默认配置
const defaultConfig: AppConfig = {
  model: {
    name: "deepseek-v3-250324",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    apiKey: "",
    streaming: true
  }
};

// 配置文件路径
const CONFIG_FILE_PATH = path.join(process.cwd(), 'config.yaml');

/**
 * 读取配置文件
 * @returns 配置对象
 */
export function loadConfig(): AppConfig {
  try {
    // 检查配置文件是否存在
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      console.warn(`配置文件 ${CONFIG_FILE_PATH} 不存在，使用默认配置`);
      return defaultConfig;
    }

    // 读取配置文件内容
    const configContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
    
    // 解析YAML内容
    const parsedConfig = yaml.load(configContent) as AppConfig;
    
    // 验证配置完整性
    if (!parsedConfig || !parsedConfig.model) {
      console.warn('配置文件格式不正确，使用默认配置');
      return defaultConfig;
    }

    // 合并默认配置和用户配置
    const mergedConfig: AppConfig = {
      model: {
        ...defaultConfig.model,
        ...parsedConfig.model
      }
    };

    return mergedConfig;
  } catch (error) {
    console.error('读取配置文件时发生错误:', error);
    console.warn('使用默认配置');
    return defaultConfig;
  }
}

/**
 * 保存配置到文件
 * @param config 配置对象
 */
export function saveConfig(config: AppConfig): void {
  try {
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 80,
      noRefs: true
    });
    
    fs.writeFileSync(CONFIG_FILE_PATH, yamlContent, 'utf8');
    console.log('配置已保存到', CONFIG_FILE_PATH);
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
  if (!config.model) {
    return false;
  }
  
  if (!config.model.name || !config.model.baseURL || !config.model.apiKey) {
    return false;
  }
  
  return true;
}

// 导出默认配置实例
export const config = loadConfig();

// 导出配置获取函数
export function getConfig(): AppConfig {
  return config;
}

export function getModelConfig(): ModelConfig {
  return config.model;
}

// 导出配置更新函数
export function updateConfig(updates: Partial<AppConfig>): void {
  Object.assign(config, updates);
  saveConfig(config);
}

export function updateModelConfig(updates: Partial<ModelConfig>): void {
  Object.assign(config.model, updates);
  saveConfig(config);
}
