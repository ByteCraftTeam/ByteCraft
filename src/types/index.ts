export enum ErrorType {
  AI_ERROR = "AI_ERROR",
  FILE_ERROR = "FILE_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
}

export class ByteCraftError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public cause?: Error
  ) {
    super(message);
    this.name = "ByteCraftError";
  }
}

export interface IConfig {
  model: {
    name: string;
    temperature: number;
    maxTokens: number;
  };
  tools: {
    enabled: string[];
  };
  logging: {
    level: string;
  };
} 