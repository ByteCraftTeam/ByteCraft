import { createFileManagerTool } from "./file-manager.js";
import { createCodeExecutorTool } from "./code-executor.js";
import { createWeatherTool } from "./weather.js";


export const tools = [
  createFileManagerTool(),
  createCodeExecutorTool(),
  createWeatherTool(),
];