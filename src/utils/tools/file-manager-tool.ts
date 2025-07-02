import { Tool } from '@langchain/core/tools';
import fs from 'fs';
import path from 'path';
import { LoggerManager } from '../logger/logger.js';

/**
 * 精简版文件管理工具
 * 专注于核心功能：读取文件夹、批量创建、精确修改
 */
export class FileManagerToolV2 extends Tool {
  name = 'file_manager_v2';
  description = `
  精简版文件管理工具 - 专注核心功能

  这是一个专注于核心文件操作的精简工具，支持：
  1. 📁 递归读取文件夹所有内容（支持智能忽略）
  2. 📄 读取单个文件内容
  3. 🔧 批量创建文件夹和文件 
  4. 🗑️ 删除文件和目录
  5. ✍️ 写入和创建单个文件
  
  ## 核心功能

  ### 1. 读取文件夹所有内容
  操作：read_folder
  参数：path (必填), recursive (可选，默认true), ignore_patterns (可选，自定义忽略模式)
  
  示例：
  {"input": "{"action": "read_folder", "path": "src", "recursive": true}"}
  {"input": "{"action": "read_folder", "path": ".", "recursive": true, "ignore_patterns": ["*.backup", "old-*"]}"}
  
  返回：完整的文件夹结构，包括所有文件内容
  
  默认忽略的文件和文件夹包括：
  - node_modules, .git, .next, .nuxt, dist, build, coverage 等构建和依赖目录
  - .DS_Store, Thumbs.db, *.log 等系统和日志文件
  - .env, .env.local 等环境配置文件
  - .vscode, .idea 等编辑器配置目录
  - __pycache__, target, bin, obj 等语言特定的构建目录

  ### 2. 读取单个文件内容（支持行号显示）
  操作：read_file
  参数：path (必填), show_line_numbers (可选，默认true)
  
  示例：
  {"input": "{"action": "read_file", "path": "src/index.js"}"}
  {"input": "{"action": "read_file", "path": "src/index.js", "show_line_numbers": false}"}
  
  返回：单个文件的详细信息和内容，包含带行号的内容版本

  ### 3. 批量创建文件夹
  操作：batch_create_folders
  参数：folders (必填，字符串数组)
  
  示例：
  {"input": "{"action": "batch_create_folders", "folders": ["src/components", "src/utils", "tests"]}"}

  ### 4. 批量创建文件并写入内容
  操作：batch_create_files
  参数：files (必填，对象数组，包含path和content)
  
  示例：
  {"input": "{"action": "batch_create_files", "files": [
    {"path": "src/index.js", "content": "console.log('Hello');"},
    {"path": "README.md", "content": "# 项目说明"}
  ]}"}

  ### 5. 创建单个文件
  操作：create_file
  参数：path (必填), content (可选，默认为空字符串), overwrite (可选，默认false)
  
  示例：
  {"input": "{"action": "create_file", "path": "src/new-file.js", "content": "console.log('Hello World');"}"}
  {"input": "{"action": "create_file", "path": "src/existing-file.js", "content": "updated content", "overwrite": true}"}
  
  返回：文件创建结果，包括文件信息

  ### 6. 写入文件内容
  操作：write_file
  参数：path (必填), content (必填), append (可选，默认false - 覆盖写入)
  
  示例：
  {"input": "{"action": "write_file", "path": "src/config.js", "content": "export const config = {};"}"}
  {"input": "{"action": "write_file", "path": "logs/app.log", "content": "New log entry\\n", "append": true}"}
  
  返回：写入操作结果，包括文件大小变化

  
  ### 8. 删除文件或目录
  操作：delete_item
  参数：path (必填), recursive (可选，删除目录时是否递归删除，默认false)
  
  示例：
  {"input": "{"action": "delete_item", "path": "src/temp.js"}"}
  {"input": "{"action": "delete_item", "path": "temp_folder", "recursive": true}"}
  
  返回：删除操作的详细结果

  ### 9. 批量删除文件或目录
  操作：batch_delete
  参数：items (必填，对象数组，包含path和可选的recursive)
  
  示例：
  {"input": "{"action": "batch_delete", "items": [
    {"path": "src/temp1.js"},
    {"path": "temp_folder", "recursive": true},
    {"path": "src/temp2.js"}
  ]}"}

  ## 输入格式
  支持多种输入格式，工具会自动识别并处理：
  
  格式1（推荐）：直接JSON字符串
  格式2（自动处理）：嵌套对象包含input字段
  
  ⚠️ **重要注意事项**：
  - 在传递包含换行符的文件内容时，请使用 \\n 而不是实际的换行符
  - 其他控制字符也需要转义：\\t (Tab), \\r (回车), \\b (退格) 等
  - 工具会自动尝试转义常见的控制字符，但建议主动转义以避免JSON解析错误
  - 如果遇到JSON解析错误，检查内容中是否包含未转义的控制字符
  - 工具会自动检测并处理嵌套的输入格式
  `;

  private logger: any;

