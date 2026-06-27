## 上下文

项目存在 827 个 TypeScript 编译错误，主要是历史遗留问题。这些错误虽然不影响运行（因为使用了 `allowJs` 和宽松的编译选项），但严重影响了代码质量和可维护性。

## 目标 / 非目标

**目标：**
- 修复所有 827 个 TypeScript 编译错误
- 启用更严格的 TypeScript 检查选项
- 确保 `npm run build` 无错误通过

**非目标：**
- 不重构业务逻辑
- 不改变运行时行为
- 不添加新功能

## 决策

### 1. 批量修复策略

**方案**：按错误类型分组批量修复，优先修复高频错误（implicit any, File is not a module）。

**理由**：
- implicit any 占 30%+，修复后其他错误更容易定位
- File is not a module 是基础问题，修复后才能正常导入

### 2. tsconfig.json 严格模式

**方案**：逐步启用严格选项，先修复错误再启用检查。

**步骤**：
1. 先修复所有错误
2. 然后启用 `noUnusedLocals`, `noUnusedParameters`
3. 最后启用 `noImplicitReturns`, `noFallthroughCasesInSwitch`

## 风险 / 权衡

- **工作量巨大**：827 个错误涉及 68 个文件，需要大量手动修复
- **可能引入新 bug**：类型修正可能暴露运行时问题
- **编译时间增加**：严格模式会增加编译时间
