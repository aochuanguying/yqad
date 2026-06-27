## 1. 数据结构扩展

- [ ] 1.1 在 topics-service.ts 中定义 SubDirection 接口
- [ ] 1.2 扩展 Topic 接口，增加 subDirections 和 usedSubDirectionIndices 字段
- [ ] 1.3 更新 normalizeTopic 函数，为旧格式补充 subDirections 默认值

## 2. 内容池选取逻辑

- [ ] 2.1 实现 selectNextSubDirection 函数，按索引顺序选取子方向
- [ ] 2.2 在 topics-service.ts 中导出该函数
- [ ] 2.3 编写单元测试验证选取逻辑（首次、后续、耗尽场景）

## 3. 发帖流程集成

- [ ] 3.1 在 auto-post.ts 的 postWithTopic 中调用 selectNextSubDirection
- [ ] 3.2 修改 topicConstraint 构建，使用子方向的 direction 和 outline
- [ ] 3.3 在 incrementUseCount 时同步更新 usedSubDirectionIndices

## 4. Prompt 构建优化

- [ ] 4.1 在 prompts.ts 中更新 buildPostSystemPrompt，增加子方向参数
- [ ] 4.2 在 System Prompt 中明确说明"主题标题仅供参考"
- [ ] 4.3 在 User Prompt 中突出子方向的独特性
- [ ] 4.4 测试 Prompt 生成效果，确保 AI 理解标题策略

## 5. 发帖历史增强

- [ ] 6.1 扩展 PostSummary 接口，增加 usedSubDirectionIndex 字段
- [ ] 6.2 在 postWithTopic 记录发帖摘要时包含子方向索引
- [ ] 6.3 更新 topics.json 写入逻辑，保存子方向使用信息

## 6. 向后兼容处理

- [ ] 7.1 确保旧 topics.json 读取时自动补充 subDirections
- [ ] 7.2 测试无 subDirections 字段时退化为原 behavior
- [ ] 7.3 验证 maxUseCount=1 的主题不受影响

## 7. 测试与验证

- [ ] 8.1 创建测试主题（maxUseCount=3，3 个子方向）
- [ ] 8.2 执行 3 次发帖，验证每次使用不同子方向
- [ ] 8.3 验证生成的标题各不相同且与子方向相关
- [ ] 8.4 验证发帖历史记录包含 usedSubDirectionIndex
- [ ] 8.5 运行现有测试确保无破坏性变更
