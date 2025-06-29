import { Tool } from '@langchain/core/tools';
import fs from 'fs';
import path from 'path';
import { LoggerManager } from '../logger/logger.js';

/**
 * 项目分析工具
 * 智能分析项目结构，选择性读取重要文件，生成项目总结
 */
export class ProjectAnalyzerTool extends Tool {
  name = 'project_analyzer';
  description = `
  项目智能分析工具 - 快速理解项目结构和核心内容

  这个工具可以智能分析项目，不会读取所有文件，而是：
  1. 📊 扫描项目整体结构和文件分布
  2. 📋 读取关键配置文件（package.json、tsconfig.json、README等）
  3. 🔍 识别并读取重要的入口文件和核心模块
  4. 🧠 根据文件重要性和类型选择性读取代码
  5. 📝 生成详细的项目分析报告

  ## 主要功能

  ### 1. 项目结构分析
  操作：analyze_structure
  参数：path (可选，默认为当前目录), max_depth (可选，默认为3)
  
  示例：
  {"action": "analyze_structure", "path": ".", "max_depth": 3}
  
  返回：项目的目录结构、文件类型分布、技术栈识别

  ### 2. 项目完整分析
  操作：full_analysis
  参数：path (可选，默认为当前目录), focus_areas (可选，关注的技术领域)
  
  示例：
  {"action": "full_analysis", "path": ".", "focus_areas": ["frontend", "backend", "ai"]}
  
  返回：完整的项目分析报告，包括：
  - 项目概览和技术栈
  - 关键文件内容摘要
  - 代码架构分析
  - 项目特点和建议

  ### 3. 关键文件分析
  操作：analyze_key_files
  参数：path (可选，默认为当前目录)
  
  示例：
  {"action": "analyze_key_files", "path": "."}
  
  返回：项目中关键文件的内容和分析

  ## 输入格式
  所有输入都是JSON字符串格式。
  `;

  private logger: any;

  // 关键文件模式
  private readonly KEY_FILES = [
    'package.json',
    'tsconfig.json',
    'vite.config.js',
    'vite.config.ts',
    'webpack.config.js',
    'next.config.js',
    'nuxt.config.js',
    'vue.config.js',
    'angular.json',
    'svelte.config.js',
    'rollup.config.js',
    'babel.config.js',
    '.eslintrc.js',
    '.eslintrc.json',
    'tailwind.config.js',
    'docker-compose.yml',
    'Dockerfile',
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
    '.gitignore',
    'yarn.lock',
    'pnpm-lock.yaml',
    'requirements.txt',
    'Pipfile',
    'Cargo.toml',
    'go.mod',
    'pom.xml',
    'build.gradle'
  ];

  // 入口文件模式
  private readonly ENTRY_FILES = [
    'index.js',
    'index.ts',
    'main.js',
    'main.ts',
    'app.js',
    'app.ts',
    'server.js',
    'server.ts',
    'src/index.js',
    'src/index.ts',
    'src/main.js',
    'src/main.ts',
    'src/app.js',
    'src/app.ts',
    'src/App.vue',
    'src/App.tsx',
    'src/App.jsx'
  ];

  // 重要目录
  private readonly IMPORTANT_DIRS = [
    'src',
    'lib',
    'components',
    'utils',
    'config',
    'api',
    'routes',
    'controllers',
    'models',
    'services',
    'middleware',
    'types',
    'interfaces',
    'hooks',
    'store',
    'styles',
    'assets'
  ];

  constructor() {
    super();
    this.logger = LoggerManager.getInstance().getLogger('project-analyzer');
  }

