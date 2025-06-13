import { z } from "zod";
import { BaseTool } from "./base";
import { ByteCraftError, ErrorType } from "@/types";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const CodeGeneratorSchema = z.object({
  prompt: z.string(),
  language: z.string().optional(),
  framework: z.string().optional(),
});

export class CodeGeneratorTool extends BaseTool {
  name = "code_generator";
  description = "用于生成代码的工具。输入格式：{ prompt: string, language?: string, framework?: string }";
  private model: ChatOpenAI;

  constructor() {
    super();
    this.model = new ChatOpenAI({
      modelName: "deepseek-v3-250324",
      temperature: 0,
      openAIApiKey: process.env.DEEPSEEK_V3_API_KEY,
      configuration: {
        baseURL: "https://ark.cn-beijing.volces.com/api/v3"
      }
    });
  }

  protected async _call(input: string): Promise<string> {
    try {
      const { prompt, language, framework } = CodeGeneratorSchema.parse(
        JSON.parse(input)
      );

      const systemPrompt = `你是一个专业的代码生成助手。请根据用户的提示生成代码。
${language ? `使用 ${language} 语言。` : ""}
${framework ? `使用 ${framework} 框架。` : ""}
只返回代码，不要包含任何解释。`;

      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(prompt)
      ]);

      return response.content.toString();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ByteCraftError(
          `输入格式错误: ${error.message}`,
          ErrorType.VALIDATION_ERROR
        );
      }
      throw error;
    }
  }
} 