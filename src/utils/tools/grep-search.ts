import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import fs from 'fs';
import path from 'path';
import { LoggerManager } from '../logger/logger.js';

/**
 * 代码库搜索（Grepping）工具
 */
export function createGrepSearchTool() {
  return new DynamicStructuredTool({
    name: "grep_search",
    description: `代码库搜索工具 - 在指定目录中搜索文件内容，支持正则表达式和文本匹配。

功能特性：
- 🔍 正则表达式搜索和普通文本搜索
- 📁 递归目录搜索
- 📄 文件类型过滤
- 🎯 上下文显示
- 📊 搜索统计

适用场景：
- 查找特定函数或变量的使用位置
- 搜索特定的代码模式
- 查找配置文件中的特定设置
- 代码重构前的影响分析`,
    schema: z.object({
      query: z.string().describe("搜索查询，可以是普通文本或正则表达式"),
      search_path: z.string().optional().default(".").describe("搜索路径，默认为当前目录"),
      is_regex: z.boolean().optional().default(false).describe("是否为正则表达式搜索"),
      case_sensitive: z.boolean().optional().default(false).describe("是否区分大小写"),
      recursive: z.boolean().optional().default(true).describe("是否递归搜索子目录"),
      file_extensions: z.array(z.string()).optional().describe("限制搜索的文件扩展名，如 ['.js', '.ts', '.py']"),
      exclude_patterns: z.array(z.string()).optional().default([
        'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.vscode'
      ]).describe("排除的目录或文件模式"),
      max_results: z.number().optional().default(50).describe("最大结果数量"),
      context_lines: z.number().optional().default(2).describe("显示匹配行上下文的行数")
    }),
    func: async ({ 
      query, 
      search_path = ".", 
      is_regex = false,
      case_sensitive = false,
      recursive = true,
      file_extensions,
      exclude_patterns = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.vscode'],
      max_results = 50,
      context_lines = 2
    }) => {
      const logger = LoggerManager.getInstance().getLogger('grep-search');
      
      try {
        logger.info('开始代码库搜索', { query, search_path, is_regex });

        const normalizedPath = path.resolve(search_path);
        if (!fs.existsSync(normalizedPath)) {
          return `❌ 搜索路径不存在: ${search_path}`;
        }

        const searchOptions = {
          query,
          searchPath: normalizedPath,
          isRegex: is_regex,
          caseSensitive: case_sensitive,
          recursive,
          fileExtensions: file_extensions,
          excludePatterns: exclude_patterns,
          maxResults: max_results,
          contextLines: context_lines
        };

        const results = await performSearch(searchOptions);
        return formatResults(results, searchOptions);

      } catch (error) {
        logger.error('代码库搜索失败', { error: error instanceof Error ? error.message : error });
        return `❌ 搜索失败: ${error instanceof Error ? error.message : '未知错误'}`;
      }
    }
  });
}

interface SearchOptions {
  query: string;
  searchPath: string;
  isRegex: boolean;
  caseSensitive: boolean;
  recursive: boolean;
  fileExtensions?: string[];
  excludePatterns: string[];
  maxResults: number;
  contextLines: number;
}

interface SearchMatch {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
  contextBefore: string[];
  contextAfter: string[];
}

interface SearchResults {
  matches: SearchMatch[];
  totalMatches: number;
  totalFiles: number;
  searchedFiles: number;
  errors: string[];
  searchTime: number;
}

async function performSearch(options: SearchOptions): Promise<SearchResults> {
  const startTime = Date.now();
  const results: SearchResults = {
    matches: [],
    totalMatches: 0,
    totalFiles: 0,
    searchedFiles: 0,
    errors: [],
    searchTime: 0
  };

  try {
    const searchRegex = createSearchRegex(options);
    const filesToSearch = await getFiles(options.searchPath, options);
    results.totalFiles = filesToSearch.length;

    for (const filePath of filesToSearch) {
      if (results.matches.length >= options.maxResults) {
        break;
      }

      try {
        const fileMatches = await searchFile(filePath, searchRegex, options);
        results.matches.push(...fileMatches);
        results.totalMatches += fileMatches.length;
        results.searchedFiles++;
      } catch (error) {
        results.errors.push(`文件 ${filePath}: ${error instanceof Error ? error.message : '读取失败'}`);
      }
    }

    results.searchTime = Date.now() - startTime;
    return results;

  } catch (error) {
    results.errors.push(`搜索过程中出错: ${error instanceof Error ? error.message : '未知错误'}`);
    results.searchTime = Date.now() - startTime;
    return results;
  }
}

function createSearchRegex(options: SearchOptions): RegExp {
  let pattern = options.query;
  
  if (!options.isRegex) {
    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  const flags = options.caseSensitive ? 'g' : 'gi';
  
  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    throw new Error(`无效的正则表达式: ${pattern}`);
  }
}

async function getFiles(searchPath: string, options: SearchOptions): Promise<string[]> {
  const files: string[] = [];
  
  async function scanDir(dirPath: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (isExcluded(entry.name, fullPath, options.excludePatterns)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          if (options.recursive) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          if (isIncluded(fullPath, options.fileExtensions)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // 忽略无法读取的目录
    }
  }
  
  const stat = await fs.promises.stat(searchPath);
  if (stat.isFile()) {
    if (isIncluded(searchPath, options.fileExtensions)) {
      files.push(searchPath);
    }
  } else {
    await scanDir(searchPath);
  }
  
  return files;
}

function isExcluded(name: string, fullPath: string, excludePatterns: string[]): boolean {
  return excludePatterns.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(name) || regex.test(fullPath);
    }
    return name === pattern || fullPath.includes(pattern);
  });
}