  // 默认忽略的文件和文件夹模式
  private readonly DEFAULT_IGNORE_PATTERNS = [
    // 依赖和构建目录
    'node_modules',
    '.git',
    '.next',
    '.nuxt',
    'dist',
    'build',
    'coverage',
    '.nyc_output',
    'out',
    '.output',
    
    // 缓存和临时目录
    '.cache',
    '.temp',
    '.tmp',
    'tmp',
    'temp',
    
    // 日志文件
    '*.log',
    'logs',
    
    // 系统文件
    '.DS_Store',
    'Thumbs.db',
    'desktop.ini',
    
    // 环境配置文件（可能包含敏感信息）
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test',
    
    // 编辑器和IDE配置
    '.vscode',
    '.idea',
    '*.swp',
    '*.swo',
    '*~',
    
    // 语言特定的构建和缓存目录
    '__pycache__',
    '*.pyc',
    '.pytest_cache',
    'target',      // Rust/Java
    'bin',
    'obj',
    '.gradle',
    'vendor',      // PHP/Go
    '.bundle',     // Ruby
    
    // 其他常见的忽略项
    '*.pid',
    '*.seed',
    '*.pid.lock',
    'lib-cov',
    '.grunt',
    '.lock-wscript',
    '.wafpickle-*',
    '.node_repl_history',
    '*.tsbuildinfo',
    '.eslintcache'
  ];

  constructor() {
    super();
    this.logger = LoggerManager.getInstance().getLogger('file-manager-v2');
  }

