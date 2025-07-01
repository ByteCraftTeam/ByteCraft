import { Tool } from '@langchain/core/tools';
import fs from 'fs';
import path from 'path';
import { process_patch, DiffError, PATCH_PREFIX } from './patch-parser.js';
import { LoggerManager } from '../logger/logger.js';

/**
 * 文件管理工具类
 * 提供文件的增删改查、补丁应用等功能
 */
export class FileManagerTool extends Tool {
  name = 'file_manager';
  description = `
  FileManagerTool 调用指南

  FileManagerTool 是一个文件管理工具，提供文件的增删改查、补丁应用等功能，支持单文件和批量操作。
  
  ## 单文件操作示例
  示例 1：查看项目根目录文件
  输入：{"input": "{"action":"list","path":"."}"}
  预期输出：{"success": true, "path": ".", "contents": [...]}
  
  示例 2：读取单个文件
  输入：{"input": "{"action":"read","path":"src/index.js"}"}
  预期输出：{"success": true, "content": "...", "size": 542}
  
  示例 3：写入单个文件
  输入：{"input": "{"action":"write","path":"README.md","content":"# 项目说明"}"}
  预期输出：{"success": true, "message": "文件写入成功"}
  
  ## 批量操作示例
  示例 4：批量读取文件
  输入：{"input": "{"action":"batch_read","paths":["src/index.js","README.md","package.json"]}"}
  预期输出：{"success": true, "results": [{"path":"src/index.js","content":"...","success":true}, ...]}
  
  示例 5：批量删除文件
  输入：{"input": "{"action":"batch_delete","paths":["temp1.txt","temp2.txt","temp3.txt"]}"}
  预期输出：{"success": true, "results": [{"path":"temp1.txt","success":true}, ...]}
  
  示例 6：批量写入文件
  输入：{"input": "{"action":"batch_write","files":[{"path":"file1.txt","content":"内容1"},{"path":"file2.txt","content":"内容2"}]}"}
  预期输出：{"success": true, "results": [{"path":"file1.txt","success":true}, ...]}
  
  示例 7：批量创建目录
  输入：{"input": "{"action":"batch_create_directory","paths":["dir1","dir2/subdir","dir3"]}"}
  预期输出：{"success": true, "results": [{"path":"dir1","success":true}, ...]}
  
  ## 操作参数映射表
  单文件操作：
  - list：必填 action, path；可选 recursive
  - read：必填 action, path；可选 encoding
  - write：必填 action, path, content；可选 encoding
  - delete：必填 action, path
  - rename：必填 action, path, new_path
  - create_directory：必填 action, path；可选 recursive
  - apply_patch：必填 action, patch
  
  批量操作：
  - batch_read：必填 action, paths；可选 encoding
  - batch_delete：必填 action, paths
  - batch_write：必填 action, files（数组，每个元素包含path和content）；可选 encoding
  - batch_create_directory：必填 action, paths；可选 recursive
  
  ## 安全约束
  补丁要求：必须以 "*** Begin Patch" 开头和 "*** End Patch" 结尾
  批量操作限制：单次批量操作最多支持100个文件
  
  ## 错误处理
  批量操作中，单个文件失败不会影响其他文件的处理，每个文件的结果会单独记录。
  请按照上述示例的推理逻辑和格式要求，生成符合 FileManagerTool 接口规范的调用参数。
  `;

  private logger: any;

  constructor() {
    super();
    // 获取logger实例
    this.logger = LoggerManager.getInstance().getLogger('file-manager');
  }

