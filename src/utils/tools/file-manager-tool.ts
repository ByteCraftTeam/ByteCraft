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
  1. 📁 递归读取文件夹所有内容
  2. 📄 读取单个文件内容
  3. 🔧 批量创建文件夹和文件 
  4. ✏️ 精确定位修改文件内容
  5. 🗑️ 删除文件和目录
  
  ## 核心功能

  ### 1. 读取文件夹所有内容
  操作：read_folder
  参数：path (必填), recursive (可选，默认true)
  
  示例：
  {"action": "read_folder", "path": "src", "recursive": true}
  
  返回：完整的文件夹结构，包括所有文件内容

  ### 2. 读取单个文件内容
  操作：read_file
  参数：path (必填)
  
  示例：
  {"action": "read_file", "path": "src/index.js"}
  
  返回：单个文件的详细信息和内容

  ### 3. 批量创建文件夹
  操作：batch_create_folders
  参数：folders (必填，字符串数组)
  
  示例：
  {"action": "batch_create_folders", "folders": ["src/components", "src/utils", "tests"]}

  ### 4. 批量创建文件并写入内容
  操作：batch_create_files
  参数：files (必填，对象数组，包含path和content)
  
  示例：
  {"action": "batch_create_files", "files": [
    {"path": "src/index.js", "content": "console.log('Hello');"},
    {"path": "README.md", "content": "# 项目说明"}
  ]}

  ### 5. 精确定位修改文件
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
  {"action": "precise_edit", "path": "src/index.js", "edit_type": "replace_lines", "start_line": 1, "end_line": 3, "content": "// 新的代码\\nconsole.log('updated');"}

  ### 6. 删除文件或目录
  操作：delete_item
  参数：path (必填), recursive (可选，删除目录时是否递归删除，默认false)
  
  示例：
  {"action": "delete_item", "path": "src/temp.js"}
  {"action": "delete_item", "path": "temp_folder", "recursive": true}
  
  返回：删除操作的详细结果

  ### 7. 批量删除文件或目录
  操作：batch_delete
  参数：items (必填，对象数组，包含path和可选的recursive)
  
  示例：
  {"action": "batch_delete", "items": [
    {"path": "src/temp1.js"},
    {"path": "temp_folder", "recursive": true},
    {"path": "src/temp2.js"}
  ]}

  ## 输入格式
  所有输入都是JSON字符串格式，需要将JSON对象转换为字符串传递。
  `;

  private logger: any;

  constructor() {
    super();
    this.logger = LoggerManager.getInstance().getLogger('file-manager-v2');
  }

  protected async _call(input: string): Promise<string> {
    try {
      this.logger.info('文件管理工具V2被调用', { input });
      
      if (!input || typeof input !== 'string') {
        return JSON.stringify({ 
          error: `无效的输入: 期望字符串，但收到 ${typeof input}`,
          received: input
        });
      }

      let parsed;
      try {
        parsed = JSON.parse(input);
      } catch (parseError) {
        return JSON.stringify({ 
          error: `JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          input: input
        });
      }

      const { action } = parsed;
      if (!action) {
        return JSON.stringify({ error: "缺少必需参数: action" });
      }

      let result: string;
      switch (action) {
        case 'read_folder':
          result = await this.readFolder(parsed.path, parsed.recursive);
          break;
        
        case 'read_file':
          result = await this.readSingleFile(parsed.path);
          break;
        
        case 'batch_create_folders':
          result = await this.batchCreateFolders(parsed.folders);
          break;
        
        case 'batch_create_files':
          result = await this.batchCreateFiles(parsed.files);
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
  private async readFolder(folderPath: string, recursive: boolean = true): Promise<string> {
    try {
      this.logger.info('开始读取文件夹', { folderPath, recursive });
      
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

      const result = await this.readFolderRecursive(safePath, recursive);
      
      return JSON.stringify({
        success: true,
        path: folderPath,
        total_files: this.countFiles(result),
        total_folders: this.countFolders(result),
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
  private async readFolderRecursive(dirPath: string, recursive: boolean): Promise<any[]> {
    const items: any[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const stats = fs.statSync(fullPath);
      
      if (entry.isDirectory()) {
        const folderItem: any = {
          name: entry.name,
          path: fullPath,
          type: 'folder',
          size: 0,
          modified: stats.mtime,
          children: recursive ? await this.readFolderRecursive(fullPath, true) : []
        };
        items.push(folderItem);
      } else {
        // 读取文件内容
        let content = '';
        let contentError = null;
        try {
          // 对于文本文件，读取内容；对于二进制文件，只读取信息
          if (this.isTextFile(entry.name)) {
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
          is_text_file: this.isTextFile(entry.name)
        };
        items.push(fileItem);
      }
    }

    return items;
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
  private isTextFile(filename: string): boolean {
    const textExtensions = ['.txt', '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.yml', '.yaml', 
                           '.xml', '.html', '.css', '.scss', '.sass', '.less', '.py', '.java', 
                           '.c', '.cpp', '.h', '.php', '.rb', '.go', '.rs', '.swift', '.kt', 
                           '.sh', '.bat', '.ps1', '.sql', '.r', '.m', '.scala', '.clj', '.hs'];
    
    const ext = path.extname(filename).toLowerCase();
    return textExtensions.includes(ext) || !ext; // 无扩展名的文件也当作文本文件
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
  private async readSingleFile(filePath: string): Promise<string> {
    try {
      this.logger.info('开始读取单个文件', { filePath });
      
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
      let isTextFile = this.isTextFile(path.basename(safePath));
      
      try {
        if (isTextFile) {
          content = fs.readFileSync(safePath, 'utf8');
        } else {
          content = '[Binary file - content not displayed]';
        }
      } catch (err) {
        contentError = err instanceof Error ? err.message : String(err);
      }

      // 如果是文本文件，计算行数
      const lines = isTextFile && content ? content.split('\n') : [];
      
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