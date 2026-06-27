## 新增需求

### 需求: 素材库目录必须支持宿主机路径挂载
Docker 部署时，素材库目录必须通过 volume 映射到宿主机指定路径，使容器内的应用能访问宿主机上放置的素材文件。

#### 场景: 使用默认路径挂载
- **当** 用户未配置 `MATERIALS_PATH` 环境变量启动容器
- **那么** 容器内 `/app/data/materials` 必须映射到宿主机 `./data/materials` 目录

#### 场景: 使用自定义路径挂载
- **当** 用户通过 `MATERIALS_PATH` 环境变量指定宿主机路径（如 `/volume1/docker/audi-tasks/materials`）
- **那么** 容器内 `/app/data/materials` 必须映射到该自定义路径

#### 场景: 宿主机素材文件对容器可见
- **当** 宿主机挂载目录下存在素材文件（图片、视频等）
- **那么** 容器内应用必须能读取这些文件，路径为 `/app/data/materials/<文件名>`

### 需求: docker-compose 必须提供素材库路径配置项
`docker-compose.yml` 必须包含独立的素材库 volume 挂载条目和对应的环境变量说明。

#### 场景: docker-compose volume 独立挂载
- **当** 通过 `docker-compose up` 启动服务
- **那么** `docker-compose.yml` 中必须有单独的 volume 条目将 `${MATERIALS_PATH:-./data/materials}` 挂载到容器 `/app/data/materials`

#### 场景: 环境变量文档说明
- **当** 用户查看 `.env.example` 或 README 中的部署说明
- **那么** 必须有关于 `MATERIALS_PATH` 的说明，包含群晖 NAS 典型路径示例（如 `/volume1/docker/audi-tasks/materials`）
