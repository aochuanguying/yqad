## 1. 调研与依赖

- [x] 1.1 调研图片转换/压缩与元数据提取方案（优先 Node 依赖，备选 CLI），确认最终依赖与降级策略
- [x] 1.2 按调研结论更新依赖与构建配置（package.json / tsconfig 如需），并补充对应单元测试用例

## 2. 配置与目录拆分

- [x] 2.1 扩展配置：新增 materials.rawPath 与 materials.processedPath，并定义与 materials.basePath 的兼容策略
- [x] 2.2 更新配置校验（config-validator）与默认配置（config/default.yaml），补充配置校验的单元测试
- [x] 2.3 在材料相关服务中实现路径解析工具（raw/processed），并为路径穿越校验补充单元测试

## 3. post-materials 消费切换（默认使用处理后目录）

- [x] 3.1 修改 materials-service：索引/浏览/文件读取默认基于 processedPath，并保持排序与安全校验行为不变
- [x] 3.2 修改 image-selector 与发帖相关路径拼接逻辑：默认从 processedPath 选图与读图（兼容旧绝对路径）
- [x] 3.3 更新 Web UI 素材库页面：确保浏览与刷新均面向 processedPath，且不影响 heic/heif 的降级展示
- [x] 3.4 为 materials-service / materials-routes / image-selector 增加或补齐单元测试与接口测试（排序、过滤、路径安全、兼容路径）

## 4. material-processing 核心实现（增量梳理）

- [x] 4.1 定义并实现处理后目录的落盘结构：`.materials/manifest.json` 与梳理信息存储路径规则
- [x] 4.2 实现原始目录扫描：递归发现新增图片文件（按指纹与 manifest 判定），并支持仅处理新增素材
- [x] 4.3 实现格式转换与压缩：生成处理后图片文件；对不可处理文件实现失败降级（不中断整批）
- [x] 4.4 实现元数据提取与结构化存储：至少包含宽高/体积/格式；补充单元测试验证字段与落盘
- [x] 4.5 实现图片内容识别与介绍生成（可配置开关）：失败降级并落盘原因摘要；补充单元测试覆盖开关与失败路径

## 5. API 与调度集成

- [x] 5.1 新增 API：POST /api/materials/process（手工触发增量梳理），并为路由添加接口测试
- [x] 5.2 新增 API：GET /api/materials/info/:path（查询梳理信息），并为路由添加接口测试（存在/不存在/路径安全）
- [x] 5.3 扩展调度配置：新增素材梳理任务 cron 配置项，并接入现有 scheduler（含重入保护与热重载）
- [x] 5.4 为调度集成增加单元测试：验证 cron 注册、重入保护、以及配置变更后的重新调度行为

## 6. 验证与变更级集成测试

- [x] 6.1 运行全量测试（jest），并补齐本变更新增代码的必要单元测试
- [x] 6.2 在本变更目录创建 integration-tests.md（curl 命令）：覆盖 /api/materials（processed 目录）、/api/materials/process、/api/materials/info 的验收用例
