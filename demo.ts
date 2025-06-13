import dotenv from "dotenv";
//创建环境变量
dotenv.config({ path: "../APIKEY.env" });

import { TavilySearch } from "@langchain/tavily";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// Now it's time to use!

function main() {
  let exitflag = 0;
  // Define the tools for the agent to use
  const agentTools = [new TavilySearch({ maxResults: 3 })];
  const agentModel = new ChatOpenAI({
    openAIApiKey: process.env.ARK_API_KEY,
    model: "deepseek-r1-250528",
    temperature: 1,
    timeout: 3000,
    configuration: {
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    },
  });

  // Initialize memory to persist state between graph runs
  const agentCheckpointer = new MemorySaver();
  const agent = createReactAgent({
    llm: agentModel,
    tools: agentTools,
    checkpointSaver: agentCheckpointer,
    prompt: "You are a helpful assistant",
  });

  async function chat(input: string) {
    try {
      const agentFinalState = await agent.invoke(
        { messages: [new HumanMessage(input)] },
        { configurable: { thread_id: "42" } }
      );
      const lastMessage =
        agentFinalState.messages[agentFinalState.messages.length - 1];
      const content = await lastMessage.content; // 确保解析 Promise
      return content;
    } catch (error) {
      console.error("Agent failed:", error);
    }
  }

  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("欢迎使用AI智能编程工具，输入exit退出");

  const askQuestion = () => {
    readline.question("请输入您的问题：", async (input: string) => {
      if (input.toLowerCase() === "exit") {
        exitflag = 1;
        readline.close();
        return;
      }
      try {
        const result = await chat(input);
        console.log("\n助手回答:", result, "\n");
      } catch (error) {
        console.error("发生错误:", error);
      }
      askQuestion();
    });
  };
  askQuestion();
}
main();
