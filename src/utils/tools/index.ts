import { createFileManagerToolV2 } from "./file-manager-tool.js";
import { createProjectAnalyzerTool } from "./project-analyzer.js";
import { createGrepSearchTool } from "./grep-search.js";
import { createCommandExecTool } from "./command-exec.js";
import { loadConfig, getToolConfig } from "../../config/config.js";

// 创建工具列表的函数，确保API key正确初始化
export async function createTools() {
  // 直接加载配置文件
  const config = loadConfig();
  const toolConfig = getToolConfig();
  
  const tools: any[] = [
    // createFileManagerTool(),
    createFileManagerToolV2(),
    createProjectAnalyzerTool(),
    createGrepSearchTool(),
    createCommandExecTool(),
  ];
  
  // 尝试获取Tavily API key
  try {
    const tavilyApiKey = toolConfig['web-search']?.tavily?.apiKey;
    // console.log("🔑 Tavily API Key 状态:", tavilyApiKey ? "已配置" : "未配置");
    
    // 只有在有API key的情况下才添加TavilySearch工具
    if (tavilyApiKey) {
      const { TavilySearch } = await import("@langchain/tavily");
      tools.push(
        new TavilySearch({
          maxResults: 5,
          tavilyApiKey: tavilyApiKey
        })
      );
      // console.log("✅ TavilySearch 工具已添加");
    } else {
      // console.log("⚠️  Tavily API key未配置，跳过TavilySearch工具初始化");
    }
  } catch (error) {
    console.warn('⚠️  Tavily API key未配置或获取失败，跳过TavilySearch工具初始化:', error);
  }

  // console.log(`🎯 工具初始化完成，共加载 ${tools.length} 个工具`);
  return tools;
}

// 延迟初始化工具列表
let toolsCache: any[] | null = null;

export async function getTools() {
  if (!toolsCache) {
    toolsCache = await createTools();
  }
  return toolsCache;
}

// 清除工具缓存（用于重新加载）
export function clearToolsCache(): void {
  toolsCache = null;
}