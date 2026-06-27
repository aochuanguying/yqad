## 1. 配置更新

- [ ] 1.1 在 `config/default.yaml` 中添加 `featuredPosting.maxImages: 9`
- [ ] 1.2 在 `src/utils/config.ts` 中添加 `maxImages` 类型定义
- [ ] 1.3 在 `config-validator.ts` 中添加 `maxImages` 验证（0-9 范围）

## 2. 汇总字数计算

- [ ] 2.1 在 `featured-posting-policy.ts` 中添加汇总字数计算逻辑
- [ ] 2.2 修改 `evaluateFeaturedPostingReadiness` 函数，使用汇总字数替代单一正文字数
- [ ] 2.3 更新评估错误消息，说明是汇总字数

## 3. 图片上限检查

- [ ] 3.1 在 `evaluateFeaturedPostingReadiness` 中添加图片上限检查
- [ ] 3.2 添加图片超限的错误消息

## 4. 测试验证

- [ ] 4.1 测试汇总字数计算功能
- [ ] 4.2 测试图片上限检查功能
- [ ] 4.3 手动测试精华帖评估流程
