import { Tool } from '@langchain/core/tools';
import fs from 'fs';
import path from 'path';
import { process_patch, DiffError, PATCH_PREFIX } from './patch-parser.js';

/**
 * 文件管理工具类
 * 提供文件的增删改查、补丁应用等功能
 */
export class FileManagerTool extends Tool {
  name = 'file_manager';
  description = `文件管理工具，支持以下操作：
  - list: 列出目录内容
  - read: 读取文件内容  
  - write: 写入文件内容
  - delete: 删除文件
  - rename: 重命名文件或目录
  - apply_patch: 应用代码补丁
  - create_directory: 创建目录
  
  输入格式为JSON: {"action": "操作类型", "path": "文件路径", "content": "内容(可选)", "new_path": "新路径(重命名时使用)", "patch": "补丁内容(可选)"}`;



  constructor() {
    super();
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsed = JSON.parse(input);
      const { action, path: filePath, content, patch, encoding, recursive, new_path } = parsed;

      // 安全检查：防止路径遍历攻击
      const safePath = this.sanitizePath(filePath);
      if (!safePath) {
        return JSON.stringify({ error: "无效的文件路径" });
      }

      // 转换为系统路径
      const systemPath = this.toSystemPath(safePath);

      switch (action) {
        case 'list':
          return await this.listDirectory(systemPath, recursive);
        
        case 'read':
          return await this.readFile(systemPath, encoding);
        
        case 'write':
          return await this.writeFile(systemPath, content || '', encoding);
        
        case 'delete':
          return await this.deleteFile(systemPath);
        
        case 'rename':
          return await this.renameFile(systemPath, new_path);
        
        case 'apply_patch':
          return await this.applyPatch(patch || '');
        
        case 'create_directory':
          return await this.createDirectory(systemPath, recursive);
        
        default:
          return JSON.stringify({ error: `不支持的操作: ${action}` });
      }
    } catch (error) {
      return JSON.stringify({ 
        error: `操作失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 路径安全检查
   */
  private sanitizePath(filePath: string): string | null {
    if (!filePath || filePath.includes('..') || path.isAbsolute(filePath)) {
      return null;
    }
    // 标准化路径分隔符，统一使用正斜杠
    const normalizedPath = path.normalize(filePath).replace(/\\/g, '/');
    return normalizedPath;
  }

  /**
   * 确保路径使用系统原生分隔符，但保持相对路径
   */
  private toSystemPath(filePath: string): string {
    // 标准化路径但保持相对路径
    return path.normalize(filePath);
  }

  /**
   * 列出目录内容
   */
  private async listDirectory(dirPath: string, recursive: boolean = false): Promise<string> {
    try {
      const result = await this.listDirectoryRecursive(dirPath, recursive);
      return JSON.stringify({ 
        success: true, 
        path: dirPath,
        contents: result 
      }, null, 2);
    } catch (error) {
      return JSON.stringify({ 
        error: `无法列出目录 ${dirPath}: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  private async listDirectoryRecursive(dirPath: string, recursive: boolean): Promise<any[]> {
    const items: any[] = [];
    
    if (!fs.existsSync(dirPath)) {
      throw new Error(`目录不存在: ${dirPath}`);
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
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
        item.children = await this.listDirectoryRecursive(fullPath, true);
      }

      items.push(item);
    }

    return items;
  }

  /**
   * 读取文件内容
   */
  private async readFile(filePath: string, encoding: string = 'utf8'): Promise<string> {
    try {
      if (!fs.existsSync(filePath)) {
        return JSON.stringify({ error: `文件不存在: ${filePath}` });
      }

      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        return JSON.stringify({ error: `${filePath} 是一个目录，不是文件` });
      }

      const content = fs.readFileSync(filePath, encoding as BufferEncoding);
      return JSON.stringify({ 
        success: true, 
        path: filePath,
        content,
        size: stats.size,
        modified: stats.mtime
      });
    } catch (error) {
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
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, { encoding: encoding as BufferEncoding });
      const stats = fs.statSync(filePath);
      
      return JSON.stringify({ 
        success: true, 
        path: filePath,
        message: '文件写入成功',
        size: stats.size
      });
    } catch (error) {
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
      if (!fs.existsSync(filePath)) {
        return JSON.stringify({ error: `文件或目录不存在: ${filePath}` });
      }

      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }

      return JSON.stringify({ 
        success: true, 
        path: filePath,
        message: '删除成功'
      });
    } catch (error) {
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
      if (!newPath) {
        return JSON.stringify({ error: "新路径不能为空" });
      }

      // 安全检查新路径
      const safeNewPath = this.sanitizePath(newPath);
      if (!safeNewPath) {
        return JSON.stringify({ error: "无效的新文件路径" });
      }

      // 转换为系统路径
      const systemOldPath = this.toSystemPath(oldPath);
      const systemNewPath = this.toSystemPath(safeNewPath);

      if (!fs.existsSync(systemOldPath)) {
        return JSON.stringify({ error: `源文件或目录不存在: ${oldPath}` });
      }

      if (fs.existsSync(systemNewPath)) {
        return JSON.stringify({ error: `目标路径已存在: ${safeNewPath}` });
      }

      // 确保目标目录存在
      const newDir = path.dirname(systemNewPath);
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }

      fs.renameSync(systemOldPath, systemNewPath);

      return JSON.stringify({ 
        success: true, 
        old_path: oldPath,
        new_path: safeNewPath,
        message: '重命名成功'
      });
    } catch (error) {
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
      if (fs.existsSync(dirPath)) {
        return JSON.stringify({ 
          success: true, 
          path: dirPath,
          message: '目录已存在'
        });
      }

      fs.mkdirSync(dirPath, { recursive });
      
      return JSON.stringify({ 
        success: true, 
        path: dirPath,
        message: '目录创建成功'
      });
    } catch (error) {
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
      if (!patchText.startsWith(PATCH_PREFIX.trim())) {
        return JSON.stringify({ error: "补丁必须以 '*** Begin Patch' 开头" });
      }

      const result = process_patch(
        patchText,
        (p: string) => this.openFile(p),
        (p: string, c: string) => this.writeFileForPatch(p, c),
        (p: string) => this.removeFile(p)
      );

      return JSON.stringify({ 
        success: true, 
        message: result,
        applied: true
      });
    } catch (error) {
      return JSON.stringify({ 
        error: `应用补丁失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  private openFile(p: string): string {
    return fs.readFileSync(p, "utf8");
  }

  private writeFileForPatch(p: string, content: string): void {
    if (path.isAbsolute(p)) {
      throw new DiffError("We do not support absolute paths.");
    }
    const parent = path.dirname(p);
    if (parent !== ".") {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.writeFileSync(p, content, "utf8");
  }

  private removeFile(p: string): void {
    fs.unlinkSync(p);
  }
}

/**
 * 创建文件管理工具实例
 */
export function createFileManagerTool(): FileManagerTool {
  return new FileManagerTool();
} 