function isIncluded(filePath: string, fileExtensions?: string[]): boolean {
  if (!fileExtensions || fileExtensions.length === 0) {
    return true;
  }
  
  const ext = path.extname(filePath).toLowerCase();
  return fileExtensions.some(allowedExt => 
    allowedExt.toLowerCase() === ext || allowedExt.toLowerCase() === ext.substring(1)
  );
}

async function searchFile(filePath: string, searchRegex: RegExp, options: SearchOptions): Promise<SearchMatch[]> {
  const matches: SearchMatch[] = [];
  
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineMatches = Array.from(line.matchAll(searchRegex));
      
      if (lineMatches.length > 0) {
        const contextBefore = getContext(lines, i, -options.contextLines);
        const contextAfter = getContext(lines, i, options.contextLines);
        
        for (const match of lineMatches) {
          matches.push({
            filePath,
            lineNumber: i + 1,
            lineContent: line,
            matchStart: match.index || 0,
            matchEnd: (match.index || 0) + match[0].length,
            contextBefore,
            contextAfter
          });
        }
      }
    }
  } catch (error) {
    throw new Error(`无法读取文件内容: ${error instanceof Error ? error.message : '未知错误'}`);
  }
  
  return matches;
}

function getContext(lines: string[], currentLine: number, offset: number): string[] {
  const contextLines: string[] = [];
  
  if (offset > 0) {
    for (let i = 1; i <= offset && currentLine + i < lines.length; i++) {
      contextLines.push(lines[currentLine + i]);
    }
  } else if (offset < 0) {
    for (let i = Math.abs(offset); i >= 1 && currentLine - i >= 0; i--) {
      contextLines.unshift(lines[currentLine - i]);
    }
  }
  
  return contextLines;
}

function formatResults(results: SearchResults, options: SearchOptions): string {
  let output = `🔍 代码库搜索结果\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `🎯 搜索查询: "${options.query}"\n`;
  output += `📂 搜索路径: ${options.searchPath}\n`;
  output += `⚙️  搜索类型: ${options.isRegex ? '正则表达式' : '文本匹配'}${options.caseSensitive ? ', 区分大小写' : ', 忽略大小写'}\n`;
  
  if (options.fileExtensions && options.fileExtensions.length > 0) {
    output += `📄 文件类型: ${options.fileExtensions.join(', ')}\n`;
  }
  
  output += `\n📊 搜索统计:\n`;
  output += `   • 搜索文件数: ${results.searchedFiles}\n`;
  output += `   • 匹配文件数: ${new Set(results.matches.map(m => m.filePath)).size}\n`;
  output += `   • 匹配次数: ${results.totalMatches}\n`;
  output += `   • 搜索耗时: ${results.searchTime}ms\n`;
  
  if (results.errors.length > 0) {
    output += `\n⚠️  错误信息:\n`;
    results.errors.forEach(error => {
      output += `   • ${error}\n`;
    });
  }
  
  if (results.matches.length === 0) {
    output += `\n❌ 未找到匹配的内容\n`;
    return output;
  }
  
  // 按文件分组显示结果
  const matchesByFile = new Map<string, SearchMatch[]>();
  results.matches.forEach(match => {
    const relativePath = path.relative(options.searchPath, match.filePath);
    if (!matchesByFile.has(relativePath)) {
      matchesByFile.set(relativePath, []);
    }
    matchesByFile.get(relativePath)!.push(match);
  });
  
  output += `\n📋 匹配结果:\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  let displayedCount = 0;
  for (const [filePath, fileMatches] of matchesByFile) {
    if (displayedCount >= options.maxResults) {
      output += `\n... (结果已截断，仅显示前 ${options.maxResults} 个匹配)\n`;
      break;
    }
    
    output += `\n📁 ${filePath} (${fileMatches.length} 个匹配)\n`;
    
    for (const match of fileMatches) {
      if (displayedCount >= options.maxResults) break;
      
      // 显示上下文（前）
      if (options.contextLines > 0 && match.contextBefore.length > 0) {
        match.contextBefore.forEach((contextLine, idx) => {
          const lineNum = match.lineNumber - match.contextBefore.length + idx;
          output += `${lineNum.toString().padStart(4)}-${contextLine}\n`;
        });
      }
      
      // 显示匹配行（高亮显示匹配内容）
      const beforeMatch = match.lineContent.substring(0, match.matchStart);
      const matchContent = match.lineContent.substring(match.matchStart, match.matchEnd);
      const afterMatch = match.lineContent.substring(match.matchEnd);
      output += `${match.lineNumber.toString().padStart(4)}:${beforeMatch}【${matchContent}】${afterMatch}\n`;
      
      // 显示上下文（后）
      if (options.contextLines > 0 && match.contextAfter.length > 0) {
        match.contextAfter.forEach((contextLine, idx) => {
          const lineNum = match.lineNumber + idx + 1;
          output += `${lineNum.toString().padStart(4)}-${contextLine}\n`;
        });
      }
      
      displayedCount++;
      
      if (displayedCount < fileMatches.length) {
        output += `    ${'-'.repeat(40)}\n`;
      }
    }
  }
  
  return output;
}

export default createGrepSearchTool; 