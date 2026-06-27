# 群晖 NAS 素材库路径配置指南

本文说明如何在群晖 NAS 上正确配置素材库路径，使容器内的自动发帖任务能访问到宿主机上管理的素材文件，并通过 Web 管理界面的文件选择器方便地为发帖主题关联素材。

---

## 1. 工作原理

项目通过 Docker volume 将宿主机（群晖 NAS）上的一个目录挂载到容器内的 `/app/data/materials`：

```
宿主机: /volume1/docker/audi-tasks/materials  →  容器: /app/data/materials
```

你在宿主机目录下放置的任何文件，容器内都能直接访问。`docker-compose.yml` 通过 `MATERIALS_PATH` 环境变量来控制宿主机映射路径。

---

## 2. 快速配置步骤

### 2.1 创建宿主机素材目录

在群晖「File Station」或 SSH 中创建目录：

```bash
mkdir -p /volume1/docker/audi-tasks/materials
chmod 755 /volume1/docker/audi-tasks/materials
```

> 路径可根据实际情况调整，如 `/volume1/photo/audi-materials`。

### 2.2 配置 .env 文件

在项目根目录，将 `.env.example` 复制为 `.env` 并修改 `MATERIALS_PATH`：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# 素材库宿主机路径（群晖NAS示例）
MATERIALS_PATH=/volume1/docker/audi-tasks/materials
```

### 2.3 启动容器

```bash
docker-compose up -d
```

验证挂载是否生效：

```bash
docker exec audi-auto-tasks ls /app/data/materials
```

---

## 3. 向素材库添加文件

将图片等素材文件复制到宿主机挂载目录即可。支持以下方式：

- **File Station 上传**：在群晖 DSM 文件管理器直接拖拽上传
- **rsync 同步**：`rsync -avz ./local-materials/ nas:/volume1/docker/audi-tasks/materials/`
- **SMB 共享**：将该目录设为群晖 SMB 共享文件夹，从 Windows/macOS 直接拖拽

文件放入后，Web 管理界面的文件选择器会自动读取，无需重启容器。

---

## 4. 在 Web 管理界面配置发帖主题素材

1. 打开 Web 管理界面（默认 `http://<NAS_IP>:3000`）
2. 切换到「📝 发帖主题」标签
3. 点击「+ 新建主题」
4. 填写标题和方向描述后，点击「📷 选择素材文件」按钮
5. 在弹出的文件列表中勾选所需素材，点击「确认选择」
6. 保存主题

> 文件选择器展示的是素材库根目录下的直接文件（最多 500 条）。若素材较多，建议使用子目录分类管理，然后通过「📷 素材库」标签浏览。

---

## 5. 权限问题排查

如果容器无法读取素材文件，通常是权限问题：

```bash
# 查看当前权限
ls -la /volume1/docker/audi-tasks/materials

# 修复权限（确保 Docker 容器可读）
chmod -R 755 /volume1/docker/audi-tasks/materials
```

群晖 DSM 中还可通过「控制台」→「共享文件夹」→「权限」来设置文件夹访问权限。

---

## 6. 常见问题

**Q: 文件选择器提示「加载素材列表失败」**

检查：
- 宿主机素材目录是否存在且有文件
- `MATERIALS_PATH` 是否在 `.env` 中正确设置
- 容器是否已重启以应用新的环境变量

**Q: 素材文件已放入目录，但列表为空**

`GET /api/materials/files` 只列出素材库根目录下的直接文件（非子目录）。若文件在子目录中，请将文件移到根目录，或使用「📷 素材库」标签（支持递归浏览）。

**Q: 更换了 MATERIALS_PATH，旧主题的素材路径是否还有效？**

有效。主题配置中存储的是相对于素材库根目录的相对路径（如 `banner.jpg`），只要新挂载目录下有同名文件，就能正常读取。
