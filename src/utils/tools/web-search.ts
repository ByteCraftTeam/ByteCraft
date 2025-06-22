import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getTavilyApiKey } from "@/config/config.js";
const Tavily_API_KEY = "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"
/**
 * 网络搜索工具
 * 使用Tavily API进行网络搜索
 */
export function createWebSearchTool() {
  return new DynamicStructuredTool({
    name: "web_search",
    description: "搜索网络获取最新的信息和新闻。适用于需要最新信息、新闻、技术文档、产品信息等场景。",
    schema: z.object({
      query: z.string().describe("搜索查询词，应该具体且明确"),
      search_depth: z.enum(["basic", "advanced"]).optional().describe("搜索深度：basic(基础搜索) 或 advanced(高级搜索)"),
      max_results: z.number().optional().describe("最大结果数量，默认5个"),
      topic: z.enum(["general", "news"]).optional().describe("搜索主题分类：general(通用) 或 news(新闻)"),
      days: z.number().optional().describe("搜索最近几天的内容，默认7天"),
      include_answer: z.boolean().optional().describe("是否包含AI生成的答案，默认true"),
      include_raw_content: z.boolean().optional().describe("是否包含原始内容，默认false"),
      chunks_per_source: z.number().optional().describe("每个来源的文本块数量，默认3")
    }),
    func: async ({ 
      query, 
      search_depth = "basic", 
      max_results = 5, 
      topic = "general",
      days = 7,
      include_answer = true,
      include_raw_content = false,
      chunks_per_source = 3
    }) => {
      try {
        const apiKey = Tavily_API_KEY;

        console.log(`🔍 正在搜索: ${query}`);
        
        // 构建请求体
        const requestBody = {
          query: query,
          topic: topic,
          search_depth: search_depth,
          chunks_per_source: chunks_per_source,
          max_results: max_results,
          time_range: null,
          days: days,
          include_answer: include_answer,
          include_raw_content: include_raw_content,
          include_images: false,
          include_image_descriptions: false,
          include_domains: [],
          exclude_domains: [],
          country: null
        };

        // 发送POST请求到Tavily API
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Tavily API请求失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        
        // 格式化搜索结果
        let result = `🔍 搜索结果: "${query}"\n`;
        result += `📊 搜索参数: ${search_depth}搜索, ${topic}主题, 最近${days}天\n\n`;
        
        if (data.answer) {
          result += `📝 答案: ${data.answer}\n\n`;
        }
        
        if (data.results && data.results.length > 0) {
          result += `📋 找到 ${data.results.length} 个结果:\n\n`;
          
          data.results.forEach((item: any, index: number) => {
            result += `${index + 1}. ${item.title}\n`;
            result += `   链接: ${item.url}\n`;
            if (item.published_date) {
              result += `   发布时间: ${item.published_date}\n`;
            }
            if (item.score) {
              result += `   相关度: ${(item.score * 100).toFixed(1)}%\n`;
            }
            if (item.content) {
              result += `   摘要: ${item.content.substring(0, 200)}${item.content.length > 200 ? '...' : ''}\n`;
            }
            result += `\n`;
          });
        } else {
          result += "❌ 未找到相关结果";
        }

        return result;
      } catch (error) {
        console.error('网络搜索失败:', error);
        return `❌ 搜索失败: ${error instanceof Error ? error.message : '未知错误'}`;
      }
    }
  });
}

/**
 * 新闻搜索工具
 * 专门用于搜索新闻信息
 */
export function createNewsSearchTool() {
  return new DynamicStructuredTool({
    name: "news_search",
    description: "搜索最新的新闻信息。适用于需要了解最新事件、行业动态、技术新闻等场景。",
    schema: z.object({
      query: z.string().describe("新闻搜索查询词"),
      max_results: z.number().optional().describe("最大结果数量，默认5个"),
      days: z.number().optional().describe("搜索最近几天的新闻，默认7天"),
      include_answer: z.boolean().optional().describe("是否包含AI生成的总结，默认true")
    }),
    func: async ({ 
      query, 
      max_results = 5, 
      days = 7,
      include_answer = true 
    }) => {
      try {
        const apiKey = Tavily_API_KEY;

        console.log(`📰 正在搜索新闻: ${query}`);
        
        // 构建请求体
        const requestBody = {
          query: query,
          topic: "news",
          search_depth: "basic",
          chunks_per_source: 3,
          max_results: max_results,
          time_range: null,
          days: days,
          include_answer: include_answer,
          include_raw_content: false,
          include_images: false,
          include_image_descriptions: false,
          include_domains: ["news.google.com", "reuters.com", "bbc.com", "cnn.com", "techcrunch.com", "arstechnica.com", "theverge.com"],
          exclude_domains: [],
          country: null
        };

        // 发送POST请求到Tavily API
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Tavily API请求失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        
        // 格式化新闻搜索结果
        let result = `📰 新闻搜索结果: "${query}"\n`;
        result += `📊 搜索参数: 新闻主题, 最近${days}天\n\n`;
        
        if (data.answer) {
          result += `📝 总结: ${data.answer}\n\n`;
        }
        
        if (data.results && data.results.length > 0) {
          result += `📋 找到 ${data.results.length} 条新闻:\n\n`;
          
          data.results.forEach((item: any, index: number) => {
            result += `${index + 1}. ${item.title}\n`;
            result += `   来源: ${item.url}\n`;
            if (item.published_date) {
              result += `   发布时间: ${item.published_date}\n`;
            }
            if (item.score) {
              result += `   相关度: ${(item.score * 100).toFixed(1)}%\n`;
            }
            if (item.content) {
              result += `   摘要: ${item.content.substring(0, 150)}${item.content.length > 150 ? '...' : ''}\n`;
            }
            result += `\n`;
          });
        } else {
          result += "❌ 未找到相关新闻";
        }

        return result;
      } catch (error) {
        console.error('新闻搜索失败:', error);
        return `❌ 新闻搜索失败: ${error instanceof Error ? error.message : '未知错误'}`;
      }
    }
  });
}

