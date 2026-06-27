## 为什么

编译时发现 827 个 TypeScript 错误，主要问题包括：implicit any 类型缺失、File is not a module 导出问题、重复声明、类型定义不匹配等。这些错误虽然大多是历史遗留问题，但影响了代码质量和可维护性，需要系统性修复。

## 变更内容

批量修复所有 TypeScript 编译错误，使 `npm run build` 能够成功通过。主要修复：

1. **implicit any** - 为参数和变量添加类型注解
2. **File is not a module** - 修复文件导出（添加 `export {}` 或修正 export 语句）
3. **Cannot redeclare** - 清理重复声明
4. **Property does not exist** - 修正类型定义或实现
5. **Type is 'unknown'** - 添加类型断言或类型守卫
6. **tsconfig.json** - 启用严格检查选项

## 功能 (Capabilities)

### 新增功能
- `typescript-strict-mode`: 启用 `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`

### 修改功能
- 修复所有 implicit any 错误
- 修复所有 File is not a module 错误
- 修复所有类型不匹配错误

## 影响

- **影响范围**：全项目 68 个 TypeScript 文件
- **无破坏性变更**：仅修复类型错误，不改变运行时行为
- **配置变更**：`tsconfig.json` 启用更多严格选项
