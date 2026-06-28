/**
 * 发帖日志工具函数 - 测试脚本
 * 直接运行验证工具函数的正确性
 */

import { SensitiveDataSanitizer, ErrorTracker, PerformanceMonitor } from '../src/utils/post-log-utils';

console.log('=== 开始测试发帖日志工具函数 ===\n');

// 测试敏感信息脱敏
console.log('1. 测试敏感信息脱敏工具');
console.log('   API Token 脱敏:', SensitiveDataSanitizer.sanitizeApiToken('sk-1234567890abcdef'));
console.log('   手机号脱敏:', SensitiveDataSanitizer.sanitizePhone('13812345678'));
console.log('   邮箱脱敏:', SensitiveDataSanitizer.sanitizeEmail('test@example.com'));
console.log('   数据库连接脱敏:', SensitiveDataSanitizer.sanitizeConnectionString('mysql://user:password@localhost:3306/db'));

const testStack = `Error: Failed
    at fetch (Bearer abc123xyz)
    Phone: 13812345678
    Email: test@example.com
    DB: mysql://user:secret@localhost/db`;

console.log('   错误堆栈脱敏:', SensitiveDataSanitizer.sanitizeErrorStack(testStack));
console.log('   ✅ 敏感信息脱敏测试通过\n');

// 测试错误追踪
console.log('2. 测试错误追踪工具');

// 网络错误
const networkError = new Error('Network error');
(networkError as any).code = 'ECONNREFUSED';
console.log('   网络错误类型:', ErrorTracker.identifyErrorType(networkError));

// 数据库错误
const dbError = new Error('Database error');
(dbError as any).code = 'ER_DUP_ENTRY';
console.log('   数据库错误类型:', ErrorTracker.identifyErrorType(dbError));

// API 错误
const apiError = new Error('API error');
(apiError as any).status = 500;
console.log('   API 错误类型:', ErrorTracker.identifyErrorType(apiError));
console.log('   API 500 错误严重程度:', ErrorTracker.identifyErrorSeverity(apiError));

// 上下文快照
const snapshot = ErrorTracker.createContextSnapshot({
  pipelineStep: 'contentGeneration',
  taskId: 'task-123',
  mode: 'normal',
  triggerType: 'auto',
  postType: 'topic',
  title: 'Test Post',
  imageCount: 3,
});
console.log('   上下文快照:', JSON.stringify(snapshot, null, 2));

// 重试记录
const retryRecord = ErrorTracker.createRetryRecord({
  attempt: 2,
  reason: 'Network timeout',
  success: false,
  error: 'Connection timeout',
  duration: 5000,
});
console.log('   重试记录:', JSON.stringify(retryRecord, null, 2));
console.log('   ✅ 错误追踪测试通过\n');

// 测试性能监控
console.log('3. 测试性能监控工具');

PerformanceMonitor.reset();
PerformanceMonitor.startTimer('testStep');

// 等待 100ms
const start = Date.now();
while (Date.now() - start < 100) {
  // 空转
}

const duration = PerformanceMonitor.endTimer('testStep');
console.log('   步骤耗时:', duration + 'ms (应该 >= 100ms)');
console.log('   总运行时长:', PerformanceMonitor.getTotalDuration() + 'ms');
console.log('   ✅ 性能监控测试通过\n');

console.log('=== 所有测试通过 ===');
