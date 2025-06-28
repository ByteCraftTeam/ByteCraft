/**
 * Warning 和 Error 过滤器
 * 用于屏蔽特定的控制台输出，避免干扰用户体验
 */

// 需要过滤的消息关键词列表
const FILTER_KEYWORDS = [
  'Failed to calculate number of tokens',
  'Unknown model',
  'falling back to approximate count',
  'getEncodingNameForModel',
  'already exists in this message chunk',
  'field[prompt_tokens] already exists',
  'field[completion_tokens] already exists',
  'field[total_tokens] already exists',
  'value has unsupported type'
];

// 保存原始的 console 方法
const originalWarn = console.warn;
const originalError = console.error;

/**
 * 检查消息是否应该被过滤
 * @param message 消息内容
 * @returns 是否应该被过滤
 */
function shouldFilterMessage(message: string): boolean {
  return FILTER_KEYWORDS.some(keyword => 
    message.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * 过滤后的 warn 方法
 */
function filteredWarn(...args: any[]): void {
  const message = args.join(' ');
  if (shouldFilterMessage(message)) {
    // 静默过滤，不输出
    return;
  }
  originalWarn.apply(console, args);
}

/**
 * 过滤后的 error 方法
 */
function filteredError(...args: any[]): void {
  const message = args.join(' ');
  if (shouldFilterMessage(message)) {
    // 静默过滤，不输出
    return;
  }
  originalError.apply(console, args);
}

/**
 * 应用 warning 过滤器
 * 替换 console.warn 和 console.error 方法
 */
export function applyWarningFilter(): void {
  console.warn = filteredWarn;
  console.error = filteredError;
}

/**
 * 移除 warning 过滤器
 * 恢复原始的 console.warn 和 console.error 方法
 */
export function removeWarningFilter(): void {
  console.warn = originalWarn;
  console.error = originalError;
}

/**
 * 添加新的过滤关键词
 * @param keyword 要过滤的关键词
 */
export function addFilterKeyword(keyword: string): void {
  if (!FILTER_KEYWORDS.includes(keyword)) {
    FILTER_KEYWORDS.push(keyword);
    console.log(`✅ Added filter keyword: "${keyword}"`);
  }
}

/**
 * 移除过滤关键词
 * @param keyword 要移除的关键词
 */
export function removeFilterKeyword(keyword: string): void {
  const index = FILTER_KEYWORDS.indexOf(keyword);
  if (index > -1) {
    FILTER_KEYWORDS.splice(index, 1);
    console.log(`✅ Removed filter keyword: "${keyword}"`);
  }
}

/**
 * 获取当前所有过滤关键词
 * @returns 过滤关键词列表
 */
export function getFilterKeywords(): string[] {
  return [...FILTER_KEYWORDS];
}

/**
 * 检查过滤器是否已应用
 * @returns 是否已应用
 */
export function isWarningFilterApplied(): boolean {
  return console.warn === filteredWarn && console.error === filteredError;
}

/**
 * 临时禁用过滤器执行回调函数
 * @param callback 要执行的回调函数
 */
export function withoutWarningFilter<T>(callback: () => T): T {
  const wasApplied = isWarningFilterApplied();
  if (wasApplied) {
    removeWarningFilter();
  }
  
  try {
    return callback();
  } finally {
    if (wasApplied) {
      applyWarningFilter();
    }
  }
} 