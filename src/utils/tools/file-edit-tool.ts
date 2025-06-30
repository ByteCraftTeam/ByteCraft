import { Tool } from '@langchain/core/tools';
import * as fs from 'fs';
import * as path from 'path';
import { LoggerManager } from '../logger/logger.js';

/**
 * 专门的文件修改工具
 * 提供精确的局部修改功能，避免全量覆写
 */
export class FileEditTool extends Tool {
  name = 'file_edit';
  description = `
  专门的文件修改工具 - 局部修改专家

  这是一个专门用于文件修改的工具，支持多种精确的局部修改操作，避免全量覆写文件。
  支持基于行号、文本匹配、正则表达式等多种修改模式。

  ## 🎯 核心功能

  ### 1. 基于行号的精确修改
  操作：edit_by_lines
  - replace_lines: 替换指定行范围
  - insert_lines: 在指定行号后插入内容
  - delete_lines: 删除指定行范围
  - prepend_lines: 在指定行号前插入内容

  ### 2. 基于文本匹配的修改
  操作：edit_by_text
  - replace_text: 替换匹配的文本
  - insert_after_text: 在匹配文本后插入内容
  - insert_before_text: 在匹配文本前插入内容
  - delete_text: 删除匹配的文本

  ### 3. 基于正则表达式的修改
  操作：edit_by_regex
  - replace_regex: 使用正则表达式替换
  - extract_and_replace: 提取匹配部分并替换

  ### 4. 批量修改操作
  操作：batch_edit
  - 支持在一个文件上执行多个修改操作
  - 按顺序执行，确保操作的一致性

  ### 5. 修改预览和安全检查
  操作：preview_edit
  - 预览修改结果而不实际修改文件
  - 显示修改前后的对比

  ## 📝 详细用法

  ### 1. 替换指定行范围
  {"input": "{"action": "edit_by_lines", "file_path": "src/index.js", "operation": "replace_lines", "start_line": 5, "end_line": 8, "content": "// 新的代码块\\nconsole.log('Updated code');\\nconst newVar = 'value';"}"}

  ### 2. 在指定行后插入内容
  {"input": "{"action": "edit_by_lines", "file_path": "src/config.js", "operation": "insert_lines", "line_number": 10, "content": "// 新增配置\\nexport const newConfig = {};"}"}

  ### 3. 删除指定行范围
  {"input": "{"action": "edit_by_lines", "file_path": "src/old.js", "operation": "delete_lines", "start_line": 15, "end_line": 20}"}

  ### 4. 替换匹配的文本
  {"input": "{"action": "edit_by_text", "file_path": "src/app.js", "operation": "replace_text", "old_text": "const oldFunction = () => {\\n  return 'old';\\n}", "new_text": "const newFunction = () => {\\n  return 'new';\\n}", "replace_all": false}"}

  ### 5. 在匹配文本后插入
  {"input": "{"action": "edit_by_text", "file_path": "src/imports.js", "operation": "insert_after_text", "target_text": "import React from 'react';", "content": "\\nimport { useState } from 'react';"}"}

  ### 6. 正则表达式替换
  {"input": "{"action": "edit_by_regex", "file_path": "src/version.js", "operation": "replace_regex", "pattern": "version\\s*=\\s*['\"]([^'\"]+)['\"]", "replacement": "version = '2.0.0'", "flags": "g"}"}

  ### 7. 批量修改操作
  {"input": "{"action": "batch_edit", "file_path": "src/main.js", "operations": [
    {
      "type": "edit_by_lines",
      "operation": "replace_lines", 
      "start_line": 1,
      "end_line": 1,
      "content": "// Updated header comment"
    },
    {
      "type": "edit_by_text",
      "operation": "replace_text",
      "old_text": "oldVariable",
      "new_text": "newVariable", 
      "replace_all": true
    }
  ]}"}

  ### 8. 预览修改
  {"input": "{"action": "preview_edit", "file_path": "src/test.js", "edit_config": {
    "type": "edit_by_lines",
    "operation": "replace_lines",
    "start_line": 5,
    "end_line": 7,
    "content": "console.log('Preview change');"
  }}"}

  ## 🛡️ 安全特性

  ### 自动备份
  - 每次修改前自动创建备份文件（.backup扩展名）
  - 支持恢复到备份版本

  ### 修改验证  
  - 行号边界检查
  - 文件存在性验证
  - 文本匹配验证

  ### 操作记录
  - 详细的修改日志
  - 支持操作回滚

  ## 📋 参数说明

  ### 通用参数
  - action (必填): 操作类型
  - file_path (必填): 要修改的文件路径  
  - create_backup (可选): 是否创建备份，默认true

  ### 基于行号修改的参数
  - operation (必填): 操作类型 [replace_lines, insert_lines, delete_lines, prepend_lines]
  - line_number (插入操作必填): 目标行号
  - start_line, end_line (范围操作必填): 起始和结束行号
  - content (新增内容操作必填): 要插入或替换的内容

  ### 基于文本修改的参数  
  - operation (必填): 操作类型 [replace_text, insert_after_text, insert_before_text, delete_text]
  - old_text, target_text (必填): 要匹配的文本
  - new_text, content (新增内容操作必填): 新的内容
  - replace_all (可选): 是否替换所有匹配，默认false
  - case_sensitive (可选): 是否区分大小写，默认true

  ### 正则表达式修改的参数
  - operation (必填): 操作类型 [replace_regex, extract_and_replace] 
  - pattern (必填): 正则表达式模式
  - replacement (必填): 替换内容
  - flags (可选): 正则表达式标志，默认"g"

  ## ⚠️ 注意事项
  - 行号从1开始计数
  - 换行符使用 \\n 表示
  - 自动处理不同操作系统的换行符
  - 批量操作按顺序执行，建议从文件末尾向前操作以避免行号变化
  - 每次修改都会创建备份文件（除非明确禁用）
  - 支持相对和绝对路径，但建议使用相对路径
  `;