  protected async _call(input: string): Promise<string> {
    try {
      this.logger.info('文件管理工具被调用', { input });
      
      // 输入验证
      if (!input || typeof input !== 'string') {
        this.logger.error('无效的输入', { input, type: typeof input });
        return JSON.stringify({ 
          error: `无效的输入: 期望字符串，但收到 ${typeof input}`,
          received: input
        });
      }

      let parsed;
      try {
        parsed = JSON.parse(input);
        this.logger.info('JSON解析成功', { parsed });
      } catch (parseError) {
        this.logger.error('JSON解析失败', { input, error: parseError });
        return JSON.stringify({ 
          error: `JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          input: input
        });
      }

      const { action, path: filePath, content, patch, encoding, recursive, new_path, paths, files } = parsed;

      // 验证必需参数
      if (!action) {
        this.logger.error('缺少必需参数: action', { parsed });
        return JSON.stringify({ error: "缺少必需参数: action" });
      }

      // 根据操作类型验证参数
      if (action.startsWith('batch_')) {
        // 批量操作参数验证
        if (action === 'batch_read' || action === 'batch_delete' || action === 'batch_create_directory') {
          if (!paths || !Array.isArray(paths)) {
            this.logger.error('批量操作缺少必需参数: paths', { parsed });
            return JSON.stringify({ error: "批量操作缺少必需参数: paths (数组)" });
          }
          if (paths.length > 100) {
            this.logger.error('批量操作文件数量超限', { pathsLength: paths.length });
            return JSON.stringify({ error: "批量操作最多支持100个文件" });
          }
        } else if (action === 'batch_write') {
          if (!files || !Array.isArray(files)) {
            this.logger.error('批量写入缺少必需参数: files', { parsed });
            return JSON.stringify({ error: "批量写入缺少必需参数: files (数组)" });
          }
          if (files.length > 100) {
            this.logger.error('批量写入文件数量超限', { filesLength: files.length });
            return JSON.stringify({ error: "批量写入最多支持100个文件" });
          }
        }
      } else {
        // 单文件操作参数验证
        if (!filePath && action !== 'apply_patch') {
          this.logger.error('缺少必需参数: path', { parsed });
          return JSON.stringify({ error: "缺少必需参数: path" });
        }
      }

      this.logger.info('开始执行文件操作', { action, filePath, paths, files });
      let safePath: string | null = null;
      let systemPath = '';
      
      if (action !== 'delete' && action !== 'batch_delete') {
        safePath = this.sanitizePath(filePath);
        if (!safePath && action !== 'apply_patch') {
          this.logger.error('无效的文件路径', { filePath });
          return JSON.stringify({ error: "无效的文件路径" });
        }
        // 转换为系统路径
        systemPath = safePath ? this.toSystemPath(safePath) : '';
      } else {
        // 删除操作直接使用原始路径
        systemPath = filePath;
      }

      let result: string;
      switch (action) {
        case 'list':
          result = await this.listDirectory(systemPath, recursive);
          break;
        
        case 'read':
          result = await this.readFile(systemPath, encoding);
          break;
        
        case 'write':
          result = await this.writeFile(systemPath, content || '', encoding);
          break;
        
        case 'delete':
          result = await this.deleteFile(systemPath);
          break;
        
        case 'rename':
          result = await this.renameFile(systemPath, new_path);
          break;
        
        case 'apply_patch':
          result = await this.applyPatch(patch || '');
          break;
        
        case 'create_directory':
          result = await this.createDirectory(systemPath, recursive);
          break;
        
        case 'batch_read':
          result = await this.batchRead(paths, encoding);
          break;
        
        case 'batch_delete':
          result = await this.batchDelete(paths);
          break;
        
        case 'batch_write':
          result = await this.batchWrite(files, encoding);
          break;
        
        case 'batch_create_directory':
          result = await this.batchCreateDirectory(paths, recursive);
          break;
        
        default:
          this.logger.error('不支持的操作', { action });
          result = JSON.stringify({ error: `不支持的操作: ${action}` });
      }

      this.logger.info('文件操作完成', { action, result });
      return result;
    } catch (error) {
      this.logger.error('文件管理工具执行失败', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
      return JSON.stringify({ 
        error: `操作失败: ${error instanceof Error ? error.message : String(error)}`,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * 路径安全检查
   * 防止路径遍历攻击和绝对路径访问
   */
  private sanitizePath(filePath: string): string | null {
    this.logger.info('开始路径安全检查', { filePath });
    
    if (!filePath || typeof filePath !== 'string') {
      this.logger.error('路径安全检查失败：无效路径', { filePath, type: typeof filePath });
      return null;
    }
    
    // 防止路径遍历攻击
    if (filePath.includes('..') || filePath.includes('...')) {
      this.logger.error('路径安全检查失败：包含路径遍历', { filePath });
      return null;
    }
    
    // 防止绝对路径访问
    if (path.isAbsolute(filePath)) {
      this.logger.error('路径安全检查失败：绝对路径', { filePath });
      return null;
    }    
    // 标准化路径
    const normalizedPath = path.normalize(filePath);
    
    // 再次检查标准化后的路径是否包含上级目录访问
    if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
      this.logger.error('路径安全检查失败：标准化后仍包含非法路径', { 
        originalPath: filePath, 
        normalizedPath 
      });
      return null;
    }
    
    this.logger.info('路径安全检查通过', { 
      originalPath: filePath, 
      normalizedPath 
    });
    
    return normalizedPath;
  }

  /**
   * 确保路径使用系统原生分隔符，但保持相对路径
   */
  private toSystemPath(filePath: string): string {
    this.logger.info('转换系统路径', { filePath });
    
    // 标准化路径但保持相对路径
    const systemPath = path.normalize(filePath);
    
    this.logger.info('系统路径转换完成', { 
      originalPath: filePath, 
      systemPath 
    });
    
    return systemPath;
  }

  /**
   * 列出目录内容
   */
  private listDirectory(dirPath: string, recursive: boolean = false): string {
    try {
      this.logger.info('开始列出目录', { dirPath, recursive });
      
      const result = this.listDirectoryRecursive(dirPath, recursive);
      
      this.logger.info('目录列表获取成功', { 
        dirPath, 
        recursive, 
        itemCount: result.length 
      });
      
      return JSON.stringify({ 
        success: true, 
        path: dirPath,
        contents: result 
      }, null, 2);
    } catch (error) {
      this.logger.error('列出目录失败', { 
        dirPath, 
        recursive, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({ 
        error: `无法列出目录 ${dirPath}: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  private listDirectoryRecursive(dirPath: string, recursive: boolean): any[] {
    this.logger.info('递归列出目录内容', { dirPath, recursive });
    
    const items: any[] = [];
    
    if (!fs.existsSync(dirPath)) {
      this.logger.error('目录不存在', { dirPath });
      throw new Error(`目录不存在: ${dirPath}`);
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    this.logger.info('读取目录条目', { dirPath, entryCount: entries.length });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const stats = fs.statSync(fullPath);
      
      const item: any = {
        name: entry.name,
        path: fullPath,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime,
        permissions: stats.mode
      };

      if (entry.isDirectory() && recursive) {
        this.logger.info('递归处理子目录', { subDir: fullPath });
        item.children = this.listDirectoryRecursive(fullPath, true);
      }

      items.push(item);
    }

    this.logger.info('目录递归处理完成', { dirPath, itemCount: items.length });
    return items;
  }

  /**
   * 读取文件内容
   */
  private readFile(filePath: string, encoding: string = 'utf8'): string {
    try {
      this.logger.info('开始读取文件', { filePath, encoding });
      
      if (!fs.existsSync(filePath)) {
        this.logger.error('文件不存在', { filePath });
        return JSON.stringify({ error: `文件不存在: ${filePath}` });
      }

      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        this.logger.error('路径是目录而不是文件', { filePath });
        return JSON.stringify({ error: `${filePath} 是一个目录，不是文件` });
      }

      this.logger.info('文件存在且是文件类型', { filePath, size: stats.size });
      
      const content = fs.readFileSync(filePath, encoding as BufferEncoding);
      
      this.logger.info('文件读取成功', { 
        filePath, 
        encoding, 
        size: stats.size,
        contentLength: content.length 
      });
      
      return JSON.stringify({ 
        success: true, 
        path: filePath,
        content,
        size: stats.size,
        modified: stats.mtime
      });
    } catch (error) {
      this.logger.error('读取文件失败', { 
        filePath, 
        encoding, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({ 
        error: `读取文件失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 写入文件内容
   */
  private async writeFile(filePath: string, content: string, encoding: string = 'utf8'): Promise<string> {
    try {
      this.logger.info('开始写入文件', { 
        filePath, 
        encoding, 
        contentLength: content.length,
        fileExists: fs.existsSync(filePath)
      });
      
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        this.logger.info('创建父目录', { dir });
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, { encoding: encoding as BufferEncoding });
      const stats = fs.statSync(filePath);
      
      this.logger.info('文件写入成功', { 
        filePath, 
        encoding, 
        size: stats.size,
        contentLength: content.length 
      });
      
      return JSON.stringify({ 
        success: true, 
        path: filePath,
        message: '文件写入成功',
        size: stats.size
      });
    } catch (error) {
      this.logger.error('写入文件失败', { 
        filePath, 
        encoding, 
        contentLength: content.length,
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({ 
        error: `写入文件失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 删除文件或目录
   */
  private async deleteFile(filePath: string): Promise<string> {
    try {
      this.logger.info('开始删除文件或目录', { filePath });
      
      if (!fs.existsSync(filePath)) {
        this.logger.error('文件或目录不存在', { filePath });
        return JSON.stringify({ error: `文件或目录不存在: ${filePath}` });
      }

      const stats = fs.statSync(filePath);
      const isDirectory = stats.isDirectory();
      
      this.logger.info('确认删除目标', { filePath, isDirectory, size: stats.size });

      if (isDirectory) {
        this.logger.info('删除目录', { filePath });
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        this.logger.info('删除文件', { filePath });
        fs.unlinkSync(filePath);
      }

      this.logger.info('删除操作成功', { filePath, isDirectory });
      
      return JSON.stringify({ 
        success: true, 
        path: filePath,
        message: '删除成功'
      });
    } catch (error) {
      this.logger.error('删除操作失败', { 
        filePath, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({ 
        error: `删除失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 重命名文件或目录
   */
  private async renameFile(oldPath: string, newPath: string): Promise<string> {
    try {
      this.logger.info('开始重命名操作', { oldPath, newPath });
      
      if (!newPath) {
        this.logger.error('新路径为空', { oldPath, newPath });
        return JSON.stringify({ error: "新路径不能为空" });
      }

      // 安全检查新路径
      const safeNewPath = this.sanitizePath(newPath);
      if (!safeNewPath) {
        this.logger.error('新路径安全检查失败', { oldPath, newPath });
        return JSON.stringify({ error: "无效的新文件路径" });
      }

      // 转换为系统路径
      const systemOldPath = this.toSystemPath(oldPath);
      const systemNewPath = this.toSystemPath(safeNewPath);

      this.logger.info('路径转换完成', { 
        oldPath, 
        newPath, 
        systemOldPath, 
        systemNewPath 
      });

      if (!fs.existsSync(systemOldPath)) {
        this.logger.error('源文件或目录不存在', { systemOldPath });
        return JSON.stringify({ error: `源文件或目录不存在: ${oldPath}` });
      }

      if (fs.existsSync(systemNewPath)) {
        this.logger.error('目标路径已存在', { systemNewPath });
        return JSON.stringify({ error: `目标路径已存在: ${safeNewPath}` });
      }

      // 确保目标目录存在
      const newDir = path.dirname(systemNewPath);
      if (!fs.existsSync(newDir)) {
        this.logger.info('创建目标目录', { newDir });
        fs.mkdirSync(newDir, { recursive: true });
      }

      this.logger.info('执行重命名操作', { systemOldPath, systemNewPath });
      fs.renameSync(systemOldPath, systemNewPath);

      this.logger.info('重命名操作成功', { oldPath, newPath: safeNewPath });
      
      return JSON.stringify({ 
        success: true, 
        old_path: oldPath,
        new_path: safeNewPath,
        message: '重命名成功'
      });
    } catch (error) {
      this.logger.error('重命名操作失败', { 
        oldPath, 
        newPath, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({ 
        error: `重命名失败 ${oldPath} -> ${newPath}: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 创建目录
   */
  private async createDirectory(dirPath: string, recursive: boolean = false): Promise<string> {
    try {
      this.logger.info('开始创建目录', { dirPath, recursive });
      
      if (fs.existsSync(dirPath)) {
        this.logger.info('目录已存在', { dirPath });
        return JSON.stringify({ 
          success: true, 
          path: dirPath,
          message: '目录已存在'
        });
      }

      this.logger.info('创建新目录', { dirPath, recursive });
      fs.mkdirSync(dirPath, { recursive });
      
      this.logger.info('目录创建成功', { dirPath, recursive });
      
      return JSON.stringify({ 
        success: true, 
        path: dirPath,
        message: '目录创建成功'
      });
    } catch (error) {
      this.logger.error('创建目录失败', { 
        dirPath, 
        recursive, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({ 
        error: `创建目录失败 ${dirPath}: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 应用代码补丁
   * 基于提供的patch应用逻辑
   */
  private async applyPatch(patchText: string): Promise<string> {
    try {
      this.logger.info('开始应用补丁', { 
        patchLength: patchText.length,
        patchStart: patchText.substring(0, 100) + '...'
      });
      
      if (!patchText.startsWith(PATCH_PREFIX.trim())) {
        this.logger.error('补丁格式错误', { 
          patchStart: patchText.substring(0, 50),
          expectedPrefix: PATCH_PREFIX.trim() 
        });
        return JSON.stringify({ error: "补丁必须以 '*** Begin Patch' 开头" });
      }

      this.logger.info('补丁格式验证通过，开始处理');
      
      const result = process_patch(
        patchText,
        (p: string) => this.openFile(p),
        (p: string, c: string) => this.writeFileForPatch(p, c),
        (p: string) => this.removeFile(p)
      );

      this.logger.info('补丁应用成功', { result });
      
      return JSON.stringify({ 
        success: true, 
        message: result,
        applied: true
      });
    } catch (error) {
      this.logger.error('应用补丁失败', { 
        patchLength: patchText.length,
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({ 
        error: `应用补丁失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  private openFile(p: string): string {
    this.logger.info('补丁处理：打开文件', { filePath: p });
    try {
      const content = fs.readFileSync(p, "utf8");
      this.logger.info('补丁处理：文件读取成功', { filePath: p, contentLength: content.length });
      return content;
    } catch (error) {
      this.logger.error('补丁处理：文件读取失败', { 
        filePath: p, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  private writeFileForPatch(p: string, content: string): void {
    this.logger.info('补丁处理：写入文件', { 
      filePath: p, 
      contentLength: content.length 
    });
    
    if (path.isAbsolute(p)) {
      this.logger.error('补丁处理：不支持绝对路径', { filePath: p });
      throw new DiffError("We do not support absolute paths.");
    }
    
    const parent = path.dirname(p);
    if (parent !== ".") {
      this.logger.info('补丁处理：创建父目录', { parent });
      fs.mkdirSync(parent, { recursive: true });
    }
    
    fs.writeFileSync(p, content, "utf8");
    this.logger.info('补丁处理：文件写入成功', { filePath: p, contentLength: content.length });
  }

  private removeFile(p: string): void {
    this.logger.info('补丁处理：删除文件', { filePath: p });
    try {
      fs.unlinkSync(p);
      this.logger.info('补丁处理：文件删除成功', { filePath: p });
    } catch (error) {
      this.logger.error('补丁处理：文件删除失败', { 
        filePath: p, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * 批量读取文件
   */
  private async batchRead(paths: string[], encoding: string = 'utf8'): Promise<string> {
    try {
      this.logger.info('开始批量读取文件', { paths, encoding });
      
      const results: any[] = [];
      
      for (const filePath of paths) {
        try {
          this.logger.info('处理单个文件路径', { filePath });
          
          // 安全检查路径
          const safePath = this.sanitizePath(filePath);
          if (!safePath) {
            results.push({ 
              path: filePath, 
              success: false, 
              error: "无效的文件路径" 
            });
            continue;
          }
          
          const systemPath = this.toSystemPath(safePath);
          const result = await this.readFile(systemPath, encoding);
          const parsedResult = JSON.parse(result);
          results.push({ path: filePath, ...parsedResult });
        } catch (error) {
          results.push({ 
            path: filePath, 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      this.logger.info('批量读取完成', { paths, results: results.length });
      return JSON.stringify({ 
        success: true, 
        results: results 
      });
    } catch (error) {
      this.logger.error('批量读取失败', { 
        paths, 
        encoding, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({ 
        error: `批量读取失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 批量删除文件
   */
  private async batchDelete(paths: string[]): Promise<string> {
    try {
      this.logger.info('开始批量删除文件', { paths });
      
      const results: any[] = [];
      
      for (const filePath of paths) {
        try {
          this.logger.info('处理单个文件路径', { filePath });
          
          const result = await this.deleteFile(filePath);
          const parsedResult = JSON.parse(result);
          results.push({ path: filePath, ...parsedResult });
        } catch (error) {
          results.push({ 
            path: filePath, 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      this.logger.info('批量删除完成', { paths, results: results.length });
      return JSON.stringify({ 
        success: true, 
        results: results 
      });
    } catch (error) {
      this.logger.error('批量删除失败', { 
        paths, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({ 
        error: `批量删除失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 批量写入文件
   */
  private async batchWrite(files: Array<{path: string, content: string}>, encoding: string = 'utf8'): Promise<string> {
    try {
      this.logger.info('开始批量写入文件', { filesCount: files.length, encoding });
      
      const results: any[] = [];
      
      for (const file of files) {
        try {
          // 安全检查路径
          const safePath = this.sanitizePath(file.path);
          if (!safePath) {
            results.push({ 
              path: file.path, 
              success: false, 
              error: "无效的文件路径" 
            });
            continue;
          }
          
          const systemPath = this.toSystemPath(safePath);
          const result = await this.writeFile(systemPath, file.content, encoding);
          const parsedResult = JSON.parse(result);
          results.push({ path: file.path, ...parsedResult });
        } catch (error) {
          results.push({ 
            path: file.path, 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      this.logger.info('批量写入完成', { filesCount: files.length, results: results.length });
      return JSON.stringify({ 
        success: true, 
        results: results 
      });
    } catch (error) {
      this.logger.error('批量写入失败', { 
        filesCount: files.length, 
        encoding, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({ 
        error: `批量写入失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 批量创建目录
   */
  private async batchCreateDirectory(paths: string[], recursive: boolean = false): Promise<string> {
    try {
      this.logger.info('开始批量创建目录', { paths, recursive });
      
      const results: any[] = [];
      
      for (const dirPath of paths) {
        try {
          // 安全检查路径
          const safePath = this.sanitizePath(dirPath);
          if (!safePath) {
            results.push({ 
              path: dirPath, 
              success: false, 
              error: "无效的目录路径" 
            });
            continue;
          }
          
          const systemPath = this.toSystemPath(safePath);
          const result = await this.createDirectory(systemPath, recursive);
          const parsedResult = JSON.parse(result);
          results.push({ path: dirPath, ...parsedResult });
        } catch (error) {
          results.push({ 
            path: dirPath, 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      this.logger.info('批量创建目录完成', { paths, results: results.length });
      return JSON.stringify({ 
        success: true, 
        results: results 
      });
    } catch (error) {
      this.logger.error('批量创建目录失败', { 
        paths, 
        recursive, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return JSON.stringify({ 
        error: `批量创建目录失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }
}

/**
 * 创建文件管理工具实例
 */
export function createFileManagerTool(): FileManagerTool {
  return new FileManagerTool();
} 