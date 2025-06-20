import { FileManagerTool } from '../src/utils/tools/file-manager.js';
import fs from 'fs';
import path from 'path';

/**
 * 文件管理工具测试类
 */
class FileManagerTest {
  private fileManager: FileManagerTool;
  private testDir = 'test-files';
  private testFile = path.join(this.testDir, 'test.txt');
  private testContent = 'Hello, World!';

  constructor() {
    this.fileManager = new FileManagerTool();
  }

  private cleanup() {
    if (fs.existsSync(this.testDir)) {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    }
  }

  private setup() {
    this.cleanup();
  }

  private async callTool(input: object): Promise<any> {
    const result = await (this.fileManager as any)._call(JSON.stringify(input));
    return JSON.parse(result);
  }

  private assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`断言失败: ${message}`);
    }
    console.log(`✅ ${message}`);
  }

  /**
   * 测试目录创建
   */
  async testCreateDirectory() {
    console.log('🧪 测试目录创建...');
    this.setup();

    const result = await this.callTool({
      action: 'create_directory',
      path: this.testDir
    });

    this.assert(result.success === true, '目录创建成功');
    this.assert(fs.existsSync(this.testDir), '目录确实存在');
  }

  /**
   * 测试文件写入
   */
  async testWriteFile() {
    console.log('🧪 测试文件写入...');
    this.setup();

    const result = await this.callTool({
      action: 'write',
      path: this.testFile,
      content: this.testContent
    });

    this.assert(result.success === true, '文件写入成功');
    this.assert(fs.existsSync(this.testFile), '文件确实存在');
    this.assert(fs.readFileSync(this.testFile, 'utf8') === this.testContent, '文件内容正确');
  }

  /**
   * 测试文件读取
   */
  async testReadFile() {
    console.log('🧪 测试文件读取...');
    this.setup();

    // 先创建文件
    fs.mkdirSync(this.testDir, { recursive: true });
    fs.writeFileSync(this.testFile, this.testContent);

    const result = await this.callTool({
      action: 'read',
      path: this.testFile
    });

    this.assert(result.success === true, '文件读取成功');
    this.assert(result.content === this.testContent, '读取内容正确');
  }

  /**
   * 测试目录列表
   */
  async testListDirectory() {
    console.log('🧪 测试目录列表...');
    this.setup();

    // 创建测试文件
    fs.mkdirSync(this.testDir, { recursive: true });
    fs.writeFileSync(this.testFile, this.testContent);

    const result = await this.callTool({
      action: 'list',
      path: this.testDir
    });

    this.assert(result.success === true, '目录列表获取成功');
    this.assert(Array.isArray(result.contents), '返回的是数组');
    this.assert(result.contents.length === 1, '只有一个文件');
    this.assert(result.contents[0].name === 'test.txt', '文件名正确');
  }

  /**
   * 测试文件删除
   */
  async testDeleteFile() {
    console.log('🧪 测试文件删除...');
    this.setup();

    // 先创建文件
    fs.mkdirSync(this.testDir, { recursive: true });
    fs.writeFileSync(this.testFile, this.testContent);

    const result = await this.callTool({
      action: 'delete',
      path: this.testFile
    });

    this.assert(result.success === true, '文件删除成功');
    this.assert(!fs.existsSync(this.testFile), '文件确实被删除');
  }

  /**
   * 测试文件重命名
   */
  async testRenameFile() {
    console.log('🧪 测试文件重命名...');
    this.setup();

    // 先创建文件
    fs.mkdirSync(this.testDir, { recursive: true });
    fs.writeFileSync(this.testFile, this.testContent);

    const newPath = path.join(this.testDir, 'renamed.txt');
    const result = await this.callTool({
      action: 'rename',
      path: this.testFile,
      new_path: newPath
    });

    this.assert(result.success === true, '文件重命名成功');
    this.assert(!fs.existsSync(this.testFile), '原文件不存在');
    this.assert(fs.existsSync(newPath), '新文件存在');
    this.assert(fs.readFileSync(newPath, 'utf8') === this.testContent, '文件内容保持不变');
  }

  /**
   * 测试路径安全检查
   */
  async testPathSecurity() {
    console.log('🧪 测试路径安全检查...');

    // 测试路径遍历攻击
    const result1 = await this.callTool({
      action: 'read',
      path: '../../../etc/passwd'
    });

    this.assert(result1.error !== undefined, '拒绝路径遍历攻击');
    this.assert(result1.error.includes('无效的文件路径'), '错误信息正确');

    // 测试绝对路径
    const result2 = await this.callTool({
      action: 'read',
      path: '/etc/passwd'
    });

    this.assert(result2.error !== undefined, '拒绝绝对路径');
    this.assert(result2.error.includes('无效的文件路径'), '错误信息正确');
  }

  /**
   * 测试错误处理
   */
  async testErrorHandling() {
    console.log('🧪 测试错误处理...');

    // 测试读取不存在的文件
    const result1 = await this.callTool({
      action: 'read',
      path: 'non-existent.txt'
    });

    this.assert(result1.error !== undefined, '正确处理文件不存在错误');

    // 测试不支持的操作
    const result2 = await this.callTool({
      action: 'unsupported_action',
      path: 'test.txt'
    });

    this.assert(result2.error !== undefined, '正确处理不支持的操作');
    this.assert(result2.error.includes('不支持的操作'), '错误信息正确');

    // 测试重命名时缺少新路径
    this.setup();
    fs.mkdirSync(this.testDir, { recursive: true });
    fs.writeFileSync(this.testFile, this.testContent);

    const result3 = await this.callTool({
      action: 'rename',
      path: this.testFile
    });

    this.assert(result3.error !== undefined, '正确处理缺少新路径');
    this.assert(result3.error.includes('新路径不能为空'), '错误信息正确');
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🚀 开始运行文件管理工具测试...\n');

    try {
      await this.testCreateDirectory();
      await this.testWriteFile();
      await this.testReadFile();
      await this.testListDirectory();
      await this.testDeleteFile();
      await this.testRenameFile();
      await this.testPathSecurity();
      await this.testErrorHandling();

      console.log('\n🎉 所有测试通过！文件管理工具工作正常。');
    } catch (error) {
      console.error('\n❌ 测试失败:', error);
      throw error;
    } finally {
      this.cleanup();
    }
  }
}

/**
 * 主测试函数
 */
async function testFileManager() {
  const test = new FileManagerTest();
  await test.runAllTests();
}

// 直接执行测试
testFileManager().catch(console.error);

export { testFileManager, FileManagerTest }; 