  protected async _call(input: string): Promise<string> {
    try {
      this.logger.info('项目分析工具被调用', { input });
      
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
        case 'analyze_structure':
          result = await this.analyzeStructure(parsed.path || '.', parsed.max_depth || 3);
          break;
        
        case 'full_analysis':
          result = await this.fullAnalysis(parsed.path || '.', parsed.focus_areas);
          break;
        
        case 'analyze_key_files':
          result = await this.analyzeKeyFiles(parsed.path || '.');
          break;
        
        default:
          result = JSON.stringify({ error: `不支持的操作: ${action}` });
      }

      this.logger.info('分析完成', { action, success: result.includes('"success":true') });
      return result;
    } catch (error) {
      this.logger.error('项目分析失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `分析失败: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * 分析项目结构
   */
  private async analyzeStructure(projectPath: string, maxDepth: number): Promise<string> {
    try {
      this.logger.info('开始分析项目结构', { projectPath, maxDepth });
      
      const safePath = this.sanitizePath(projectPath);
      if (!safePath || !fs.existsSync(safePath)) {
        return JSON.stringify({ error: `项目路径不存在: ${projectPath}` });
      }

      // 扫描目录结构
      const structure = await this.scanDirectoryStructure(safePath, maxDepth);
      
      // 分析文件类型分布
      const fileTypes = this.analyzeFileTypes(structure);
      
      // 识别技术栈
      const techStack = this.identifyTechStack(structure);
      
      // 计算项目统计
      const statistics = this.calculateProjectStats(structure);

      return JSON.stringify({
        success: true,
        project_path: projectPath,
        analysis_type: 'structure',
        directory_structure: structure,
        file_types: fileTypes,
        tech_stack: techStack,
        statistics: statistics,
        analysis_timestamp: new Date().toISOString()
      }, null, 2);
    } catch (error) {
      this.logger.error('结构分析失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `结构分析失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 完整项目分析
   */
  private async fullAnalysis(projectPath: string, focusAreas?: string[]): Promise<string> {
    try {
      this.logger.info('开始完整项目分析', { projectPath, focusAreas });
      
      const safePath = this.sanitizePath(projectPath);
      if (!safePath || !fs.existsSync(safePath)) {
        return JSON.stringify({ error: `项目路径不存在: ${projectPath}` });
      }

      // 1. 项目结构分析
      const structure = await this.scanDirectoryStructure(safePath, 4);
      const fileTypes = this.analyzeFileTypes(structure);
      const techStack = this.identifyTechStack(structure);
      const statistics = this.calculateProjectStats(structure);

      // 2. 关键文件分析
      const keyFiles = await this.findAndAnalyzeKeyFiles(safePath);
      
      // 3. 入口文件分析
      const entryFiles = await this.findAndAnalyzeEntryFiles(safePath);
      
      // 4. 重要代码文件分析
      const importantCode = await this.analyzeImportantCodeFiles(safePath, focusAreas);
      
      // 5. 生成项目总结
      const summary = this.generateProjectSummary({
        structure,
        fileTypes,
        techStack,
        statistics,
        keyFiles,
        entryFiles,
        importantCode,
        focusAreas
      });

      return JSON.stringify({
        success: true,
        project_path: projectPath,
        analysis_type: 'full',
        project_overview: {
          name: this.extractProjectName(keyFiles),
          tech_stack: techStack,
          statistics: statistics
        },
        key_files: keyFiles,
        entry_files: entryFiles,
        important_code: importantCode,
        directory_structure: structure,
        file_types: fileTypes,
        project_summary: summary,
        analysis_timestamp: new Date().toISOString()
      }, null, 2);
    } catch (error) {
      this.logger.error('完整分析失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `完整分析失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 分析关键文件
   */
  private async analyzeKeyFiles(projectPath: string): Promise<string> {
    try {
      this.logger.info('开始分析关键文件', { projectPath });
      
      const safePath = this.sanitizePath(projectPath);
      if (!safePath || !fs.existsSync(safePath)) {
        return JSON.stringify({ error: `项目路径不存在: ${projectPath}` });
      }

      const keyFiles = await this.findAndAnalyzeKeyFiles(safePath);

      return JSON.stringify({
        success: true,
        project_path: projectPath,
        analysis_type: 'key_files',
        key_files: keyFiles,
        analysis_timestamp: new Date().toISOString()
      }, null, 2);
    } catch (error) {
      this.logger.error('关键文件分析失败', { error: error instanceof Error ? error.message : String(error) });
      return JSON.stringify({ 
        error: `关键文件分析失败: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * 扫描目录结构
   */
  private async scanDirectoryStructure(dirPath: string, maxDepth: number, currentDepth: number = 0): Promise<any> {
    if (currentDepth >= maxDepth) {
      return { name: path.basename(dirPath), type: 'folder', depth_limited: true };
    }

    const items: any[] = [];
    
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // 跳过隐藏文件和常见的无关目录
        if (this.shouldSkipItem(entry.name)) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subStructure = await this.scanDirectoryStructure(fullPath, maxDepth, currentDepth + 1);
          items.push({
            name: entry.name,
            type: 'folder',
            path: fullPath,
            children: subStructure.children || [],
            ...subStructure
          });
        } else {
          const stats = fs.statSync(fullPath);
          items.push({
            name: entry.name,
            type: 'file',
            path: fullPath,
            size: stats.size,
            extension: path.extname(entry.name),
            modified: stats.mtime
          });
        }
      }
    } catch (error) {
      // 访问权限错误等情况
    }

    return {
      name: path.basename(dirPath),
      type: 'folder',
      path: dirPath,
      children: items
    };
  }

  /**
   * 分析文件类型分布
   */
  private analyzeFileTypes(structure: any): any {
    const typeCount: { [key: string]: number } = {};
    const typeSize: { [key: string]: number } = {};

    const analyzeNode = (node: any) => {
      if (node.type === 'file') {
        const ext = node.extension || 'no-extension';
        typeCount[ext] = (typeCount[ext] || 0) + 1;
        typeSize[ext] = (typeSize[ext] || 0) + node.size;
      } else if (node.children) {
        node.children.forEach(analyzeNode);
      }
    };

    if (structure.children) {
      structure.children.forEach(analyzeNode);
    }

    // 按文件数量排序
    const sortedTypes = Object.entries(typeCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10); // 只显示前10种类型

    return {
      by_count: sortedTypes.map(([ext, count]) => ({
        extension: ext,
        count,
        total_size: typeSize[ext],
        average_size: Math.round(typeSize[ext] / count)
      })),
      total_types: Object.keys(typeCount).length
    };
  }

  /**
   * 识别技术栈
   */
  private identifyTechStack(structure: any): any {
    const indicators: { [key: string]: string[] } = {};
    const technologies = new Set<string>();

    const checkNode = (node: any) => {
      if (node.type === 'file') {
        const name = node.name.toLowerCase();
        const ext = node.extension;

        // 根据文件名和扩展名判断技术栈
        if (name === 'package.json') technologies.add('Node.js');
        if (name === 'tsconfig.json') technologies.add('TypeScript');
        if (name === 'cargo.toml') technologies.add('Rust');
        if (name === 'go.mod') technologies.add('Go');
        if (name === 'requirements.txt' || name === 'pipfile') technologies.add('Python');
        if (name === 'pom.xml' || name === 'build.gradle') technologies.add('Java');
        if (name === 'dockerfile') technologies.add('Docker');
        if (name === 'docker-compose.yml') technologies.add('Docker Compose');
        
        // 根据扩展名判断
        switch (ext) {
          case '.vue': technologies.add('Vue.js'); break;
          case '.jsx':
          case '.tsx': technologies.add('React'); break;
          case '.svelte': technologies.add('Svelte'); break;
          case '.py': technologies.add('Python'); break;
          case '.rs': technologies.add('Rust'); break;
          case '.go': technologies.add('Go'); break;
          case '.java': technologies.add('Java'); break;
          case '.php': technologies.add('PHP'); break;
          case '.rb': technologies.add('Ruby'); break;
          case '.swift': technologies.add('Swift'); break;
          case '.kt': technologies.add('Kotlin'); break;
        }

        // 特定文件名模式
        if (name.includes('vite.config')) technologies.add('Vite');
        if (name.includes('webpack.config')) technologies.add('Webpack');
        if (name.includes('next.config')) technologies.add('Next.js');
        if (name.includes('nuxt.config')) technologies.add('Nuxt.js');
        if (name.includes('tailwind.config')) technologies.add('Tailwind CSS');
      } else if (node.children) {
        node.children.forEach(checkNode);
      }
    };

    if (structure.children) {
      structure.children.forEach(checkNode);
    }

    return {
      detected: Array.from(technologies),
      confidence: technologies.size > 0 ? 'high' : 'low'
    };
  }

  /**
   * 计算项目统计
   */
  private calculateProjectStats(structure: any): any {
    let totalFiles = 0;
    let totalFolders = 0;
    let totalSize = 0;
    let codeFiles = 0;
    let configFiles = 0;

    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.java', '.go', '.rs', '.rb', '.php', '.swift', '.kt'];
    const configExtensions = ['.json', '.yml', '.yaml', '.toml', '.ini', '.conf'];

    const analyzeNode = (node: any) => {
      if (node.type === 'file') {
        totalFiles++;
        totalSize += node.size || 0;
        
        if (codeExtensions.includes(node.extension)) {
          codeFiles++;
        } else if (configExtensions.includes(node.extension) || this.KEY_FILES.includes(node.name)) {
          configFiles++;
        }
      } else if (node.type === 'folder') {
        totalFolders++;
        if (node.children) {
          node.children.forEach(analyzeNode);
        }
      }
    };

    if (structure.children) {
      structure.children.forEach(analyzeNode);
    }

    return {
      total_files: totalFiles,
      total_folders: totalFolders,
      total_size: totalSize,
      total_size_human: this.formatFileSize(totalSize),
      code_files: codeFiles,
      config_files: configFiles,
      other_files: totalFiles - codeFiles - configFiles,
      code_ratio: totalFiles > 0 ? Math.round((codeFiles / totalFiles) * 100) : 0
    };
  }

  /**
   * 查找并分析关键文件
   */
  private async findAndAnalyzeKeyFiles(projectPath: string): Promise<any[]> {
    const keyFiles: any[] = [];

    for (const fileName of this.KEY_FILES) {
      const filePath = path.join(projectPath, fileName);
      if (fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            const content = fs.readFileSync(filePath, 'utf8');
            keyFiles.push({
              name: fileName,
              path: filePath,
              size: stats.size,
              size_human: this.formatFileSize(stats.size),
              modified: stats.mtime,
              content: content.length > 2000 ? content.substring(0, 2000) + '...' : content,
              is_truncated: content.length > 2000,
              full_length: content.length,
              type: this.getFileType(fileName),
              analysis: this.analyzeKeyFileContent(fileName, content)
            });
          }
        } catch (error) {
          keyFiles.push({
            name: fileName,
            path: filePath,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    return keyFiles;
  }

  /**
   * 查找并分析入口文件
   */
  private async findAndAnalyzeEntryFiles(projectPath: string): Promise<any[]> {
    const entryFiles: any[] = [];

    for (const fileName of this.ENTRY_FILES) {
      const filePath = path.join(projectPath, fileName);
      if (fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            const content = fs.readFileSync(filePath, 'utf8');
            entryFiles.push({
              name: fileName,
              path: filePath,
              size: stats.size,
              modified: stats.mtime,
              content: content.length > 1000 ? content.substring(0, 1000) + '...' : content,
              is_truncated: content.length > 1000,
              full_length: content.length,
              imports: this.extractImports(content),
              functions: this.extractFunctions(content)
            });
          }
        } catch (error) {
          // 忽略读取错误
        }
      }
    }

    return entryFiles;
  }

  /**
   * 分析重要代码文件
   */
  private async analyzeImportantCodeFiles(projectPath: string, focusAreas?: string[]): Promise<any[]> {
    const importantFiles: any[] = [];
    const maxFiles = 10; // 限制分析的文件数量

    // 查找重要目录中的代码文件
    for (const dirName of this.IMPORTANT_DIRS) {
      const dirPath = path.join(projectPath, dirName);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        const files = await this.findCodeFilesInDirectory(dirPath, 2); // 最多2层深度
        importantFiles.push(...files.slice(0, 3)); // 每个重要目录最多3个文件
      }
      
      if (importantFiles.length >= maxFiles) break;
    }

    return importantFiles.slice(0, maxFiles);
  }

  /**
   * 在目录中查找代码文件
   */
  private async findCodeFilesInDirectory(dirPath: string, maxDepth: number, currentDepth: number = 0): Promise<any[]> {
    const codeFiles: any[] = [];
    
    if (currentDepth >= maxDepth) return codeFiles;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (this.shouldSkipItem(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.findCodeFilesInDirectory(fullPath, maxDepth, currentDepth + 1);
          codeFiles.push(...subFiles);
        } else if (this.isCodeFile(entry.name)) {
          try {
            const stats = fs.statSync(fullPath);
            const content = fs.readFileSync(fullPath, 'utf8');
            
            codeFiles.push({
              name: entry.name,
              path: fullPath,
              relative_path: path.relative(process.cwd(), fullPath),
              size: stats.size,
              modified: stats.mtime,
              content: content.length > 800 ? content.substring(0, 800) + '...' : content,
              is_truncated: content.length > 800,
              full_length: content.length,
              line_count: content.split('\n').length,
              language: this.detectLanguage(entry.name),
              complexity_score: this.calculateComplexityScore(content)
            });
          } catch (error) {
            // 忽略读取错误
          }
        }
      }
    } catch (error) {
      // 目录访问错误
    }

    // 按复杂度和大小排序，优先选择重要文件
    return codeFiles.sort((a, b) => (b.complexity_score || 0) - (a.complexity_score || 0));
  }

  /**
   * 生成项目总结
   */
  private generateProjectSummary(analysisData: any): any {
    const { structure, fileTypes, techStack, statistics, keyFiles, entryFiles, importantCode } = analysisData;

    // 提取项目名称
    const projectName = this.extractProjectName(keyFiles);
    
    // 分析项目类型
    const projectType = this.determineProjectType(techStack, keyFiles, structure);
    
    // 生成关键特性描述
    const keyFeatures = this.identifyKeyFeatures(keyFiles, techStack, structure);
    
    // 生成架构描述
    const architecture = this.analyzeArchitecture(structure, entryFiles, importantCode);

    return {
      project_name: projectName,
      project_type: projectType,
      main_technologies: techStack.detected.slice(0, 5),
      key_features: keyFeatures,
      architecture: architecture,
      project_scale: this.determineProjectScale(statistics),
      development_stage: this.determineDevelopmentStage(keyFiles, statistics),
      recommendations: this.generateRecommendations(techStack, statistics, keyFiles)
    };
  }

  /**
   * 工具函数们
   */
  private sanitizePath(inputPath: string): string | null {
    if (!inputPath || typeof inputPath !== 'string') return null;
    return path.normalize(inputPath);
  }

  private shouldSkipItem(name: string): boolean {
    const skipPatterns = [
      'node_modules', '.git', '.next', '.nuxt', 'dist', 'build', 'coverage',
      '.nyc_output', '.cache', 'tmp', 'temp', '.DS_Store', 'Thumbs.db'
    ];
    return name.startsWith('.') && name.length > 1 || skipPatterns.includes(name);
  }

  private isCodeFile(fileName: string): boolean {
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.java', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.c', '.cpp', '.h', '.cs'];
    return codeExtensions.includes(path.extname(fileName));
  }

  private getFileType(fileName: string): string {
    if (fileName === 'package.json') return 'npm_config';
    if (fileName === 'tsconfig.json') return 'typescript_config';
    if (fileName === 'README.md') return 'documentation';
    if (fileName.includes('config')) return 'configuration';
    if (fileName.includes('lock')) return 'lock_file';
    return 'other';
  }

  private analyzeKeyFileContent(fileName: string, content: string): any {
    if (fileName === 'package.json') {
      try {
        const pkg = JSON.parse(content);
        return {
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
          scripts: Object.keys(pkg.scripts || {}),
          dependencies_count: Object.keys(pkg.dependencies || {}).length,
          dev_dependencies_count: Object.keys(pkg.devDependencies || {}).length,
          main_dependencies: Object.keys(pkg.dependencies || {}).slice(0, 5)
        };
      } catch (e) {
        return { error: 'Invalid JSON' };
      }
    }
    return {};
  }

  private extractImports(content: string): string[] {
    const importRegex = /(?:import|require)\s*\(?['"`]([^'"`]+)['"`]\)?/g;
    const imports: string[] = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports.slice(0, 10); // 限制数量
  }

  private extractFunctions(content: string): string[] {
    const functionRegex = /(?:function\s+(\w+)|(\w+)\s*[=:]\s*(?:function|\([^)]*\)\s*=>))/g;
    const functions: string[] = [];
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      functions.push(match[1] || match[2]);
    }
    return functions.slice(0, 5); // 限制数量
  }

  private detectLanguage(fileName: string): string {
    const ext = path.extname(fileName);
    const langMap: { [key: string]: string } = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.jsx': 'React JSX',
      '.tsx': 'React TSX',
      '.vue': 'Vue',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
      '.rb': 'Ruby',
      '.php': 'PHP'
    };
    return langMap[ext] || 'Unknown';
  }

  private calculateComplexityScore(content: string): number {
    let score = 0;
    
    // 基于内容长度
    score += Math.min(content.length / 1000, 10);
    
    // 基于函数数量
    const functionCount = (content.match(/function|=>/g) || []).length;
    score += functionCount * 2;
    
    // 基于导入数量
    const importCount = (content.match(/import|require/g) || []).length;
    score += importCount;
    
    // 基于类定义
    const classCount = (content.match(/class\s+\w+/g) || []).length;
    score += classCount * 3;
    
    return Math.round(score);
  }

  private extractProjectName(keyFiles: any[]): string {
    const packageJson = keyFiles.find(f => f.name === 'package.json');
    if (packageJson && packageJson.analysis && packageJson.analysis.name) {
      return packageJson.analysis.name;
    }
    return path.basename(process.cwd());
  }

  private determineProjectType(techStack: any, keyFiles: any[], structure: any): string {
    const technologies = techStack.detected;
    
    if (technologies.includes('React') || technologies.includes('Vue.js') || technologies.includes('Svelte')) {
      return 'Frontend Web Application';
    }
    if (technologies.includes('Next.js') || technologies.includes('Nuxt.js')) {
      return 'Full-stack Web Application';
    }
    if (technologies.includes('Node.js') && !technologies.includes('React') && !technologies.includes('Vue.js')) {
      return 'Backend API/Service';
    }
    if (technologies.includes('Python')) {
      return 'Python Application';
    }
    if (technologies.includes('TypeScript') && !technologies.includes('React') && !technologies.includes('Vue.js')) {
      return 'TypeScript Library/Tool';
    }
    
    return 'General Software Project';
  }

  private identifyKeyFeatures(keyFiles: any[], techStack: any, structure: any): string[] {
    const features: string[] = [];
    
    const packageJson = keyFiles.find(f => f.name === 'package.json');
    if (packageJson && packageJson.analysis) {
      if (packageJson.analysis.scripts.includes('test')) features.push('Testing Framework');
      if (packageJson.analysis.scripts.includes('build')) features.push('Build System');
      if (packageJson.analysis.scripts.includes('dev')) features.push('Development Server');
    }
    
    if (techStack.detected.includes('TypeScript')) features.push('Type Safety');
    if (techStack.detected.includes('Docker')) features.push('Containerization');
    if (keyFiles.some(f => f.name.includes('eslint'))) features.push('Code Linting');
    if (keyFiles.some(f => f.name.includes('tailwind'))) features.push('Utility-first CSS');
    
    return features;
  }

  private analyzeArchitecture(structure: any, entryFiles: any[], importantCode: any[]): any {
    // 简单的架构分析
    const dirs = this.findDirectories(structure);
    const hasComponents = dirs.includes('components');
    const hasUtils = dirs.includes('utils');
    const hasServices = dirs.includes('services');
    const hasApi = dirs.includes('api');
    
    let pattern = 'Unknown';
    if (hasComponents && hasUtils) pattern = 'Component-based';
    if (hasServices && hasApi) pattern = 'Service-oriented';
    if (dirs.includes('src')) pattern = 'Source-organized';
    
    return {
      pattern: pattern,
      main_directories: dirs.slice(0, 8),
      entry_points: entryFiles.map(f => f.name),
      code_organization: hasComponents ? 'Component-based' : 'File-based'
    };
  }

  private findDirectories(structure: any): string[] {
    const dirs: string[] = [];
    
    const traverse = (node: any) => {
      if (node.type === 'folder') {
        dirs.push(node.name);
        if (node.children) {
          node.children.forEach(traverse);
        }
      }
    };
    
    if (structure.children) {
      structure.children.forEach(traverse);
    }
    
    return dirs;
  }

  private determineProjectScale(statistics: any): string {
    if (statistics.code_files < 10) return 'Small';
    if (statistics.code_files < 50) return 'Medium';
    if (statistics.code_files < 200) return 'Large';
    return 'Very Large';
  }

  private determineDevelopmentStage(keyFiles: any[], statistics: any): string {
    const hasReadme = keyFiles.some(f => f.name === 'README.md');
    const hasTests = keyFiles.some(f => f.name.includes('test'));
    const hasLockFile = keyFiles.some(f => f.name.includes('lock'));
    
    if (!hasReadme && statistics.code_files < 5) return 'Early Development';
    if (hasReadme && hasLockFile && !hasTests) return 'Active Development';
    if (hasReadme && hasLockFile && hasTests) return 'Mature Development';
    return 'Unknown';
  }

  private generateRecommendations(techStack: any, statistics: any, keyFiles: any[]): string[] {
    const recommendations: string[] = [];
    
    if (!keyFiles.some(f => f.name === 'README.md')) {
      recommendations.push('Add a README.md file to document the project');
    }
    
    if (techStack.detected.includes('Node.js') && statistics.code_files > 20) {
      if (!keyFiles.some(f => f.name.includes('eslint'))) {
        recommendations.push('Consider adding ESLint for code quality');
      }
    }
    
    if (statistics.code_files > 50 && !keyFiles.some(f => f.name.includes('test'))) {
      recommendations.push('Add testing framework for better code reliability');
    }
    
    if (techStack.detected.includes('JavaScript') && !techStack.detected.includes('TypeScript') && statistics.code_files > 30) {
      recommendations.push('Consider migrating to TypeScript for better type safety');
    }
    
    return recommendations;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * 创建项目分析工具实例
 */
export function createProjectAnalyzerTool(): ProjectAnalyzerTool {
  return new ProjectAnalyzerTool();
} 