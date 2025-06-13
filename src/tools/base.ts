import { Tool } from "@langchain/core/tools";
import { Logger } from "@/utils/logger";

export abstract class BaseTool extends Tool {
  protected logger: Logger;

  constructor() {
    super();
    this.logger = new Logger();
  }

  protected logError(error: Error): void {
    this.logger.error(`[${this.name}] ${error.message}`);
  }

  protected logInfo(message: string): void {
    this.logger.info(`[${this.name}] ${message}`);
  }
} 