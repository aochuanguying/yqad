# 素材整理功能使用指南

## 功能概述

素材整理功能自动扫描、处理和分类素材图片，为自动发帖系统提供高质量的图片资源。

### 核心功能

1. **自动扫描** - 递归扫描素材目录，发现新图片
2. **智能处理** - 提取元数据，AI 生成描述和标签
3. **向量嵌入** - 生成语义向量，支持智能搜索
4. **批量同步** - 批量处理历史素材到 ChromaDB

## 配置

### 基础配置

在 `config/default.yaml` 中配置素材路径：

```yaml
materials:
  basePath: "./data/materials/processed"
  rawPath: "./data/materials/raw"        # 原始素材目录
  processedPath: "./data/materials/processed"
```

### 调度配置

支持两种模式：

#### 间隔模式（推荐）

```yaml
scheduler:
  materialProcessing:
    enabled: true
    intervalMinutes: 30  # 每 30 分钟执行一次
```

#### Cron 模式

```yaml
scheduler:
  materialProcessing:
    enabled: true
    cron: "0 */2 * * *"  # 每 2 小时
    randomOffsetMin: 0
    randomOffsetMax: 10  # 0-10 分钟随机偏移
```

## 使用方式

### 1. 自动执行（定时任务）

系统启动后，根据配置自动执行素材整理。

### 2. Web 界面手动触发

访问 Web 管理界面，点击"素材整理"按钮。

### 3. API 调用

```bash
POST http://localhost:3000/api/materials/process
```

响应：

```json
{
  "success": true,
  "message": "素材整理完成",
  "data": {
    "scanned": 150,
    "added": 25,
    "updated": 0,
    "failed": 2,
    "skipped": 123,
    "durationMs": 45000
  }
}
```

### 4. 批量同步历史素材

创建一次性脚本 `scripts/sync-vectors.ts`：

```typescript
import { syncHistoricalMaterials } from '../src/tools/vector-sync-tool';

async function main() {
  console.log('开始同步历史素材...');
  const result = await syncHistoricalMaterials({
    batchSize: 100,
    force: false,
  });
  console.log('同步完成:', result);
}

main();
```

执行：

```bash
npx ts-node scripts/sync-vectors.ts
```

## 工作流程

```
┌─────────────┐
│ 扫描素材目录 │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 计算文件哈希 │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 检查是否已存在│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 提取元数据   │◄── sharp 库
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ AI 生成描述   │◄── AI 服务
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ AI 生成标签   │◄── AI 服务
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 录入 MySQL   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 生成 ChromaDB│◄── 向量嵌入
└─────────────┘
```

## 素材要求

### 支持的格式

- `.jpg` / `.jpeg`
- `.png`
- `.heic`（仅录入，元数据提取可能失败）

### 推荐的文件组织

```
data/materials/raw/
├── suv/
│   ├── q5l/
│   │   ├── interior/
│   │   ├── exterior/
│   │   └── features/
│   └── q3/
└── sedan/
    └── a4l/
```

## 日志和监控

### 关键日志

```
[INFO] 开始扫描素材目录：/path/to/materials
[INFO] 扫描到 150 个文件
[INFO] 过滤后支持的文件：145 个
[INFO] 发现新素材：25 个
[INFO] 处理素材：/path/to/image.jpg
[INFO] 生成描述：奥迪 Q5L 内饰，真皮座椅...
[INFO] 生成标签：内饰，豪华，舒适
[INFO] 素材录入数据库：material_123
[INFO] 生成向量嵌入：material_123
```

### 错误处理

- 单个素材处理失败不影响其他素材
- 详细错误日志记录到文件
- Web 界面显示失败数量和原因

## 常见问题

### Q: 素材整理多久执行一次？
A: 默认 30 分钟，可在配置中调整 `intervalMinutes`。

### Q: 如何关闭素材整理？
A: 设置 `scheduler.materialProcessing.enabled: false`。

### Q: 如何查看已整理的素材？
A: 访问 Web 管理界面的"素材管理"页面。

### Q: 向量搜索不准确怎么办？
A: 运行强制同步重新生成向量：
```typescript
await syncHistoricalMaterials({ force: true });
```

### Q: 支持 HEIC 格式吗？
A: 支持录入，但元数据提取可能失败（sharp 不支持 HEIC）。建议转换为 JPG。

## 性能优化

### 批次大小调整

```typescript
// 默认每批 50 个素材
await batchProcessMaterials(fileInfos, 50);

// 内存充足时可增大批次
await batchProcessMaterials(fileInfos, 100);
```

### AI 服务限流

批次间自动暂停 1 秒，避免 AI 服务限流。

### ChromaDB 连接

使用连接池，自动复用连接。

## 下一步

- [ ] 实现素材去重（感知哈希）
- [ ] 实现图像识别（场景分类）
- [ ] 实现素材质量评分
- [ ] 实现素材使用策略优化
