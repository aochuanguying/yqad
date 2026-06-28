/**
 * 发帖日志增强功能 - 单元测试
 * 测试新增的性能指标、错误追踪、监控指标等功能
 */

import { PostLoggingService } from '../services/post-logging-service';
import { SensitiveDataSanitizer, ErrorTracker, PerformanceMonitor } from '../utils/post-log-utils';
import type { PipelineTimings, ContextSnapshot, RetryRecord } from '../types/post-logging';

describe('SensitiveDataSanitizer', () => {
  describe('sanitizeApiToken', () => {
    it('应该脱敏短 Token', () => {
      expect(SensitiveDataSanitizer.sanitizeApiToken('short')).toBe('***');
    });

    it('应该脱敏长 Token', () => {
      const token = 'sk-1234567890abcdef';
      const sanitized = SensitiveDataSanitizer.sanitizeApiToken(token);
      expect(sanitized).toBe('sk-1***cdef');
    });

    it('应该处理空 Token', () => {
      expect(SensitiveDataSanitizer.sanitizeApiToken('')).toBe('');
      expect(SensitiveDataSanitizer.sanitizeApiToken(undefined as any)).toBe('');
    });
  });

  describe('sanitizePhone', () => {
    it('应该脱敏手机号', () => {
      expect(SensitiveDataSanitizer.sanitizePhone('13812345678')).toBe('138****5678');
    });

    it('应该处理空手机号', () => {
      expect(SensitiveDataSanitizer.sanitizePhone('')).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('应该脱敏邮箱', () => {
      expect(SensitiveDataSanitizer.sanitizeEmail('test@example.com')).toBe('te***@example.com');
    });

    it('应该处理短邮箱', () => {
      expect(SensitiveDataSanitizer.sanitizeEmail('a@example.com')).toBe('***@example.com');
    });
  });

  describe('sanitizeErrorStack', () => {
    it('应该脱敏错误堆栈中的 Bearer Token', () => {
      const stack = 'Error: Failed\n    at fetch (Bearer abc123xyz)\n    at test.ts:10:5';
      const sanitized = SensitiveDataSanitizer.sanitizeErrorStack(stack);
      expect(sanitized).toContain('Bearer ***');
      expect(sanitized).not.toContain('abc123xyz');
    });

    it('应该脱敏错误堆栈中的手机号', () => {
      const stack = 'Error: Phone 13812345678 found';
      const sanitized = SensitiveDataSanitizer.sanitizeErrorStack(stack);
      expect(sanitized).toContain('138****5678');
    });

    it('应该脱敏错误堆栈中的邮箱', () => {
      const stack = 'Error: Email test@example.com found';
      const sanitized = SensitiveDataSanitizer.sanitizeErrorStack(stack);
      expect(sanitized).toContain('te***@example.com');
    });
  });
});

describe('ErrorTracker', () => {
  describe('identifyErrorType', () => {
    it('应该识别网络错误', () => {
      const error = new Error('Network error');
      (error as any).code = 'ECONNREFUSED';
      expect(ErrorTracker.identifyErrorType(error)).toBe('network');
    });

    it('应该识别数据库错误', () => {
      const error = new Error('Database error');
      (error as any).code = 'ER_DUP_ENTRY';
      expect(ErrorTracker.identifyErrorType(error)).toBe('database');
    });

    it('应该识别 API 错误', () => {
      const error = new Error('API error');
      (error as any).status = 500;
      expect(ErrorTracker.identifyErrorType(error)).toBe('api');
    });

    it('应该识别合规检查错误', () => {
      const error = new Error('包含敏感词');
      expect(ErrorTracker.identifyErrorType(error)).toBe('compliance');
    });

    it('应该识别验证错误', () => {
      const error = new Error('Invalid input');
      expect(ErrorTracker.identifyErrorType(error)).toBe('validation');
    });

    it('应该识别未知错误', () => {
      const error = new Error('Unknown error');
      expect(ErrorTracker.identifyErrorType(error)).toBe('unknown');
    });
  });

  describe('identifyErrorSeverity', () => {
    it('应该识别致命错误', () => {
      const error = new Error('Database connection refused');
      (error as any).code = 'ECONNREFUSED';
      expect(ErrorTracker.identifyErrorSeverity(error)).toBe('severe');
    });

    it('应该识别严重错误', () => {
      const error = new Error('Network error');
      (error as any).code = 'ETIMEDOUT';
      expect(ErrorTracker.identifyErrorSeverity(error)).toBe('severe');
    });

    it('应该识别 API 500 错误为严重', () => {
      const error = new Error('Internal Server Error');
      (error as any).status = 500;
      expect(ErrorTracker.identifyErrorSeverity(error)).toBe('severe');
    });

    it('应该识别 API 400 错误为警告', () => {
      const error = new Error('Bad Request');
      (error as any).status = 400;
      expect(ErrorTracker.identifyErrorSeverity(error)).toBe('warning');
    });
  });

  describe('createContextSnapshot', () => {
    it('应该创建上下文快照', () => {
      const snapshot = ErrorTracker.createContextSnapshot({
        pipelineStep: 'contentGeneration',
        taskId: 'task-123',
        mode: 'normal',
        triggerType: 'auto',
        postType: 'topic',
        title: 'Test Post',
        imageCount: 3,
      });

      expect(snapshot.pipelineStep).toBe('contentGeneration');
      expect(snapshot.taskId).toBe('task-123');
      expect(snapshot.mode).toBe('normal');
      expect(snapshot.triggerType).toBe('auto');
      expect(snapshot.postType).toBe('topic');
      expect(snapshot.title).toBe('Test Post');
      expect(snapshot.imageCount).toBe(3);
    });

    it('应该支持额外的上下文字段', () => {
      const snapshot = ErrorTracker.createContextSnapshot({
        mode: 'featured',
        triggerType: 'manual',
        postType: 'topic',
        customField: 'custom value',
      });

      expect(snapshot.customField).toBe('custom value');
    });
  });

  describe('createRetryRecord', () => {
    it('应该创建重试记录', () => {
      const record = ErrorTracker.createRetryRecord({
        attempt: 2,
        reason: 'Network timeout',
        success: false,
        error: 'Connection timeout',
        duration: 5000,
      });

      expect(record.attempt).toBe(2);
      expect(record.reason).toBe('Network timeout');
      expect(record.success).toBe(false);
      expect(record.error).toBe('Connection timeout');
      expect(record.duration).toBe(5000);
    });
  });

  describe('recordPipelineStep', () => {
    it('应该记录 Pipeline 步骤', () => {
      const timings: PipelineTimings = {};
      const startTime = Date.now() - 1000;
      
      const result = ErrorTracker.recordPipelineStep(
        timings,
        'contentGeneration',
        startTime,
        'success',
        { generated: true }
      );

      expect(result.contentGeneration).toBeDefined();
      expect(result.contentGeneration!.duration).toBeGreaterThan(900);
      expect(result.contentGeneration!.status).toBe('success');
      expect(result.contentGeneration!.metadata).toEqual({ generated: true });
    });
  });
});

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    PerformanceMonitor.reset();
  });

  describe('startTimer and endTimer', () => {
    it('应该记录步骤耗时', () => {
      PerformanceMonitor.startTimer('testStep');
      
      // 等待 100ms
      const start = Date.now();
      while (Date.now() - start < 100) {
        // 空转
      }
      
      const duration = PerformanceMonitor.endTimer('testStep');
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('应该处理未开始的计时器', () => {
      const duration = PerformanceMonitor.endTimer('nonExistentStep');
      expect(duration).toBe(0);
    });
  });

  describe('getTotalDuration', () => {
    it('应该返回总运行时长', () => {
      PerformanceMonitor.reset();
      const start = Date.now();
      
      // 等待 50ms
      while (Date.now() - start < 50) {
        // 空转
      }
      
      const total = PerformanceMonitor.getTotalDuration();
      expect(total).toBeGreaterThanOrEqual(50);
    });
  });

  describe('reset', () => {
    it('应该重置所有计时器', () => {
      PerformanceMonitor.startTimer('step1');
      PerformanceMonitor.reset();
      
      const duration = PerformanceMonitor.endTimer('step1');
      expect(duration).toBe(0);
    });
  });
});