  private logger: any;

  constructor() {
    super();
    this.logger = LoggerManager.getInstance().getLogger('file-edit-tool');
  }

  protected async _call(input: string): Promise<string> {
    try {
      this.logger.info('文件修改工具被调用', { input: input.substring(0, 200) });
      
      if (!input) {
        return JSON.stringify({ 
          error: `缺少输入参数`,
          received: input
        });
      }

      let parsed;
      try {
        parsed = JSON.parse(input);
      } catch (parseError) {
        this.logger.error('JSON解析失败', { input: input.substring(0, 200), error: parseError });
        return JSON.stringify({ 
          error: `JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          input: input.substring(0, 200)
        });
      }

      const { action, file_path } = parsed;
      if (!action) {
        return JSON.stringify({ error: "缺少必需参数: action" });
      }
      if (!file_path) {
        return JSON.stringify({ error: "缺少必需参数: file_path" });
      }

      // 安全路径检查
      const safePath = this.sanitizePath(file_path);
      if (!safePath) {
        return JSON.stringify({ error: "无效的文件路径" });
      }

      let result: string;
      switch (action) {
        case 'edit_by_lines':
          result = await this.editByLines(safePath, parsed);
          break;
        
        case 'edit_by_text':
          result = await this.editByText(safePath, parsed);
          break;
        
        case 'edit_by_regex':
          result = await this.editByRegex(safePath, parsed);
          break;
        
        case 'batch_edit':
          result = await this.batchEdit(safePath, parsed);
          break;
        
        case 'preview_edit':
          result = await this.previewEdit(safePath, parsed);
          break;
        
        default:
          result = JSON.stringify({ error: `不支持的操作: ${action}` });
      }

      this.logger.info('文件修改操作完成', { action, file_path, success: result.includes('"success":true') });
      return result;
    } catch (error) {
      this.logger.error('文件修改工具执行失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `操作失败: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * 基于行号的文件编辑
   */
  private async editByLines(filePath: string, params: any): Promise<string> {
    try {
      const { operation, start_line, end_line, line_number, content, create_backup = true } = params;
      
      if (!operation) {
        return JSON.stringify({ error: "缺少必需参数: operation" });
      }

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return JSON.stringify({ error: `文件不存在: ${filePath}` });
      }

      // 读取文件内容
      const originalContent = fs.readFileSync(filePath, 'utf8');
      const lines = originalContent.split('\n');
      const totalLines = lines.length;

      // 创建备份
      if (create_backup) {
        await this.createBackup(filePath, originalContent);
      }

      let modifiedLines = [...lines];
      let operationDetails: any = {};

      switch (operation) {
        case 'replace_lines':
          if (start_line === undefined || end_line === undefined) {
            return JSON.stringify({ error: "replace_lines操作需要start_line和end_line参数" });
          }
          if (content === undefined) {
            return JSON.stringify({ error: "replace_lines操作需要content参数" });
          }
          
          const result = this.replaceLines(modifiedLines, start_line, end_line, content);
          modifiedLines = result.lines;
          operationDetails = result.details;
          break;

        case 'insert_lines':
          if (line_number === undefined) {
            return JSON.stringify({ error: "insert_lines操作需要line_number参数" });
          }
          if (content === undefined) {
            return JSON.stringify({ error: "insert_lines操作需要content参数" });
          }
          
          const insertResult = this.insertLines(modifiedLines, line_number, content);
          modifiedLines = insertResult.lines;
          operationDetails = insertResult.details;
          break;

        case 'delete_lines':
          if (start_line === undefined || end_line === undefined) {
            return JSON.stringify({ error: "delete_lines操作需要start_line和end_line参数" });
          }
          
          const deleteResult = this.deleteLines(modifiedLines, start_line, end_line);
          modifiedLines = deleteResult.lines;
          operationDetails = deleteResult.details;
          break;

        case 'prepend_lines':
          if (line_number === undefined) {
            return JSON.stringify({ error: "prepend_lines操作需要line_number参数" });
          }
          if (content === undefined) {
            return JSON.stringify({ error: "prepend_lines操作需要content参数" });
          }
          
          const prependResult = this.prependLines(modifiedLines, line_number, content);
          modifiedLines = prependResult.lines;
          operationDetails = prependResult.details;
          break;

        default:
          return JSON.stringify({ error: `不支持的行操作: ${operation}` });
      }

      // 写入修改后的内容
      const newContent = modifiedLines.join('\n');
      fs.writeFileSync(filePath, newContent, 'utf8');

      const stats = fs.statSync(filePath);
      
      return JSON.stringify({
        success: true,
        operation: `edit_by_lines.${operation}`,
        file_path: filePath,
        original_lines: totalLines,
        new_lines: modifiedLines.length,
        lines_changed: operationDetails.linesChanged || 0,
        backup_created: create_backup,
        file_size: stats.size,
        operation_details: operationDetails,
        timestamp: new Date().toISOString()
      }, null, 2);

    } catch (error) {
      this.logger.error('基于行号的编辑失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `基于行号的编辑失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 基于文本匹配的文件编辑
   */
  private async editByText(filePath: string, params: any): Promise<string> {
    try {
      const { 
        operation, 
        old_text, 
        target_text, 
        new_text, 
        content, 
        replace_all = false, 
        case_sensitive = true,
        create_backup = true 
      } = params;
      
      if (!operation) {
        return JSON.stringify({ error: "缺少必需参数: operation" });
      }

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return JSON.stringify({ error: `文件不存在: ${filePath}` });
      }

      // 读取文件内容
      const originalContent = fs.readFileSync(filePath, 'utf8');

      // 创建备份
      if (create_backup) {
        await this.createBackup(filePath, originalContent);
      }

      let modifiedContent = originalContent;
      let operationDetails: any = {};

      switch (operation) {
        case 'replace_text':
          if (!old_text || new_text === undefined) {
            return JSON.stringify({ error: "replace_text操作需要old_text和new_text参数" });
          }
          
          const replaceResult = this.replaceText(modifiedContent, old_text, new_text, replace_all, case_sensitive);
          modifiedContent = replaceResult.content;
          operationDetails = replaceResult.details;
          break;

        case 'insert_after_text':
          if (!target_text || !content) {
            return JSON.stringify({ error: "insert_after_text操作需要target_text和content参数" });
          }
          
          const insertAfterResult = this.insertAfterText(modifiedContent, target_text, content, case_sensitive);
          modifiedContent = insertAfterResult.content;
          operationDetails = insertAfterResult.details;
          break;

        case 'insert_before_text':
          if (!target_text || !content) {
            return JSON.stringify({ error: "insert_before_text操作需要target_text和content参数" });
          }
          
          const insertBeforeResult = this.insertBeforeText(modifiedContent, target_text, content, case_sensitive);
          modifiedContent = insertBeforeResult.content;
          operationDetails = insertBeforeResult.details;
          break;

        case 'delete_text':
          if (!target_text) {
            return JSON.stringify({ error: "delete_text操作需要target_text参数" });
          }
          
          const deleteResult = this.deleteText(modifiedContent, target_text, replace_all, case_sensitive);
          modifiedContent = deleteResult.content;
          operationDetails = deleteResult.details;
          break;

        default:
          return JSON.stringify({ error: `不支持的文本操作: ${operation}` });
      }

      // 写入修改后的内容
      fs.writeFileSync(filePath, modifiedContent, 'utf8');

      const stats = fs.statSync(filePath);
      
      return JSON.stringify({
        success: true,
        operation: `edit_by_text.${operation}`,
        file_path: filePath,
        original_size: originalContent.length,
        new_size: modifiedContent.length,
        size_change: modifiedContent.length - originalContent.length,
        backup_created: create_backup,
        file_size: stats.size,
        operation_details: operationDetails,
        timestamp: new Date().toISOString()
      }, null, 2);

    } catch (error) {
      this.logger.error('基于文本的编辑失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `基于文本的编辑失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 基于正则表达式的文件编辑
   */
  private async editByRegex(filePath: string, params: any): Promise<string> {
    try {
      const { operation, pattern, replacement, flags = 'g', create_backup = true } = params;
      
      if (!operation) {
        return JSON.stringify({ error: "缺少必需参数: operation" });
      }
      if (!pattern) {
        return JSON.stringify({ error: "缺少必需参数: pattern" });
      }

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return JSON.stringify({ error: `文件不存在: ${filePath}` });
      }

      // 读取文件内容
      const originalContent = fs.readFileSync(filePath, 'utf8');

      // 创建备份
      if (create_backup) {
        await this.createBackup(filePath, originalContent);
      }

      let modifiedContent = originalContent;
      let operationDetails: any = {};

      try {
        const regex = new RegExp(pattern, flags);
        
        switch (operation) {
          case 'replace_regex':
            if (replacement === undefined) {
              return JSON.stringify({ error: "replace_regex操作需要replacement参数" });
            }
            
            const matches = Array.from(originalContent.matchAll(regex));
            modifiedContent = originalContent.replace(regex, replacement);
            
            operationDetails = {
              pattern,
              replacement,
              flags,
              matches_found: matches.length,
              matches: matches.slice(0, 5).map(match => ({
                match: match[0],
                index: match.index || 0,
                groups: match.slice(1)
              }))
            };
            break;

          case 'extract_and_replace':
            // 提取匹配的内容并进行复杂替换
            if (replacement === undefined) {
              return JSON.stringify({ error: "extract_and_replace操作需要replacement参数" });
            }
            
            const extractMatches = Array.from(originalContent.matchAll(regex));
            modifiedContent = originalContent.replace(regex, (match, ...groups) => {
              // 支持在replacement中使用 $1, $2 等引用捕获组
              let result = replacement;
              groups.forEach((group, index) => {
                if (group !== undefined) {
                  result = result.replace(new RegExp(`\\$${index + 1}`, 'g'), group);
                }
              });
              return result;
            });
            
            operationDetails = {
              pattern,
              replacement,
              flags,
              matches_found: extractMatches.length,
              extractions: extractMatches.slice(0, 5).map(match => ({
                full_match: match[0],
                groups: match.slice(1),
                index: match.index || 0
              }))
            };
            break;

          default:
            return JSON.stringify({ error: `不支持的正则操作: ${operation}` });
        }
      } catch (regexError) {
        return JSON.stringify({ 
          error: `正则表达式错误: ${regexError instanceof Error ? regexError.message : String(regexError)}`,
          pattern
        });
      }

      // 写入修改后的内容
      fs.writeFileSync(filePath, modifiedContent, 'utf8');

      const stats = fs.statSync(filePath);
      
      return JSON.stringify({
        success: true,
        operation: `edit_by_regex.${operation}`,
        file_path: filePath,
        original_size: originalContent.length,
        new_size: modifiedContent.length,
        size_change: modifiedContent.length - originalContent.length,
        backup_created: create_backup,
        file_size: stats.size,
        operation_details: operationDetails,
        timestamp: new Date().toISOString()
      }, null, 2);

    } catch (error) {
      this.logger.error('基于正则的编辑失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `基于正则的编辑失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 批量编辑操作
   */
  private async batchEdit(filePath: string, params: any): Promise<string> {
    const results: any[] = [];
    
    try {
      const { operations, create_backup = true } = params;
      
      if (!operations || !Array.isArray(operations)) {
        return JSON.stringify({ error: "批量编辑需要operations数组参数" });
      }

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return JSON.stringify({ error: `文件不存在: ${filePath}` });
      }

      // 读取文件内容
      const originalContent = fs.readFileSync(filePath, 'utf8');

      // 创建备份
      if (create_backup) {
        await this.createBackup(filePath, originalContent);
      }

      let currentContent = originalContent;

      // 按顺序执行每个操作
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        const tempFilePath = `${filePath}.temp_${i}`;
        
        try {
          // 写入当前内容到临时文件
          fs.writeFileSync(tempFilePath, currentContent, 'utf8');
          
          // 根据操作类型执行相应的编辑
          let result;
          switch (operation.type) {
            case 'edit_by_lines':
              result = await this.editByLines(tempFilePath, { ...operation, create_backup: false });
              break;
            case 'edit_by_text':
              result = await this.editByText(tempFilePath, { ...operation, create_backup: false });
              break;
            case 'edit_by_regex':
              result = await this.editByRegex(tempFilePath, { ...operation, create_backup: false });
              break;
            default:
              result = JSON.stringify({ error: `不支持的批量操作类型: ${operation.type}` });
          }

          const parsedResult = JSON.parse(result);
          results.push({
            step: i + 1,
            operation_type: operation.type,
            operation_name: operation.operation,
            success: parsedResult.success || false,
            error: parsedResult.error,
            details: parsedResult.operation_details
          });

          if (parsedResult.success) {
            // 读取修改后的内容作为下一步的输入
            currentContent = fs.readFileSync(tempFilePath, 'utf8');
          } else {
            // 如果操作失败，停止批量处理
            fs.unlinkSync(tempFilePath); // 清理临时文件
            throw new Error(`批量操作在步骤${i + 1}失败: ${parsedResult.error}`);
          }

          // 清理临时文件
          fs.unlinkSync(tempFilePath);
        } catch (stepError) {
          // 清理可能存在的临时文件
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          
          results.push({
            step: i + 1,
            operation_type: operation.type,
            operation_name: operation.operation,
            success: false,
            error: stepError instanceof Error ? stepError.message : String(stepError)
          });
          
          throw stepError;
        }
      }

      // 写入最终结果
      fs.writeFileSync(filePath, currentContent, 'utf8');

      const stats = fs.statSync(filePath);
      
      return JSON.stringify({
        success: true,
        operation: 'batch_edit',
        file_path: filePath,
        total_operations: operations.length,
        successful_operations: results.filter(r => r.success).length,
        original_size: originalContent.length,
        new_size: currentContent.length,
        size_change: currentContent.length - originalContent.length,
        backup_created: create_backup,
        file_size: stats.size,
        operation_results: results,
        timestamp: new Date().toISOString()
      }, null, 2);

    } catch (error) {
      this.logger.error('批量编辑失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `批量编辑失败: ${error instanceof Error ? error.message : String(error)}`,
        partial_results: results
      });
    }
  }

  /**
   * 预览编辑操作
   */
  private async previewEdit(filePath: string, params: any): Promise<string> {
    try {
      const { edit_config } = params;
      
      if (!edit_config) {
        return JSON.stringify({ error: "预览编辑需要edit_config参数" });
      }

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return JSON.stringify({ error: `文件不存在: ${filePath}` });
      }

      // 读取文件内容
      const originalContent = fs.readFileSync(filePath, 'utf8');
      const originalLines = originalContent.split('\n');

      // 创建临时文件进行预览
      const tempFilePath = `${filePath}.preview_temp`;
      fs.writeFileSync(tempFilePath, originalContent, 'utf8');

      try {
        // 根据配置执行相应的编辑预览
        let result;
        const configWithoutBackup = { ...edit_config, create_backup: false };
        
        switch (edit_config.type) {
          case 'edit_by_lines':
            result = await this.editByLines(tempFilePath, configWithoutBackup);
            break;
          case 'edit_by_text':
            result = await this.editByText(tempFilePath, configWithoutBackup);
            break;
          case 'edit_by_regex':
            result = await this.editByRegex(tempFilePath, configWithoutBackup);
            break;
          default:
            throw new Error(`不支持的预览操作类型: ${edit_config.type}`);
        }

        const parsedResult = JSON.parse(result);
        
        if (parsedResult.success) {
          // 读取预览结果
          const previewContent = fs.readFileSync(tempFilePath, 'utf8');
          const previewLines = previewContent.split('\n');

          // 生成差异对比
          const diff = this.generateDiff(originalLines, previewLines);

          return JSON.stringify({
            success: true,
            operation: 'preview_edit',
            file_path: filePath,
            edit_type: edit_config.type,
            edit_operation: edit_config.operation,
            original_size: originalContent.length,
            preview_size: previewContent.length,
            size_change: previewContent.length - originalContent.length,
            lines_changed: diff.changedLines,
            diff: diff,
            preview_details: parsedResult.operation_details,
            timestamp: new Date().toISOString()
          }, null, 2);
        } else {
          return JSON.stringify({
            success: false,
            error: `预览失败: ${parsedResult.error}`,
            file_path: filePath
          });
        }
      } finally {
        // 清理临时文件
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }

    } catch (error) {
      this.logger.error('预览编辑失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `预览编辑失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  // 辅助方法实现
  private replaceLines(lines: string[], startLine: number, endLine: number, content: string): { lines: string[], details: any } {
    const newLines = content.split('\n');
    const beforeLines = lines.slice(0, startLine - 1);
    const afterLines = lines.slice(endLine);
    
    return {
      lines: [...beforeLines, ...newLines, ...afterLines],
      details: {
        linesReplaced: endLine - startLine + 1,
        newLinesAdded: newLines.length,
        startLine,
        endLine
      }
    };
  }

  private insertLines(lines: string[], lineNumber: number, content: string): { lines: string[], details: any } {
    const newLines = content.split('\n');
    const beforeLines = lines.slice(0, lineNumber);
    const afterLines = lines.slice(lineNumber);
    
    return {
      lines: [...beforeLines, ...newLines, ...afterLines],
      details: {
        insertedAt: lineNumber,
        linesAdded: newLines.length
      }
    };
  }

  private deleteLines(lines: string[], startLine: number, endLine: number): { lines: string[], details: any } {
    const beforeLines = lines.slice(0, startLine - 1);
    const afterLines = lines.slice(endLine);
    
    return {
      lines: [...beforeLines, ...afterLines],
      details: {
        linesDeleted: endLine - startLine + 1,
        startLine,
        endLine
      }
    };
  }

  private prependLines(lines: string[], lineNumber: number, content: string): { lines: string[], details: any } {
    const newLines = content.split('\n');
    const beforeLines = lines.slice(0, lineNumber - 1);
    const afterLines = lines.slice(lineNumber - 1);
    
    return {
      lines: [...beforeLines, ...newLines, ...afterLines],
      details: {
        prependedAt: lineNumber,
        linesAdded: newLines.length
      }
    };
  }

  private replaceText(content: string, oldText: string, newText: string, replaceAll: boolean, caseSensitive: boolean): { content: string, details: any } {
    const flags = caseSensitive ? 'g' : 'gi';
    const searchRegex = new RegExp(this.escapeRegExp(oldText), replaceAll ? flags : (caseSensitive ? '' : 'i'));
    
    const matches = Array.from(content.matchAll(new RegExp(this.escapeRegExp(oldText), flags)));
    const newContent = content.replace(searchRegex, newText);
    
    return {
      content: newContent,
      details: {
        oldText,
        newText,
        replacements: replaceAll ? matches.length : Math.min(matches.length, 1),
        totalMatches: matches.length,
        caseSensitive,
        replaceAll
      }
    };
  }

  private insertAfterText(content: string, targetText: string, newContent: string, caseSensitive: boolean): { content: string, details: any } {
    const flags = caseSensitive ? 'g' : 'gi';
    const searchRegex = new RegExp(this.escapeRegExp(targetText), flags);
    
    const matches = Array.from(content.matchAll(searchRegex));
    if (matches.length === 0) {
      return {
        content,
        details: {
          targetText,
          newContent,
          insertions: 0,
          error: '未找到匹配的文本'
        }
      };
    }
    
    const modifiedContent = content.replace(searchRegex, `${targetText}${newContent}`);
    
    return {
      content: modifiedContent,
      details: {
        targetText,
        newContent,
        insertions: matches.length,
        caseSensitive
      }
    };
  }

  private insertBeforeText(content: string, targetText: string, newContent: string, caseSensitive: boolean): { content: string, details: any } {
    const flags = caseSensitive ? 'g' : 'gi';
    const searchRegex = new RegExp(this.escapeRegExp(targetText), flags);
    
    const matches = Array.from(content.matchAll(searchRegex));
    if (matches.length === 0) {
      return {
        content,
        details: {
          targetText,
          newContent,
          insertions: 0,
          error: '未找到匹配的文本'
        }
      };
    }
    
    const modifiedContent = content.replace(searchRegex, `${newContent}${targetText}`);
    
    return {
      content: modifiedContent,
      details: {
        targetText,
        newContent,
        insertions: matches.length,
        caseSensitive
      }
    };
  }

  private deleteText(content: string, targetText: string, deleteAll: boolean, caseSensitive: boolean): { content: string, details: any } {
    const flags = caseSensitive ? 'g' : 'gi';
    const searchRegex = new RegExp(this.escapeRegExp(targetText), deleteAll ? flags : (caseSensitive ? '' : 'i'));
    
    const matches = Array.from(content.matchAll(new RegExp(this.escapeRegExp(targetText), flags)));
    const newContent = content.replace(searchRegex, '');
    
    return {
      content: newContent,
      details: {
        targetText,
        deletions: deleteAll ? matches.length : Math.min(matches.length, 1),
        totalMatches: matches.length,
        caseSensitive,
        deleteAll
      }
    };
  }

  private generateDiff(originalLines: string[], newLines: string[]): any {
    const changes: any[] = [];
    let changedLines = 0;
    
    const maxLines = Math.max(originalLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i];
      const newLine = newLines[i];
      
      if (originalLine !== newLine) {
        changedLines++;
        changes.push({
          lineNumber: i + 1,
          type: originalLine === undefined ? 'added' : newLine === undefined ? 'deleted' : 'modified',
          original: originalLine,
          new: newLine
        });
      }
    }
    
    return {
      changedLines,
      totalChanges: changes.length,
      changes: changes.slice(0, 20) // 只显示前20个变化以避免输出过长
    };
  }

  private async createBackup(filePath: string, content: string): Promise<void> {
    const backupPath = `${filePath}.backup`;
    fs.writeFileSync(backupPath, content, 'utf8');
    this.logger.info('创建备份文件', { originalFile: filePath, backupFile: backupPath });
  }

  private sanitizePath(filePath: string): string | null {
    if (!filePath || typeof filePath !== 'string') {
      return null;
    }
    
    // 基本安全检查
    if (filePath.includes('..\\..') || filePath.includes('../..') || filePath.startsWith('/')) {
      return null;
    }
    
    return path.normalize(filePath);
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export function createFileEditTool(): FileEditTool {
  return new FileEditTool();
} 