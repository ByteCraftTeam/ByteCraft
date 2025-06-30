import * as fs from 'fs';
import * as path from 'path';
//import fs from 'fs';
//import path from 'path';

/**
 * 日志级别枚举
 */
export enum LogLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  sessionId: string;
  message: string;
  details?: any;
}

/**
 * Logger收集器
 * 支持将不同级别的日志写入到指定文件中
 */
export class Logger {
  private logDir: string;
  private sessionId: string;
  private logFilePath: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.logDir = path.join(process.cwd(), '.bytecraft', 'logs');
    this.logFilePath = path.join(this.logDir, `session_${sessionId}.log`);
    
    // 确保日志目录存在
    this.ensureLogDir();
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDir(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      // 静默处理，不打印到终端
    }
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(level: LogLevel, message: string, details?: any): string {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level,
      sessionId: this.sessionId,
      message,
      details
    };

    // 基础日志格式
    let logLine = `[${timestamp}] [${level}] [${this.sessionId}] ${message}`;
    
    // 如果有详细信息，添加到日志中
    if (details) {
      if (typeof details === 'object') {
        try {
          logLine += ` | Details: ${JSON.stringify(details, null, 2)}`;
        } catch (error) {
          logLine += ` | Details: [无法序列化的对象]`;
        }
      } else {
        logLine += ` | Details: ${details}`;
      }
    }

    return logLine;
  }

  /**
   * 写入日志到文件
   */
  private writeToFile(logLine: string): void {
    try {
      fs.appendFileSync(this.logFilePath, logLine + '\n', 'utf8');
    } catch (error) {
      // 静默处理，不打印到终端
    }
  }

  /**
   * 记录INFO级别日志
   */
  info(message: string, details?: any): void {
    const logLine = this.formatLogEntry(LogLevel.INFO, message, details);
    this.writeToFile(logLine);
  }

  /**
   * 记录WARNING级别日志
   */
  warning(message: string, details?: any): void {
    const logLine = this.formatLogEntry(LogLevel.WARNING, message, details);
    this.writeToFile(logLine);
  }

  /**
   * 记录ERROR级别日志
   */
  error(message: string, details?: any): void {
    const logLine = this.formatLogEntry(LogLevel.ERROR, message, details);
    this.writeToFile(logLine);
  }

  /**
   * 获取日志文件路径
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * 获取日志目录路径
   */
  getLogDir(): string {
    return this.logDir;
  }

  /**
   * 读取当前会话的日志内容
   */
  readLogs(): string[] {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const content = fs.readFileSync(this.logFilePath, 'utf8');
        return content.split('\n').filter(line => line.trim() !== '');
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * 清空当前会话的日志
   */
  clearLogs(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        fs.writeFileSync(this.logFilePath, '', 'utf8');
        this.info('日志已清空');
      }
    } catch (error) {
      // 静默处理，不打印到终端
    }
  }

  /**
   * 获取日志文件大小（字节）
   */
  getLogFileSize(): number {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);
        return stats.size;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 检查日志文件是否存在
   */
  logFileExists(): boolean {
    return fs.existsSync(this.logFilePath);
  }
}

/**
 * Logger管理器
 * 用于管理多个会话的logger实例
 */
export class LoggerManager {
  private static instance: LoggerManager;
  private loggers: Map<string, Logger> = new Map();

  private constructor() {}

  /**
   * 获取LoggerManager单例
   */
  static getInstance(): LoggerManager {
    if (!LoggerManager.instance) {
      LoggerManager.instance = new LoggerManager();
    }
    return LoggerManager.instance;
  }

  /**
   * 获取或创建指定会话的Logger
   */
  getLogger(sessionId: string): Logger {
    if (!this.loggers.has(sessionId)) {
      this.loggers.set(sessionId, new Logger(sessionId));
    }
    return this.loggers.get(sessionId)!;
  }

  /**
   * 移除指定会话的Logger
   */
  removeLogger(sessionId: string): void {
    this.loggers.delete(sessionId);
  }

  /**
   * 获取所有活跃的Logger
   */
  getAllLoggers(): Map<string, Logger> {
    return new Map(this.loggers);
  }

  /**
   * 清空所有Logger
   */
  clearAllLoggers(): void {
    this.loggers.clear();
  }
} 