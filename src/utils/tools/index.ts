import { createFileManagerTool } from "./file-manager.js";
import { createWeatherTool } from "./weather.js";

export const tools = [
  createFileManagerTool(),
  createWeatherTool(),
];