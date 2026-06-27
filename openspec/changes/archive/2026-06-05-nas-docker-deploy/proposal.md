## 为什么

项目已具备 Docker 容器化能力，但在群晖 NAS 上实际部署时存在两个痛点：素材库路径硬编码在容器内无法灵活管理，以及发帖主题配置中选择素材文件时体验不友好（需手动填写路径）。这两个问题直接影响日常使用效率和可维护性，需在正式发布前解决。

## 变更内容

- **素材库路径外挂**：在 `docker-compose.yml` 中为素材库目录（`data/materials`）增加独立的宿主机路径映射，支持通过环境变量 `MATERIALS_PATH` 自定义宿主机路径，默认映射到 `./data/materials`。
- **发帖主题素材选择优化**：在 Web 管理界面的发帖主题配置页中，素材字段由手动输入路径改为文件浏览选择器（File Picker），列出宿主机已映射素材库下的可用文件，用户点击选择即可。
- **docker-compose.yml 更新**：增加 `MATERIALS_PATH` 环境变量配置项，volume 映射改为使用该变量，便于 NAS 用户按需调整到自己的存储路径。
- **部署文档更新**：在 README 和相关部署文档中补充 NAS 部署的 volumes 配置说明。

## 功能 (Capabilities)

### 新增功能

- `materials-volume-mount`: 素材库宿主机路径挂载配置，支持通过环境变量指定宿主机素材目录并映射到容器内，使宿主机上的素材文件对容器可见。
- `post-topic-file-picker`: 发帖主题配置中的素材文件选择器，提供可视化文件浏览界面替代手动路径输入，展示素材库下的文件列表供用户点选。

### 修改功能

- `auto-post`: 发帖配置中的素材路径字段改为使用文件选择器 API 填充，行为需求发生变化。

## 影响

- `docker-compose.yml`：新增 volumes 条目和环境变量
- `config/default.yaml`：`materials.basePath` 保持不变，但容器内路径固定为 `/app/data/materials`
- Web 管理界面（`src/` 相关前端/后端）：新增文件列表 API 接口，发帖主题配置表单改用文件选择器组件
- `docs/` 及 `README.md`：部署说明需同步更新
