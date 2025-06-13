import { z } from "zod";
import { BaseTool } from "./base";
import { ByteCraftError, ErrorType } from "../types";

const FileSystemSchema = z.object({
  action: z.enum(["read", "write", "delete"]),
  path: z.string(),
  content: z.string().optional(),
});

export class FileSystemTool extends BaseTool {
  name = "file_system";
  description = "用于读写和删除文件的工具。输入格式：{ action: 'read'|'write'|'delete', path: string, content?: string }";

  constructor() {
    super();
  }

  protected async _call(input: string): Promise<string> {
    try {
      const { action, path, content } = FileSystemSchema.parse(JSON.parse(input));

      switch (action) {
        case "read":
          return await this.readFile(path);
        case "write":
          if (!content) throw new Error("写入文件需要提供content参数");
          return await this.writeFile(path, content);
        case "delete":
          return await this.deleteFile(path);
        default:
          throw new Error(`不支持的操作: ${action}`);
      }
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

  private async readFile(path: string): Promise<string> {
    try {
      const response = await fetch(`file://${path}`);
      if (!response.ok) {
        throw new Error(`读取文件失败: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      this.logError(error as Error);
      throw new ByteCraftError(
        `读取文件失败: ${(error as Error).message}`,
        ErrorType.FILE_ERROR
      );
    }
  }

  private async writeFile(path: string, content: string): Promise<string> {
    try {
      const response = await fetch(`file://${path}`, {
        method: "PUT",
        body: content,
      });
      if (!response.ok) {
        throw new Error(`写入文件失败: ${response.statusText}`);
      }
      return "文件写入成功";
    } catch (error) {
      this.logError(error as Error);
      throw new ByteCraftError(
        `写入文件失败: ${(error as Error).message}`,
        ErrorType.FILE_ERROR
      );
    }
  }

  private async deleteFile(path: string): Promise<string> {
    try {
      const response = await fetch(`file://${path}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`删除文件失败: ${response.statusText}`);
      }
      return "文件删除成功";
    } catch (error) {
      this.logError(error as Error);
      throw new ByteCraftError(
        `删除文件失败: ${(error as Error).message}`,
        ErrorType.FILE_ERROR
      );
    }
  }
} 