  protected async _call(input: string): Promise<string> {
    try {
      this.logger.info('文件管理工具V2被调用', { input: input.substring(0, 200) });
      
      if (!input) {
        return JSON.stringify({ 
          error: `缺少输入参数`,
          received: input
        });
      }

      // 处理可能的嵌套输入格式：先尝试解析JSON，检查是否包含input字段
      let actualInput = input;
      try {
        const parsedWrapper = JSON.parse(input);
        if (parsedWrapper && typeof parsedWrapper === 'object' && 'input' in parsedWrapper) {
          actualInput = parsedWrapper.input;
          this.logger.info('检测到嵌套输入格式，提取实际输入', { 
            extractedInput: actualInput.substring(0, 200),
            originalInput: input.substring(0, 200)
          });
        }
      } catch (wrapperParseError) {
        // 如果无法解析为包装对象，则继续使用原始输入
        this.logger.info('输入不是包装格式，使用原始输入', { 
          error: wrapperParseError instanceof Error ? wrapperParseError.message : String(wrapperParseError)
        });
      }
      
      if (typeof actualInput !== 'string') {
        return JSON.stringify({ 
          error: `无效的输入: 期望字符串，但收到 ${typeof actualInput}`,
          received: actualInput,
          originalInput: input
        });
      }

      // 预处理输入：转义常见的控制字符
      let processedInput = actualInput;
      try {
        // 先尝试直接解析，如果失败再进行转义处理
        JSON.parse(processedInput);
      } catch (firstParseError) {
        this.logger.info('首次JSON解析失败，尝试转义处理', { error: firstParseError instanceof Error ? firstParseError.message : String(firstParseError) });
        
        // 转义常见的控制字符
        processedInput = actualInput
          .replace(/\r\n/g, '\\r\\n')  // 转义 CRLF
          .replace(/\r/g, '\\r')       // 转义 CR
          .replace(/\n/g, '\\n')       // 转义 LF
          .replace(/\t/g, '\\t')       // 转义 Tab
          .replace(/\b/g, '\\b')       // 转义 Backspace
          .replace(/\f/g, '\\f')       // 转义 Form Feed
          .replace(/\v/g, '\\v');      // 转义 Vertical Tab
      }

      let parsed;
      try {
        parsed = JSON.parse(processedInput);
        this.logger.info('JSON解析成功', { action: parsed.action });
      } catch (parseError) {
        this.logger.error('JSON解析最终失败', { 
          error: parseError instanceof Error ? parseError.message : String(parseError),
          originalInput: actualInput.substring(0, 300),
          processedInput: processedInput.substring(0, 300)
        });
        return JSON.stringify({ 
          error: `JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          input: actualInput.substring(0, 200),
          processed_input: processedInput.substring(0, 200),
          suggestion: "请确保字符串中的控制字符（如换行符）被正确转义。建议使用 \\n 而不是实际的换行符"
        });
      }

      const { action } = parsed;
      if (!action) {
        return JSON.stringify({ error: "缺少必需参数: action" });
      }

      let result: string;
      switch (action) {
        case 'read_folder':
          result = await this.readFolder(parsed.path, parsed.recursive, parsed.ignore_patterns);
          break;
        
        case 'read_file':
          result = await this.readSingleFile(parsed.path, parsed.show_line_numbers);
          break;
        
        case 'batch_create_folders':
          result = await this.batchCreateFolders(parsed.folders);
          break;
        
        case 'batch_create_files':
          result = await this.batchCreateFiles(parsed.files);
          break;
        
        case 'create_file':
          result = await this.createFile(parsed);
          break;
        
        case 'write_file':
          result = await this.writeFile(parsed);
          break;
        
        case 'precise_edit':
          result = await this.preciseEdit(parsed);
          break;
        
        case 'delete_item':
          result = await this.deleteItem(parsed.path, parsed.recursive);
          break;
        
        case 'batch_delete':
          result = await this.batchDelete(parsed.items);
          break;
        
        default:
          result = JSON.stringify({ error: `不支持的操作: ${action}` });
      }

      this.logger.info('操作完成', { action, success: result.includes('"success":true') });
      return result;
    } catch (error) {
      this.logger.error('工具执行失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `操作失败: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * 读取文件夹所有内容（递归）
   */
  private async readFolder(folderPath: string, recursive: boolean = true, ignorePatterns?: string[]): Promise<string> {
    try {
      this.logger.info('开始读取文件夹', { folderPath, recursive, customIgnorePatterns: ignorePatterns?.length || 0 });
      
      if (!folderPath) {
        return JSON.stringify({ error: "缺少必需参数: path" });
      }

      // 路径安全检查
      const safePath = this.sanitizePath(folderPath);
      if (!safePath) {
        return JSON.stringify({ error: "无效的文件路径" });
      }

      if (!fs.existsSync(safePath)) {
        return JSON.stringify({ error: `文件夹不存在: ${folderPath}` });
      }

      const stats = fs.statSync(safePath);
      if (!stats.isDirectory()) {
        return JSON.stringify({ error: `${folderPath} 不是一个文件夹` });
      }

      // 合并默认忽略模式和用户自定义忽略模式
      const allIgnorePatterns = [...this.DEFAULT_IGNORE_PATTERNS];
      if (ignorePatterns && Array.isArray(ignorePatterns)) {
        allIgnorePatterns.push(...ignorePatterns);
      }

      const result = await this.readFolderRecursive(safePath, recursive, allIgnorePatterns);
      
      return JSON.stringify({
        success: true,
        path: folderPath,
        total_files: this.countFiles(result),
        total_folders: this.countFolders(result),
        ignore_patterns_used: allIgnorePatterns,
        structure: result
      }, null, 2);
    } catch (error) {
      this.logger.error('读取文件夹失败', { folderPath, error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `读取文件夹失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 递归读取文件夹内容，包括文件内容
   */
  private async readFolderRecursive(dirPath: string, recursive: boolean, ignorePatterns: string[]): Promise<any[]> {
    const items: any[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // 检查是否应该忽略这个文件或文件夹
      if (this.shouldIgnore(entry.name, fullPath, ignorePatterns)) {
        this.logger.info('忽略文件/文件夹', { name: entry.name, path: fullPath });
        continue;
      }
      
      const stats = fs.statSync(fullPath);
      
      if (entry.isDirectory()) {
        const folderItem: any = {
          name: entry.name,
          path: fullPath,
          type: 'folder',
          size: 0,
          modified: stats.mtime,
          children: recursive ? await this.readFolderRecursive(fullPath, true, ignorePatterns) : []
        };
        items.push(folderItem);
      } else {
        // 读取文件内容
        let content = '';
        let contentError = null;
        let isTextFile = false;
        try {
          // 对于文本文件，读取内容；对于二进制文件，只读取信息
          isTextFile = await this.isTextFile(fullPath);
          if (isTextFile) {
            content = fs.readFileSync(fullPath, 'utf8');
          } else {
            content = '[Binary file - content not displayed]';
          }
        } catch (err) {
          contentError = err instanceof Error ? err.message : String(err);
        }

        const fileItem: any = {
          name: entry.name,
          path: fullPath,
          type: 'file',
          size: stats.size,
          modified: stats.mtime,
          content: content,
          content_error: contentError,
          is_text_file: isTextFile
        };
        items.push(fileItem);
      }
    }

    return items;
  }

  /**
   * 检查文件或文件夹是否应该被忽略
   */
  private shouldIgnore(itemName: string, fullPath: string, ignorePatterns: string[]): boolean {
    for (const pattern of ignorePatterns) {
      if (this.matchesPattern(itemName, pattern) || this.matchesPattern(path.basename(fullPath), pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查名称是否匹配忽略模式
   */
  private matchesPattern(name: string, pattern: string): boolean {
    // 完全匹配
    if (name === pattern) {
      return true;
    }
    
    // 通配符匹配
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')  // 转义点号
        .replace(/\*/g, '.*');  // 将 * 转换为 .*
      
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(name);
    }
    
    return false;
  }

  /**
   * 批量创建文件夹
   */
  private async batchCreateFolders(folders: string[]): Promise<string> {
    try {
      this.logger.info('开始批量创建文件夹', { folders });
      
      if (!folders || !Array.isArray(folders)) {
        return JSON.stringify({ error: "缺少必需参数: folders (数组)" });
      }

      const results: any[] = [];
      
      for (const folderPath of folders) {
        try {
          const safePath = this.sanitizePath(folderPath);
          if (!safePath) {
            results.push({ 
              path: folderPath, 
              success: false, 
              error: "无效的文件夹路径" 
            });
            continue;
          }

          // 创建文件夹（递归创建）
          if (!fs.existsSync(safePath)) {
            fs.mkdirSync(safePath, { recursive: true });
            results.push({ 
              path: folderPath, 
              success: true, 
              message: "文件夹创建成功" 
            });
          } else {
            results.push({ 
              path: folderPath, 
              success: true, 
              message: "文件夹已存在" 
            });
          }
        } catch (error) {
          results.push({ 
            path: folderPath, 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      
      return JSON.stringify({
        success: true,
        total: folders.length,
        successful: successCount,
        failed: folders.length - successCount,
        results: results
      }, null, 2);
    } catch (error) {
      this.logger.error('批量创建文件夹失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `批量创建文件夹失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 批量创建文件并写入内容
   */
  private async batchCreateFiles(files: Array<{path: string, content: string}>): Promise<string> {
    try {
      this.logger.info('开始批量创建文件', { filesCount: files.length });
      
      if (!files || !Array.isArray(files)) {
        return JSON.stringify({ error: "缺少必需参数: files (数组)" });
      }

      const results: any[] = [];
      
      for (const file of files) {
        try {
          if (!file.path || typeof file.content !== 'string') {
            results.push({ 
              path: file.path || 'unknown', 
              success: false, 
              error: "文件路径或内容无效" 
            });
            continue;
          }

          const safePath = this.sanitizePath(file.path);
          if (!safePath) {
            results.push({ 
              path: file.path, 
              success: false, 
              error: "无效的文件路径" 
            });
            continue;
          }

          // 确保父目录存在
          const dir = path.dirname(safePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // 写入文件
          fs.writeFileSync(safePath, file.content, 'utf8');
          const stats = fs.statSync(safePath);
          
          results.push({ 
            path: file.path, 
            success: true, 
            message: "文件创建成功",
            size: stats.size,
            content_length: file.content.length
          });
        } catch (error) {
          results.push({ 
            path: file.path, 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      
      return JSON.stringify({
        success: true,
        total: files.length,
        successful: successCount,
        failed: files.length - successCount,
        results: results
      }, null, 2);
    } catch (error) {
      this.logger.error('批量创建文件失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `批量创建文件失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 创建单个文件
   */
  private async createFile(params: any): Promise<string> {
    try {
      const { path: filePath, content = '', overwrite = false } = params;
      
      this.logger.info('开始创建文件', { filePath, contentLength: content.length, overwrite });
      
      if (!filePath) {
        return JSON.stringify({ error: "缺少必需参数: path" });
      }

      if (typeof content !== 'string') {
        return JSON.stringify({ error: "content 参数必须是字符串" });
      }

      const safePath = this.sanitizePath(filePath);
      if (!safePath) {
        return JSON.stringify({ error: "无效的文件路径" });
      }

      if (fs.existsSync(safePath) && !overwrite) {
        return JSON.stringify({ 
          error: `文件已存在: ${filePath}，如需覆盖请设置 overwrite: true` 
        });
      }

      // 确保父目录存在
      const dir = path.dirname(safePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 写入文件
      fs.writeFileSync(safePath, content, 'utf8');
      const stats = fs.statSync(safePath);
      
      return JSON.stringify({
        success: true,
        path: filePath,
        absolute_path: safePath,
        message: fs.existsSync(safePath) && overwrite ? "文件已覆盖" : "文件创建成功",
        content_length: content.length,
        size: stats.size,
        size_human: this.formatFileSize(stats.size),
        created: stats.birthtime,
        modified: stats.mtime,
        overwrite_used: overwrite
      }, null, 2);
    } catch (error) {
      this.logger.error('创建文件失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `创建文件失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 写入文件内容
   */
  private async writeFile(params: any): Promise<string> {
    try {
      const { path: filePath, content, append = false } = params;
      
      this.logger.info('开始写入文件', { filePath, contentLength: content?.length, append });
      
      if (!filePath || typeof content !== 'string') {
        return JSON.stringify({ error: "缺少必需参数: path 和 content" });
      }

      const safePath = this.sanitizePath(filePath);
      if (!safePath) {
        return JSON.stringify({ error: "无效的文件路径" });
      }

      // 检查文件是否存在
      const fileExists = fs.existsSync(safePath);
      let originalContent = '';
      let originalSize = 0;

      if (fileExists) {
        try {
          originalContent = fs.readFileSync(safePath, 'utf8');
          originalSize = originalContent.length;
        } catch (readError) {
          return JSON.stringify({ 
            error: `无法读取原文件内容: ${readError instanceof Error ? readError.message : String(readError)}` 
          });
        }
      } else {
        // 如果文件不存在，确保父目录存在
        const dir = path.dirname(safePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
      
      let newContent: string;
      let operationDetails: any = {
        operation: append ? 'append' : 'overwrite',
        file_existed: fileExists,
        original_size: originalSize,
        content_added: content.length
      };
      
      if (append && fileExists) {
        // 追加模式：在原内容后添加
        newContent = originalContent + (originalContent.endsWith('\n') ? '' : '\n') + content;
      } else {
        // 覆盖模式：替换全部内容
        newContent = content;
      }
      
      // 写入文件内容
      fs.writeFileSync(safePath, newContent, 'utf8');
      const stats = fs.statSync(safePath);
      
      operationDetails.new_size = newContent.length;
      operationDetails.size_change = newContent.length - originalSize;
      operationDetails.lines_added = content.split('\n').length;
      
      return JSON.stringify({
        success: true,
        path: filePath,
        absolute_path: safePath,
        message: fileExists ? 
          (append ? "内容已追加到文件" : "文件内容已覆盖") : 
          "新文件已创建并写入内容",
        original_size: originalSize,
        new_size: newContent.length,
        size_change: operationDetails.size_change,
        size_human: this.formatFileSize(stats.size),
        modified: stats.mtime,
        operation_details: operationDetails
      }, null, 2);
    } catch (error) {
      this.logger.error('写入文件失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `写入文件失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 精确定位修改文件
   */
  private async preciseEdit(params: any): Promise<string> {
    try {
      const { path: filePath, edit_type, start_line, end_line, line, content, old_text, new_text, replace_all } = params;
      
      this.logger.info('开始精确编辑', { filePath, edit_type });
      
      if (!filePath || !edit_type) {
        return JSON.stringify({ error: "缺少必需参数: path 或 edit_type" });
      }

      const safePath = this.sanitizePath(filePath);
      if (!safePath) {
        return JSON.stringify({ error: "无效的文件路径" });
      }

      if (!fs.existsSync(safePath)) {
        return JSON.stringify({ error: `文件不存在: ${filePath}` });
      }

      // 读取原文件内容
      const originalContent = fs.readFileSync(safePath, 'utf8');
      const originalLines = originalContent.split('\n');
      
      let newContent: string;
      let operationDetails: any = {};
      
      switch (edit_type) {
        case 'replace_lines':
          if (typeof start_line !== 'number' || typeof end_line !== 'number' || !content) {
            return JSON.stringify({ error: "replace_lines 需要 start_line, end_line, content 参数" });
          }
          const result1 = this.replaceLines(originalLines, start_line, end_line, content);
          newContent = result1.content;
          operationDetails = result1.details;
          break;
          
        case 'insert_lines':
          if (typeof line !== 'number' || !content) {
            return JSON.stringify({ error: "insert_lines 需要 line, content 参数" });
          }
          const result2 = this.insertLines(originalLines, line, content);
          newContent = result2.content;
          operationDetails = result2.details;
          break;
          
        case 'delete_lines':
          if (typeof start_line !== 'number' || typeof end_line !== 'number') {
            return JSON.stringify({ error: "delete_lines 需要 start_line, end_line 参数" });
          }
          const result3 = this.deleteLines(originalLines, start_line, end_line);
          newContent = result3.content;
          operationDetails = result3.details;
          break;
          
        case 'replace_text':
          if (!old_text || !new_text) {
            return JSON.stringify({ error: "replace_text 需要 old_text, new_text 参数" });
          }
          const result4 = this.replaceText(originalContent, old_text, new_text, replace_all);
          newContent = result4.content;
          operationDetails = result4.details;
          break;
          
        default:
          return JSON.stringify({ error: `不支持的编辑类型: ${edit_type}` });
      }

      // 写入修改后的内容
      fs.writeFileSync(safePath, newContent, 'utf8');
      const stats = fs.statSync(safePath);
      
      return JSON.stringify({
        success: true,
        path: filePath,
        edit_type: edit_type,
        message: `文件编辑成功`,
        original_content: originalContent,
        new_content: newContent,
        original_lines_count: originalLines.length,
        new_lines_count: newContent.split('\n').length,
        file_size: stats.size,
        modified: stats.mtime,
        operation_details: operationDetails
      }, null, 2);
    } catch (error) {
      this.logger.error('精确编辑失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `精确编辑失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 替换指定行范围
   */
  private replaceLines(lines: string[], startLine: number, endLine: number, newContent: string): {content: string, details: any} {
    if (startLine < 1 || endLine < 1 || startLine > endLine) {
      throw new Error("无效的行号范围");
    }

    const actualStartLine = startLine - 1;
    const actualEndLine = Math.min(endLine - 1, lines.length - 1);
    const newLines = newContent.split('\n');
    
    const newFileLines = [
      ...lines.slice(0, actualStartLine),
      ...newLines,
      ...lines.slice(actualEndLine + 1)
    ];
    
    return {
      content: newFileLines.join('\n'),
      details: {
        affected_lines: { start: startLine, end: actualEndLine + 1 },
        replaced_lines: actualEndLine - actualStartLine + 1,
        new_lines: newLines.length,
        net_change: newLines.length - (actualEndLine - actualStartLine + 1)
      }
    };
  }

  /**
   * 在指定行后插入内容
   */
  private insertLines(lines: string[], lineNumber: number, newContent: string): {content: string, details: any} {
    if (lineNumber < 0) {
      throw new Error("行号必须大于等于0");
    }

    const newLines = newContent.split('\n');
    let newFileLines: string[];
    
    if (lineNumber === 0) {
      newFileLines = [...newLines, ...lines];
    } else if (lineNumber >= lines.length) {
      newFileLines = [...lines, ...newLines];
    } else {
      newFileLines = [
        ...lines.slice(0, lineNumber),
        ...newLines,
        ...lines.slice(lineNumber)
      ];
    }
    
    return {
      content: newFileLines.join('\n'),
      details: {
        insert_position: lineNumber,
        inserted_lines: newLines.length,
        total_lines_after: newFileLines.length
      }
    };
  }

  /**
   * 删除指定行范围
   */
  private deleteLines(lines: string[], startLine: number, endLine: number): {content: string, details: any} {
    if (startLine < 1 || endLine < 1 || startLine > endLine) {
      throw new Error("无效的行号范围");
    }

    const actualStartLine = startLine - 1;
    const actualEndLine = Math.min(endLine - 1, lines.length - 1);
    
    const newFileLines = [
      ...lines.slice(0, actualStartLine),
      ...lines.slice(actualEndLine + 1)
    ];
    
    return {
      content: newFileLines.join('\n'),
      details: {
        deleted_lines: { start: startLine, end: actualEndLine + 1 },
        deleted_count: actualEndLine - actualStartLine + 1,
        remaining_lines: newFileLines.length
      }
    };
  }

  /**
   * 替换文本内容
   */
  private replaceText(content: string, oldText: string, newText: string, replaceAll: boolean = false): {content: string, details: any} {
    let newContent: string;
    let replacementCount: number;
    
    if (replaceAll) {
      const regex = new RegExp(this.escapeRegExp(oldText), 'g');
      const matches = content.match(regex);
      replacementCount = matches ? matches.length : 0;
      newContent = content.replace(regex, newText);
    } else {
      if (content.includes(oldText)) {
        newContent = content.replace(oldText, newText);
        replacementCount = 1;
      } else {
        newContent = content;
        replacementCount = 0;
      }
    }
    
    return {
      content: newContent,
      details: {
        replacement_count: replacementCount,
        replace_all: replaceAll,
        content_size_change: newContent.length - content.length
      }
    };
  }

  /**
   * 路径安全检查
   */
  private sanitizePath(filePath: string): string | null {
    if (!filePath || typeof filePath !== 'string') {
      return null;
    }
    
    if (filePath.includes('..') || path.isAbsolute(filePath)) {
      return null;
    }
    
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
      return null;
    }
    
    return normalizedPath;
  }

  /**
   * 判断是否为文本文件
   */
  /**
   * 智能检测文件是否为文本文件
   * 先尝试以文本方式读取，如果成功就认为是文本文件
   */
  private async isTextFile(filePath: string): Promise<boolean> {
    try {
      // 首先检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const stats = fs.statSync(filePath);
      
      // 如果文件太大（超过1MB），先检查扩展名
      if (stats.size > 1024 * 1024) {
        const textExtensions = ['.txt', '.js', '.ts', '.jsx', '.tsx', '.vue', '.json', '.md', '.yml', '.yaml', 
                               '.xml', '.html', '.css', '.scss', '.sass', '.less', '.py', '.java', 
                               '.c', '.cpp', '.h', '.php', '.rb', '.go', '.rs', '.swift', '.kt', 
                               '.sh', '.bat', '.ps1', '.sql', '.r', '.m', '.scala', '.clj', '.hs',
                               '.config', '.conf', '.ini', '.toml', '.lock', '.gitignore', '.gitattributes'];
        
        const ext = path.extname(filePath).toLowerCase();
        if (textExtensions.includes(ext)) {
          return true;
        }
        // 对于大文件且不在白名单中的，尝试读取前1KB来判断
        const sample = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
        return this.isValidTextContent(sample);
      }

      // 对于小文件，直接尝试完整读取
      const content = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
      return this.isValidTextContent(content);
    } catch (error) {
      // 如果读取失败，可能是二进制文件或权限问题
      this.logger.info('文件读取失败，可能是二进制文件', { filePath, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * 检查内容是否为有效的文本内容
   */
  private isValidTextContent(content: string): boolean {
    if (!content || content.length === 0) {
      return true; // 空文件认为是文本文件
    }

    // 检查是否包含过多的控制字符（除了常见的换行符、制表符等）
    const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
    const controlChars = content.match(controlCharRegex);
    
    if (controlChars) {
      const controlCharRatio = controlChars.length / content.length;
      // 如果控制字符比例超过5%，认为是二进制文件
      if (controlCharRatio > 0.05) {
        return false;
      }
    }

    // 检查是否包含大量不可打印字符
    const nonPrintableRegex = /[^\x20-\x7E\x0A\x0D\x09]/g;
    const nonPrintableChars = content.match(nonPrintableRegex);
    
    if (nonPrintableChars) {
      const nonPrintableRatio = nonPrintableChars.length / content.length;
      // 如果不可打印字符比例超过10%，认为是二进制文件
      if (nonPrintableRatio > 0.1) {
        return false;
      }
    }

    return true;
  }

  /**
   * 统计文件数量
   */
  private countFiles(items: any[]): number {
    let count = 0;
    for (const item of items) {
      if (item.type === 'file') {
        count++;
      } else if (item.type === 'folder' && item.children) {
        count += this.countFiles(item.children);
      }
    }
    return count;
  }

  /**
   * 统计文件夹数量
   */
  private countFolders(items: any[]): number {
    let count = 0;
    for (const item of items) {
      if (item.type === 'folder') {
        count++;
        if (item.children) {
          count += this.countFolders(item.children);
        }
      }
    }
    return count;
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 读取单个文件内容
   */
  private async readSingleFile(filePath: string, showLineNumbers: boolean = true): Promise<string> {
    try {
      this.logger.info('开始读取单个文件', { filePath, showLineNumbers });
      
      if (!filePath) {
        return JSON.stringify({ error: "缺少必需参数: path" });
      }

      // 路径安全检查
      const safePath = this.sanitizePath(filePath);
      if (!safePath) {
        return JSON.stringify({ error: "无效的文件路径" });
      }

      if (!fs.existsSync(safePath)) {
        return JSON.stringify({ error: `文件不存在: ${filePath}` });
      }

      const stats = fs.statSync(safePath);
      if (!stats.isFile()) {
        return JSON.stringify({ error: `${filePath} 不是一个文件` });
      }

      // 读取文件内容
      let content = '';
      let contentError = null;
      let isTextFile = await this.isTextFile(safePath);
      
      try {
        if (isTextFile) {
          content = fs.readFileSync(safePath, 'utf8');
        } else {
          content = '[Binary file - content not displayed]';
        }
      } catch (err) {
        contentError = err instanceof Error ? err.message : String(err);
      }

      // 如果是文本文件，计算行数和生成带行号的内容
      const lines = isTextFile && content ? content.split('\n') : [];
      let contentWithLineNumbers = null;
      
      // 生成带行号的内容
      if (isTextFile && content && showLineNumbers) {
        const maxLineNumberWidth = lines.length.toString().length;
        contentWithLineNumbers = lines.map((line, index) => {
          const lineNumber = (index + 1).toString().padStart(maxLineNumberWidth, ' ');
          return `${lineNumber}: ${line}`;
        }).join('\n');
      }
      
      return JSON.stringify({
        success: true,
        path: filePath,
        absolute_path: safePath,
        name: path.basename(safePath),
        extension: path.extname(safePath),
        size: stats.size,
        size_human: this.formatFileSize(stats.size),
        is_text_file: isTextFile,
        lines_count: isTextFile ? lines.length : null,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        content: content,
        content_with_line_numbers: contentWithLineNumbers,
        show_line_numbers: showLineNumbers,
        content_error: contentError,
        content_preview: isTextFile && content ? (content.length > 200 ? content.substring(0, 200) + '...' : content) : null
      }, null, 2);
    } catch (error) {
      this.logger.error('读取单个文件失败', { filePath, error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `读取文件失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 删除单个文件或目录
   */
  private async deleteItem(itemPath: string, recursive: boolean = false): Promise<string> {
    try {
      this.logger.info('开始删除项目', { itemPath, recursive });
      
      if (!itemPath) {
        return JSON.stringify({ error: "缺少必需参数: path" });
      }

      // 路径安全检查
      const safePath = this.sanitizePath(itemPath);
      if (!safePath) {
        return JSON.stringify({ error: "无效的文件路径" });
      }

      if (!fs.existsSync(safePath)) {
        return JSON.stringify({ error: `文件或目录不存在: ${itemPath}` });
      }

      const stats = fs.statSync(safePath);
      const isDirectory = stats.isDirectory();
      const size = stats.size;
      const itemType = isDirectory ? 'directory' : 'file';

      // 记录删除前的信息
      let deletedInfo: any = {
        path: itemPath,
        type: itemType,
        size: size,
        size_human: this.formatFileSize(size),
        modified: stats.mtime
      };

      // 如果是目录，检查是否为空或是否允许递归删除
      if (isDirectory) {
        const dirContents = fs.readdirSync(safePath);
        if (dirContents.length > 0 && !recursive) {
          return JSON.stringify({ 
            error: "目录不为空，如需删除请设置 recursive: true",
            directory_contents: dirContents.length,
            items: dirContents.slice(0, 5) // 只显示前5个项目
          });
        }
        
        // 递归计算目录大小和文件数量
        if (recursive) {
          const dirStats = await this.calculateDirectoryStats(safePath);
          deletedInfo = {
            ...deletedInfo,
            total_files: dirStats.fileCount,
            total_directories: dirStats.dirCount,
            total_size: dirStats.totalSize,
            total_size_human: this.formatFileSize(dirStats.totalSize)
          };
        }
      }

      // 执行删除操作
      if (isDirectory) {
        if (recursive) {
          fs.rmSync(safePath, { recursive: true, force: true });
        } else {
          fs.rmdirSync(safePath);
        }
      } else {
        fs.unlinkSync(safePath);
      }

      return JSON.stringify({
        success: true,
        message: `${itemType === 'directory' ? '目录' : '文件'}删除成功`,
        deleted_item: deletedInfo,
        recursive_delete: recursive && isDirectory
      }, null, 2);
    } catch (error) {
      this.logger.error('删除项目失败', { itemPath, error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `删除失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 批量删除文件或目录
   */
  private async batchDelete(items: Array<{path: string, recursive?: boolean}>): Promise<string> {
    try {
      this.logger.info('开始批量删除', { itemsCount: items.length });
      
      if (!items || !Array.isArray(items)) {
        return JSON.stringify({ error: "缺少必需参数: items (数组)" });
      }

      const results: any[] = [];
      let totalDeletedFiles = 0;
      let totalDeletedDirs = 0;
      let totalDeletedSize = 0;
      
      for (const item of items) {
        try {
          if (!item.path) {
            results.push({ 
              path: item.path || 'unknown', 
              success: false, 
              error: "路径无效" 
            });
            continue;
          }

          const safePath = this.sanitizePath(item.path);
          if (!safePath) {
            results.push({ 
              path: item.path, 
              success: false, 
              error: "无效的文件路径" 
            });
            continue;
          }

          if (!fs.existsSync(safePath)) {
            results.push({ 
              path: item.path, 
              success: false, 
              error: "文件或目录不存在" 
            });
            continue;
          }

          const stats = fs.statSync(safePath);
          const isDirectory = stats.isDirectory();
          const recursive = item.recursive || false;

          // 如果是目录且不允许递归删除，检查是否为空
          if (isDirectory && !recursive) {
            const dirContents = fs.readdirSync(safePath);
            if (dirContents.length > 0) {
              results.push({ 
                path: item.path, 
                success: false, 
                error: "目录不为空，需要设置 recursive: true" 
              });
              continue;
            }
          }

          // 计算删除的文件统计
          if (isDirectory && recursive) {
            const dirStats = await this.calculateDirectoryStats(safePath);
            totalDeletedFiles += dirStats.fileCount;
            totalDeletedDirs += dirStats.dirCount + 1; // +1 包括当前目录
            totalDeletedSize += dirStats.totalSize;
          } else if (isDirectory) {
            totalDeletedDirs += 1;
          } else {
            totalDeletedFiles += 1;
            totalDeletedSize += stats.size;
          }

          // 执行删除操作
          if (isDirectory) {
            if (recursive) {
              fs.rmSync(safePath, { recursive: true, force: true });
            } else {
              fs.rmdirSync(safePath);
            }
          } else {
            fs.unlinkSync(safePath);
          }

          results.push({ 
            path: item.path, 
            success: true, 
            type: isDirectory ? 'directory' : 'file',
            size: stats.size,
            recursive_delete: recursive && isDirectory,
            message: `${isDirectory ? '目录' : '文件'}删除成功`
          });
        } catch (error) {
          results.push({ 
            path: item.path, 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      
      return JSON.stringify({
        success: true,
        total: items.length,
        successful: successCount,
        failed: items.length - successCount,
        statistics: {
          total_deleted_files: totalDeletedFiles,
          total_deleted_directories: totalDeletedDirs,
          total_deleted_size: totalDeletedSize,
          total_deleted_size_human: this.formatFileSize(totalDeletedSize)
        },
        results: results
      }, null, 2);
    } catch (error) {
      this.logger.error('批量删除失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `批量删除失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 计算目录统计信息（递归）
   */
  private async calculateDirectoryStats(dirPath: string): Promise<{fileCount: number, dirCount: number, totalSize: number}> {
    let fileCount = 0;
    let dirCount = 0;
    let totalSize = 0;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          dirCount++;
          const subStats = await this.calculateDirectoryStats(fullPath);
          fileCount += subStats.fileCount;
          dirCount += subStats.dirCount;
          totalSize += subStats.totalSize;
        } else {
          fileCount++;
          try {
            const stats = fs.statSync(fullPath);
            totalSize += stats.size;
          } catch (err) {
            // 忽略单个文件的统计错误
          }
        }
      }
    } catch (error) {
      // 目录访问失败，返回当前统计
    }

    return { fileCount, dirCount, totalSize };
  }
}

/**
 * 创建文件管理工具实例
 */
export function createFileManagerToolV2(): FileManagerToolV2 {
  return new FileManagerToolV2();
} 





/*
### 7. 精确定位修改文件
  操作：precise_edit
  参数：path (必填), edit_type (必填), 其他参数根据编辑类型而定
  
  编辑类型：
  - replace_lines: 替换指定行范围
    参数：start_line, end_line, content
  - insert_lines: 在指定行后插入内容
    参数：line, content  
  - delete_lines: 删除指定行范围
    参数：start_line, end_line
  - replace_text: 替换指定文本
    参数：old_text, new_text, replace_all (可选)
  
  示例：
  {"input": "{"action": "precise_edit", "path": "src/index.js", "edit_type": "replace_lines", "start_line": 1, "end_line": 3, "content": "// 新的代码\\nconsole.log('updated');"}"}
*/