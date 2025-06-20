import { ChatOpenAI } from "@langchain/openai";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { getModelConfig } from "@/config/config.js";
import type { ModelConfig } from "@/types/index.js";
import { createWeatherTool } from "@/utils/tools/weather.js";
import { createFileManagerTool } from "@/utils/tools/file-manager.js";
import { applyWarningFilter } from "@/utils/warning-filter.js";

// 应用 warning 过滤器，屏蔽 token 计算相关的警告
applyWarningFilter();

// 创建流式输出处理器
const setupStreamingModel = () => {
  let fullResponse = "";

  const callbackManager = CallbackManager.fromHandlers({
    handleLLMNewToken: (token: string) => {
      process.stdout.write(token); // 实时输出令牌
      fullResponse += token; // 收集完整响应
    },
    handleLLMEnd: () => {
    },
    handleLLMError: (err: Error) => {
      // 忽略 token 计算相关的错误
      if (err.message.includes("token") || err.message.includes("Unknown model")) {
        return;
      }
      console.error("\n[流式输出错误]", err);
    }
  });

  try {
    // 从配置文件获取模型配置
    const modelConfig: ModelConfig = getModelConfig();
    
    console.log("使用模型配置:", {
      name: modelConfig.name,
      baseURL: modelConfig.baseURL,
      streaming: modelConfig.streaming
    });

    return {
      model: new ChatOpenAI({
        modelName: modelConfig.name,
        openAIApiKey: modelConfig.apiKey,
        configuration: {
          baseURL: modelConfig.baseURL
        },
        streaming: modelConfig.streaming, // 使用配置文件中的流式设置
        callbacks: callbackManager, // 使用回调管理器
        maxTokens: -1, // 禁用 token 限制
        modelKwargs: {
          tokenizer: "cl100k_base",
          token_usage: false // 禁用 token 计算
        }
      }),
      getFullResponse: () => fullResponse
    };
  } catch (error) {
    // 如果是 token 计算相关的错误，返回一个空模型
    if (error instanceof Error && 
        (error.message.includes("token") || 
         error.message.includes("Unknown model"))) {
      
      const modelConfig: ModelConfig = getModelConfig();
      
      return {
        model: new ChatOpenAI({
          modelName: modelConfig.name,
          openAIApiKey: modelConfig.apiKey,
          configuration: {
            baseURL: modelConfig.baseURL
          },
          streaming: modelConfig.streaming,
          callbacks: callbackManager
        }),
        getFullResponse: () => fullResponse
      };
    }
    throw error;
  }
};

// 主执行函数
export const run = async (userMessage?: string) => {
  try {
    const { model, getFullResponse } = setupStreamingModel();
    
    // 创建工具列表
    const tools = [
      createWeatherTool(),
      createFileManagerTool()
    ];
    
    const agent = createReactAgent({
      llm: model,
      tools: tools,
      checkpointSaver: new MemorySaver()
    });

    // 使用传入的消息或默认消息
    const prompt = userMessage || "帮我生成一个python代码计算加法，并保存";
    console.log("用户输入:", prompt);
    
    const messages = [new HumanMessage(prompt)];
    
    try {
      // 使用 stream 方法获取流式响应
      const responseStream = await agent.stream(
        { messages },
        { configurable: { thread_id: "42" } }
      );
      
      // 遍历流式响应
      for await (const chunk of responseStream) {
        if (chunk?.content) {
          const content = typeof chunk.content === 'string' 
            ? chunk.content 
            : JSON.stringify(chunk.content);
        }
      }
    } catch (error) {
      // 忽略 token 计算相关的错误
      if (error instanceof Error && 
          (error.message.includes("token") || 
           error.message.includes("Unknown model"))) {
        return;
      }
      // 其他错误正常抛出
      throw error;
    }
  } catch (error) {
    // 忽略 token 计算相关的错误
    if (error instanceof Error && 
        (error.message.includes("token") || 
         error.message.includes("Unknown model"))) {
      return;
    }
    console.error("请求失败:", error);
  }
};