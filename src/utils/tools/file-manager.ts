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

  FileManagerTool 是一个文件管理工具，提供文件的增删改查、补丁应用等功能。下面是一些简单的示例，可以用来调用工具.
  示例 1：
  问题：查看项目根目录文件
  推理：需要执行列表操作→action 设为 list，当前目录路径为 "."→无需递归参数
  输入：{"input": "{"action":"list","path":"."}"}
  预期输出：{"success": true, "path": ".", "contents": [...]}
  示例 2：
  问题：读取 src/index.js 内容
  推理：确定为 read 操作→路径填写 "src/index.js"→使用默认 utf8 编码
  输入：{"input": "{"action":"read","path":"src/index.js"}"}
  预期输出：{"success": true, "content": "...", "size": 542}
  示例 3：
  问题：为 App.js 添加状态管理
  推理：选择 apply_patch 操作→构造包含 import 语句的 diff 补丁→确保以 *** Begin Patch 开头
  输入：{"input": "{"action":"apply_patch","patch":"*** Begin Patch\n--- a/src/App.js\n+++ b/src/App.js\n@@ -1,3 +1,4 @@\n import React from 'react'\n+import { useState} from 'react'\n function App () {\n const [count, setCount] = useState (0);\n return <div>Count: {count}</div>;\n }\n*** End Patch"}"}
  预期输出：{"success": true, "applied": true}
  ## 思维链调用流程
  问题分析：确定操作类型（list/read/write 等），检查必填参数（如 path/content/patch）
  路径校验：确保无 ".."、绝对路径或隐藏文件（如禁止 "/etc/passwd" 或 "..config"）
  参数构造：按格式 {"input": "{"action":"...","path":"...",...}"} 组装 JSON
  格式验证：确保 JSON 语法正确，字段引号匹配（可用 jsonlint 工具校验）
  ## 操作参数映射表
  list：必填 action, path；可选 recursive（是否递归列表）
  write：必填 action, path, content；可选 encoding
  apply_patch：必填 action, patch（需包含 *** Begin/End Patch 标记）
  ## 安全约束
  路径禁止项：不允许包含 ".."、绝对路径（如 "/user"）或以 "." 开头的隐藏文件
  内容限制：write 操作的 content 避免含系统命令（如 "rm -rf"）
  补丁要求：必须以 "*** Begin Patch" 开头和 "*** End Patch" 结尾
  ## 多场景调用示例
  目录操作：{"input": "{"action":"create_directory","path":"build/assets","recursive": true}"}
  文件操作：{"input": "{"action":"write","path":"README.md","content":"# 项目说明 "}"}
  重命名操作：{"input": "{"action":"rename","path":"old.js","new_path":"src/utils/new.js"}"}
  ## 错误处理示例
  问题：调用 write 返回 "无效路径"
  推理：检查输入发现 path 为 "src/../config"→含非法 ".."→修正为 "config"→重新构造输入
  请按照上述示例的推理逻辑和格式要求，生成符合 FileManagerTool 接口规范的调用参数。确保输入为合法 JSON 字符串，且所有路径为相对路径。
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

      const { action, path: filePath, content, patch, encoding, recursive, new_path } = parsed;

      // 验证必需参数
      if (!action) {
        this.logger.error('缺少必需参数: action', { parsed });
        return JSON.stringify({ error: "缺少必需参数: action" });
      }

      if (!filePath && action !== 'apply_patch') {
        this.logger.error('缺少必需参数: path', { parsed });
        return JSON.stringify({ error: "缺少必需参数: path" });
      }

      this.logger.info('开始执行文件操作', { action, filePath });

      // 安全检查：防止路径遍历攻击
      const safePath = this.sanitizePath(filePath);
      if (!safePath && action !== 'apply_patch') {
        this.logger.error('无效的文件路径', { filePath });
        return JSON.stringify({ error: "无效的文件路径" });
      }

      // 转换为系统路径
      const systemPath = safePath ? this.toSystemPath(safePath) : '';

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
    if (!filePath || typeof filePath !== 'string') {
      return null;
    }
    
    // 防止路径遍历攻击
    if (filePath.includes('..') || filePath.includes('...')) {
      return null;
    }
    
    // 防止绝对路径访问
    if (path.isAbsolute(filePath)) {
      return null;
    }
    
    // 防止访问隐藏文件和系统文件
    if (filePath.startsWith('.') && !filePath.startsWith('./')) {
      return null;
    }
    
    // 标准化路径
    const normalizedPath = path.normalize(filePath);
    
    // 再次检查标准化后的路径是否包含上级目录访问
    if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
      return null;
    }
    
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
  private listDirectory(dirPath: string, recursive: boolean = false): string {
    try {
      const result = this.listDirectoryRecursive(dirPath, recursive);
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

  private listDirectoryRecursive(dirPath: string, recursive: boolean): any[] {
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
        item.children = this.listDirectoryRecursive(fullPath, true);
      }

      items.push(item);
    }

    return items;
  }

  /**
   * 读取文件内容
   */
  private readFile(filePath: string, encoding: string = 'utf8'): string {
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