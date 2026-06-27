## 1. 修复 File is not a module 错误

- [ ] 1.1 修复 `src/ai/middleware/rate-limiter.ts` - 添加 `export {}` 或修正 export
- [ ] 1.2 修复 `src/ai/middleware/circuit-breaker.ts`
- [ ] 1.3 修复 `src/ai/middleware/error-classifier.ts`
- [ ] 1.4 修复 `src/ai/middleware/timeout-controller.ts`
- [ ] 1.5 修复 `src/ai/middleware/metrics.ts`
- [ ] 1.6 修复 `src/services/material-processing.ts`
- [ ] 1.7 修复 `src/services/comment-analyzer.ts`
- [ ] 1.8 修复 `src/services/post-parser.ts`
- [ ] 1.9 修复 `src/services/materials-paths.ts`
- [ ] 1.10 修复 `src/services/comment-service.ts`
- [ ] 1.11 修复 `src/web/services/config-events.ts`
- [ ] 1.12 修复 `src/utils/retry.ts`

## 2. 修复 implicit any 错误（高频）

- [ ] 2.1 修复所有 `Parameter 'o' implicitly has an 'any' type` (30 处)
- [ ] 2.2 修复所有 `Parameter 'res' implicitly has an 'any' type` (20 处)
- [ ] 2.3 修复所有 `Parameter 'req' implicitly has an 'any' type` (19 处)
- [ ] 2.4 修复所有 `Parameter 'post' implicitly has an 'any' type` (14 处)
- [ ] 2.5 修复所有 `Parameter 'p' implicitly has an 'any' type` (13 处)
- [ ] 2.6 修复所有 `Parameter 'id' implicitly has an 'any' type` (13 处)
- [ ] 2.7 修复所有 `Parameter 'v' implicitly has an 'any' type` (12 处)
- [ ] 2.8 修复所有 `Parameter 'mod' implicitly has an 'any' type` (10 处)

## 3. 修复 Cannot redeclare 错误

- [ ] 3.1 修复所有 `Cannot redeclare block-scoped variable 'logger'` (16 处)
- [ ] 3.2 修复所有 `Cannot redeclare block-scoped variable 'logger_1'` (16 处)
- [ ] 3.3 修复所有 `Cannot redeclare block-scoped variable 'config_1'` (9 处)
- [ ] 3.4 修复所有 `Cannot redeclare block-scoped variable 'axios_1'` (7 处)
- [ ] 3.5 修复所有 `Cannot redeclare block-scoped variable 'router'` (6 处)
- [ ] 3.6 修复所有 `Cannot redeclare block-scoped variable 'express_1'` (6 处)

## 4. 修复 Property does not exist 错误

- [ ] 4.1 修复 `CircuitBreaker` 的 `state`, `failureThreshold`, `resetTimeout`, `halfOpenMaxRequests`, `lastFailureTime` 属性
- [ ] 4.2 修复 `RateLimiter` 的 `burstSize` 属性
- [ ] 4.3 修复 `PostLoggingService` 的 `findByTaskId` 方法
- [ ] 4.4 修复 `ContentAnalysisService` 的 `authService`, `api`, `postParser` 属性

## 5. 修复 Type is 'unknown' 错误

- [ ] 5.1 修复所有 `error is of type 'unknown'` (10 处)
- [ ] 5.2 修复所有 `e is of type 'unknown'` (相关错误)

## 6. 修复其他类型错误

- [ ] 6.1 修复所有 `implicitly has an 'any' type` 的变量声明
- [ ] 6.2 修复所有 `Element implicitly has an 'any' type` 索引错误
- [ ] 6.3 修复所有 `Property 'X' does not exist on type` 错误
- [ ] 6.4 修复所有类型不匹配错误（Type X is not assignable to type Y）

## 7. 更新 tsconfig.json

- [ ] 7.1 启用 `noUnusedLocals: true`
- [ ] 7.2 启用 `noUnusedParameters: true`
- [ ] 7.3 启用 `noImplicitReturns: true`
- [ ] 7.4 启用 `noFallthroughCasesInSwitch: true`

## 8. 验证

- [ ] 8.1 运行 `npm run build` 确认无错误
- [ ] 8.2 运行 `npm test` 确认测试通过
