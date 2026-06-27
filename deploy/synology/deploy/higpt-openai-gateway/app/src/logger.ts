/**
 * 结构化日志模块
 * 
 * 支持的日志级别：DEBUG < INFO < WARN < ERROR
 * 输出格式：JSON（便于日志收集系统解析）
 * 
 * 环境变量：
 * - LOG_LEVEL: 日志级别 (DEBUG|INFO|WARN|ERROR), 默认 INFO
 * - LOG_FORMAT: 输出格式 (json|pretty), 默认 json
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

interface LogData {
  timestamp: string;
  level: LogLevel;
  service: string;
  requestId?: string;
  event: string;
  message?: string;
  data?: Record<string, any>;
}

class Logger {
  private level: LogLevel;
  private format: 'json' | 'pretty';

  constructor() {
    const envLevel = (process.env.LOG_LEVEL || 'INFO').toUpperCase() as LogLevel;
    this.level = LOG_LEVELS[envLevel] ? envLevel : 'INFO';
    
    const envFormat = (process.env.LOG_FORMAT || 'json').toLowerCase();
    this.format = (envFormat === 'pretty' || envFormat === 'human') ? 'pretty' : 'json';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatOutput(log: LogData): string {
    if (this.format === 'pretty') {
      const parts = [
        log.timestamp,
        log.level,
        `[${log.service}]`,
        log.requestId ? `requestId=${log.requestId}` : '',
        log.event,
        log.message ? log.message : '',
        log.data ? Object.entries(log.data).map(([k, v]) => `${k}=${v}`).join(' ') : '',
      ].filter(Boolean);
      return parts.join(' ');
    }
    return JSON.stringify(log);
  }

  private log(level: LogLevel, event: string, data?: Record<string, any>, requestId?: string, message?: string): void {
    if (!this.shouldLog(level)) return;

    const log: LogData = {
      timestamp: new Date().toISOString(),
      level,
      service: 'higpt-gateway',
      requestId,
      event,
      message,
      data,
    };

    const output = this.formatOutput(log);
    
    if (level === 'ERROR' || level === 'WARN') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }

  debug(event: string, data?: Record<string, any>, requestId?: string): void {
    this.log('DEBUG', event, data, requestId);
  }

  info(event: string, data?: Record<string, any>, requestId?: string, message?: string): void {
    this.log('INFO', event, data, requestId, message);
  }

  warn(event: string, data?: Record<string, any>, requestId?: string, message?: string): void {
    this.log('WARN', event, data, requestId, message);
  }

  error(event: string, data?: Record<string, any>, requestId?: string, message?: string): void {
    this.log('ERROR', event, data, requestId, message);
  }
}

export const logger = new Logger();
