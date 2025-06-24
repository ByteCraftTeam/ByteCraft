import { applyWarningFilter } from "../utils/warning-filter.js"

// 立即应用过滤器
applyWarningFilter()

// 额外过滤 process.stderr
const originalStderrWrite = process.stderr.write;
process.stderr.write = function(chunk: any, encoding?: any, callback?: any) {
  const message = chunk.toString();
  if (message.includes('Unknown model') || 
      message.includes('Failed to calculate number of tokens') ||
      message.includes('falling back to approximate count')) {
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

render(<App />)
