import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { FileSystemTool, CodeGeneratorTool } from "@/tools";
import { Tool } from "@langchain/core/tools";

// 定义工具
class Calculator extends Tool {
  name = "calculator";
  description = "用于执行数学计算";

  async _call(input: string): Promise<string> {
    try {
      return eval(input).toString();
    } catch (error) {
      return "计算错误，请检查输入";
    }
  }
}

class WeatherTool extends Tool {
  name = "weather";
  description = "获取指定城市的天气信息";

  async _call(input: string): Promise<string> {
    // 这里只是一个模拟实现
    return `${input}的天气：晴朗，温度25度`;
  }
}

// 创建 LLM
const model = new ChatOpenAI({
  modelName: "deepseek-v3-250324",
  temperature: 0,
  openAIApiKey: process.env.DEEPSEEK_V3_API_KEY,
  configuration: {
    baseURL: "https://ark.cn-beijing.volces.com/api/v3"
  }
});

// 创建工具
const tools = [new Calculator(), new WeatherTool()];

// 创建 ReAct Agent
class ReActAgent {
  private model: ChatOpenAI;
  private tools: Tool[];
  private messages: (HumanMessage | AIMessage | SystemMessage)[];

  constructor(model: ChatOpenAI, tools: Tool[]) {
    this.model = model;
    this.tools = tools;
    this.messages = [
      new SystemMessage(`你是一个智能助手，可以使用以下工具：
${tools.map(tool => `${tool.name}: ${tool.description}`).join("\n")}

请按照以下格式回复：
思考：<你的思考过程>
行动：<工具名称> 或 回答：<直接回答>
观察：<工具执行结果或直接回答>
思考：<基于观察的思考>
回答：<最终回答>`)
    ];
  }

  async chat(input: string): Promise<string> {
    // 添加用户消息
    this.messages.push(new HumanMessage(input));

    // 获取模型响应
    const response = await this.model.invoke(this.messages);
    this.messages.push(response);

    // 解析响应
    const content = response.content.toString();
    const actionMatch = content.match(/行动：(\w+)/);
    
    if (actionMatch) {
      const toolName = actionMatch[1];
      const tool = this.tools.find(t => t.name === toolName);
      
      if (tool) {
        // 执行工具
        const toolResult = await tool.call(input);
        
        // 添加工具执行结果
        this.messages.push(new SystemMessage(`工具执行结果: ${toolResult}`));
        
        // 获取最终响应
        const finalResponse = await this.model.invoke(this.messages);
        this.messages.push(finalResponse);
        
        return finalResponse.content.toString();
      }
    }
    
    return content;
  }
}

// 使用示例
async function main() {
  const agent = new ReActAgent(model, tools);
  
  // 从命令行获取用户输入
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("欢迎使用智能助手！输入 'exit' 退出。");
  
  const askQuestion = () => {
    readline.question('请输入您的问题: ', async (input: string) => {
      if (input.toLowerCase() === 'exit') {
        readline.close();
        return;
      }

      try {
        const result = await agent.chat(input);
        console.log("\n助手回答:", result, "\n");
      } catch (error) {
        console.error("发生错误:", error);
      }

      askQuestion();
    });
  };

  askQuestion();
}

main().catch(console.error); 