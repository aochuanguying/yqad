## 为什么

当前素材整理功能仅有架构框架（HybridMaterialService + MySQL + ChromaDB），但缺少核心的素材处理 Pipeline。系统可以"选择"素材，但无法"整理"素材——无法自动扫描文件系统、无法处理新图片、无法生成向量嵌入。这导致素材管理需要手动录入，严重限制了自动化程度和素材库的丰富性。

## 变更内容

1. **新增文件系统扫描器** - 监控素材目录变化，自动发现新图片并录入数据库
2. **新增素材处理服务** - 提取图片元数据、生成描述、自动标签化
3. **完善调度器处理器** - 实现完整的素材整理 Pipeline，支持定时/间隔触发
4. **新增向量同步工具** - 批量处理历史素材，生成 ChromaDB 向量嵌入

## 功能 (Capabilities)

### 新增功能
- `material-scanner`: 文件系统扫描器，监控素材目录并自动录入新素材
- `material-processor`: 素材处理服务，提取元数据、生成描述和标签
- `material-organizer`: 素材整理调度器，实现完整的整理 Pipeline
- `vector-sync`: 向量同步工具，批量生成历史素材的向量嵌入

### 修改功能
- `hybrid-material-service`: 增加素材扫描和自动录入能力

## 影响

- **代码影响**: 新增 4 个服务模块，修改 HybridMaterialService
- **数据库影响**: 使用现有 material_records 表，无需 Schema 变更
- **配置影响**: 新增素材整理相关配置项（扫描路径、处理选项）
- **依赖影响**: 可能需要新增图片处理库（sharp）、OCR 库（tesseract.js）
