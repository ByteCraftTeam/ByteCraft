import { applyWarningFilter } from "../utils/warning-filter.js"

// 立即应用过滤器
applyWarningFilter()

// 额外过滤 process.stderr
const originalStderrWrite = process.stderr.write;
process.stderr.write = function(chunk: any, encoding?: any, callback?: any) {
  const message = chunk.toString();
  if (message.includes('Unknown model') || 
      message.includes('Failed to calculate number of tokens') ||
      message.includes('falling back to approximate count') ||
      message.includes('already exists in this message chunk') ||
      message.includes('field[') && message.includes('] already exists') ||
      message.includes('value has unsupported type')) {
    // 静默忽略这些错误
    if (typeof encoding === 'function') {
      encoding();
    } else if (callback) {
      callback();
    }
    return true;
  }
  return originalStderrWrite.call(process.stderr, chunk, encoding, callback);
};

import { render } from "ink"
import App from "./app.js"

// 从环境变量获取初始配置
const initialModel = process.env.CRAFT_MODEL;
const initialSessionId = process.env.CRAFT_SESSION_ID;

// 清理环境变量，避免影响后续操作
delete process.env.CRAFT_MODEL;
delete process.env.CRAFT_SESSION_ID;

render(<App initialModel={initialModel} initialSessionId={initialSessionId} />)