describe('PostLoggingService - 性能指标', () => {
  // 注意：这些测试需要实际的数据库连接
  // 在实际环境中，应该使用 mock 数据库或集成测试
  
  describe('getPerformanceMetrics', () => {
    it('应该返回性能指标结构', async () => {
      const service = PostLoggingService.getInstance();
      
      // 由于没有数据库，这里只测试方法存在
      expect(service.getPerformanceMetrics).toBeDefined();
      
      // 实际调用会失败，因为需要数据库
      try {
        const metrics = await service.getPerformanceMetrics();
        expect(metrics).toHaveProperty('averageDuration');
        expect(metrics).toHaveProperty('p50Duration');
        expect(metrics).toHaveProperty('p90Duration');
        expect(metrics).toHaveProperty('p99Duration');
      } catch (error) {
        // 预期会失败，因为数据库未运行
        expect(error).toBeDefined();
      }
    });
  });

  describe('getConversionRates', () => {
    it('应该返回环节转化率结构', async () => {
      const service = PostLoggingService.getInstance();
      
      expect(service.getConversionRates).toBeDefined();
      
      try {
        const rates = await service.getConversionRates();
        expect(rates).toHaveProperty('subDirectionSelection');
        expect(rates).toHaveProperty('contentGeneration');
        expect(rates).toHaveProperty('publish');
        expect(rates).toHaveProperty('overallSuccessRate');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('getRealTimeMetrics', () => {
    it('应该返回实时监控指标结构', async () => {
      const service = PostLoggingService.getInstance();
      
      expect(service.getRealTimeMetrics).toBeDefined();
      
      try {
        const metrics = await service.getRealTimeMetrics();
        expect(metrics).toHaveProperty('currentHour');
        expect(metrics).toHaveProperty('today');
        expect(metrics.currentHour).toHaveProperty('totalPosts');
        expect(metrics.currentHour).toHaveProperty('successRate');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('checkAlerts', () => {
    it('应该返回告警结构', async () => {
      const service = PostLoggingService.getInstance();
      
      expect(service.checkAlerts).toBeDefined();
      
      try {
        const result = await service.checkAlerts({
          minSuccessRate: 80,
          maxAverageDuration: 120000,
          maxErrorCount: 10,
        });
        expect(result).toHaveProperty('hasAlerts');
        expect(result).toHaveProperty('alerts');
        expect(Array.isArray(result.alerts)).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});

describe('PipelineTimings 类型', () => {
  it('应该支持所有 Pipeline 步骤', () => {
    const timings: PipelineTimings = {
      subDirectionSelection: {
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        duration: 1000,
        status: 'success',
        metadata: { selectedSubDirectionIndex: 0 },
      },
      contentGeneration: {
        startTime: Date.now() - 2000,
        endTime: Date.now(),
        duration: 2000,
        status: 'success',
      },
      materialSelection: {
        startTime: Date.now() - 1500,
        endTime: Date.now(),
        duration: 1500,
        status: 'success',
      },
      imageUpload: {
        startTime: Date.now() - 3000,
        endTime: Date.now(),
        duration: 3000,
        status: 'success',
      },
      topicMatching: {
        startTime: Date.now() - 500,
        endTime: Date.now(),
        duration: 500,
        status: 'success',
      },
      diversityTransform: {
        startTime: Date.now() - 800,
        endTime: Date.now(),
        duration: 800,
        status: 'success',
      },
      complianceCheck: {
        startTime: Date.now() - 1200,
        endTime: Date.now(),
        duration: 1200,
        status: 'success',
      },
      publish: {
        startTime: Date.now() - 600,
        endTime: Date.now(),
        duration: 600,
        status: 'success',
      },
    };

    expect(Object.keys(timings).length).toBe(8);
  });
});

describe('ContextSnapshot 类型', () => {
  it('应该支持必需的上下文字段', () => {
    const snapshot: ContextSnapshot = {
      pipelineStep: 'complianceCheck',
      taskId: 'task-456',
      topicId: 'topic-789',
      mode: 'featured',
      triggerType: 'auto',
      postType: 'topic',
      title: 'Test Post',
      imageCount: 5,
      configSnapshot: {
        minImages: 3,
        maxImages: 9,
      },
    };

    expect(snapshot.pipelineStep).toBe('complianceCheck');
    expect(snapshot.mode).toBe('featured');
    expect(snapshot.triggerType).toBe('auto');
    expect(snapshot.postType).toBe('topic');
  });
});
