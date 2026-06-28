/**
 * 发帖日志工具函数
 * 包含敏感信息脱敏、错误追踪等辅助功能
 */

import { ContextSnapshot, RetryRecord, PipelineTimings, ErrorType, ErrorSeverity } from '../types/post-logging';

/**
 * 敏感信息脱敏工具
 */
export class SensitiveDataSanitizer {
  /**
   * 脱敏 API Token
   */
  static sanitizeApiToken(token: string): string {
    if (!token) return '';
    if (token.length <= 8) return '***';
    return token.substring(0, 4) + '***' + token.substring(token.length - 4);
  }

  /**
   * 脱敏手机号
   */
  static sanitizePhone(phone: string): string {
    if (!phone) return '';
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  /**
   * 脱敏邮箱
   */
  static sanitizeEmail(email: string): string {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length !== 2) return '***';
    const username = parts[0];
    const domain = parts[1];
    
    if (username.length <= 2) {
      return '***@' + domain;
    }
    
    return username.substring(0, 2) + '***@' + domain;
  }

  /**
   * 脱敏数据库连接字符串
   */
  static sanitizeConnectionString(connectionString: string): string {
    if (!connectionString) return '';
    // 替换密码部分
    return connectionString.replace(/:([^:@]+)@/g, ':***@');
  }

  /**
   * 脱敏错误堆栈
   */
  static sanitizeErrorStack(stack: string): string {
    if (!stack) return '';
    
    let sanitized = stack;
    
    // 脱敏 API Token
    sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-_\.]+/g, 'Bearer ***');
    
    // 脱敏手机号
    sanitized = sanitized.replace(/1[3-9]\d{9}/g, (match) => this.sanitizePhone(match));
    
    // 脱敏邮箱
    sanitized = sanitized.replace(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => this.sanitizeEmail(match));
    
    // 脱敏数据库连接字符串
    sanitized = sanitized.replace(/mysql:\/\/[^:]+:[^@]+@/g, 'mysql://***:***@');
    
    return sanitized;
  }

  /**
   * 脱敏上下文快照
   */
  static sanitizeContextSnapshot(snapshot: any): any {
    if (!snapshot) return snapshot;
    
    const sanitized = { ...snapshot };
    
    // 脱敏可能的敏感字段
    if (sanitized.apiToken) sanitized.apiToken = this.sanitizeApiToken(sanitized.apiToken);
    if (sanitized.phone) sanitized.phone = this.sanitizePhone(sanitized.phone);
    if (sanitized.email) sanitized.email = this.sanitizeEmail(sanitized.email);
    if (sanitized.connectionString) sanitized.connectionString = this.sanitizeConnectionString(sanitized.connectionString);
    
    return sanitized;
  }
}

/**
 * 错误追踪工具
 */
export class ErrorTracker {
  /**
   * 识别错误类型
   */
  static identifyErrorType(error: any): ErrorType {
    if (!error) return 'unknown';
    
    const message = (error.message || '').toLowerCase();
    const code = (error.code || '').toLowerCase();
    
    // 网络错误
    if (code.includes('network') || code.includes('connection') || 
        message.includes('network') || message.includes('connection') ||
        code === 'econnrefused' || code === 'enotfound' ||
        code === 'etimedout' || code === 'eai_again') {
      return 'network';
    }
    
    // 数据库错误
    if (code.includes('database') || code.includes('mysql') || 
        code.startsWith('er_') || code === 'protonotfound' ||
        message.includes('database') || message.includes('mysql')) {
      return 'database';
    }
    
    // API 错误
    if (code.includes('api') || code.includes('http') ||
        code.startsWith('http_') || (error.status && error.status >= 400)) {
      return 'api';
    }
    
    // 合规检查错误
    if (code.includes('compliance') || message.includes('compliance') ||
        message.includes('敏感词') || message.includes('违规')) {
      return 'compliance';
    }
    
    // 验证错误
    if (code.includes('validation') || code === 'invalid_input' ||
        message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    
    return 'unknown';
  }

  /**
   * 识别错误严重程度
   */
  static identifyErrorSeverity(error: any, context?: any): ErrorSeverity {
    if (!error) return 'info';
    
    const errorType = this.identifyErrorType(error);
    const statusCode = error.status || error.code;
    
    // 致命错误：系统无法继续运行
    if (errorType === 'database' && statusCode === 'econrefused') {
      return 'critical';
    }
    
    // 严重错误：影响核心功能
    if (errorType === 'database' || errorType === 'network') {
      return 'severe';
    }
    
    // API 错误根据状态码判断
    if (errorType === 'api') {
      if (statusCode >= 500) return 'severe';
      if (statusCode >= 400) return 'warning';
    }
    
    // 合规检查错误
    if (errorType === 'compliance') {
      return 'warning';
    }
    
    // 验证错误
    if (errorType === 'validation') {
      return 'info';
    }
    
    return 'warning';
  }

  /**
   * 创建上下文快照
   */
  static createContextSnapshot(options: {
    pipelineStep?: string;
    taskId?: string;
    topicId?: string;
    mode: string;
    triggerType: string;
    postType: string;
    title?: string;
    imageCount?: number;
    configSnapshot?: any;
    [key: string]: any;
  }): ContextSnapshot {
    const snapshot: ContextSnapshot = {
      pipelineStep: options.pipelineStep,
      taskId: options.taskId,
      topicId: options.topicId,
      mode: options.mode as any,
      triggerType: options.triggerType as any,
      postType: options.postType as any,
      title: options.title,
      imageCount: options.imageCount,
      configSnapshot: options.configSnapshot,
    };
    
    // 添加额外的上下文信息
    Object.keys(options).forEach(key => {
      if (!(key in snapshot)) {
        snapshot[key] = options[key];
      }
    });
    
    return snapshot;
  }

  /**
   * 创建重试记录
   */
  static createRetryRecord(options: {
    attempt: number;
    reason: string;
    success: boolean;
    error?: string;
    duration?: number;
  }): RetryRecord {
    return {
      attempt: options.attempt,
      timestamp: Date.now(),
      reason: options.reason,
      success: options.success,
      error: options.error,
      duration: options.duration,
    };
  }

  /**
   * 记录 Pipeline 步骤耗时
   */
  static recordPipelineStep(
    timings: PipelineTimings,
    step: string,
    startTime: number,
    status: 'success' | 'failed',
    metadata?: any
  ): PipelineTimings {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return {
      ...timings,
      [step]: {
        startTime,
        endTime,
        duration,
        status,
        metadata,
      },
    };
  }
}

/**
 * 性能监控工具
 */
export class PerformanceMonitor {
  private static startTime: number = Date.now();
  private static stepTimings: Map<string, number> = new Map();

  /**
   * 开始计时
   */
  static startTimer(step: string): void {
    this.stepTimings.set(step, Date.now());
  }

  /**
   * 结束计时并返回耗时
   */
  static endTimer(step: string): number {
    const start = this.stepTimings.get(step);
    if (!start) return 0;
    
    const duration = Date.now() - start;
    this.stepTimings.delete(step);
    return duration;
  }

  /**
   * 获取运行总时长
   */
  static getTotalDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 重置计时器
   */
  static reset(): void {
    this.startTime = Date.now();
    this.stepTimings.clear();
  }
}
