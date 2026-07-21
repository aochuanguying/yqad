## 规则

- 每次回答前先打招呼："您好，哥。"
- 除 openspec 的 .md 外，新生成的 .md 文件统一放到 docs 目录下
- openspec 的所有 .md 必须使用中文
- 接口命名风格必须与当前项目保持一致
- 有不确定的点，必须主动发起询问
- 实现功能前先调研方案，可列举对比后再实施
- 简洁至上：每次变更尽可能简单，仅改动必要代码
- 每次测试完后 kill 测试进程，不占用端口

## 生产环境连接信息

- MySQL: `192.168.50.50:3306`，用户 `root`，密码 `Wfw7539148@`，库名 `yqad_prod_db`
- Redis: `192.168.50.50:6379`，db `1`，keyPrefix `prod:`
- ChromaDB: `http://192.168.50.50:8000`
- 生产部署服务器（x5-server）: `192.168.50.10`，用户 `root`，密码 `Wfw7539148@`
  - Docker 数据目录: `/opt/docker/yqad/`
  - 编排文件: `/opt/docker/docker-compose.yml`
  - 网络模式: host（桥接网络有连通性问题）
  - 服务端口: 3080（3000 被 Nginx Proxy Manager 占用）
  - 访问地址: `http://192.168.50.10:3080`

## 构建与部署

- 本地启动服务使用 3000 端口；如端口被占用，先 kill 占用进程再启动
- 本地启动服务、打包镜像一律连接生产数据库
- 打包 NAS 镜像时必须指定 `--platform linux/amd64`
- x5-server 上构建镜像需加 `--network host`（容器默认桥接网络无法访问外网）
- 打包前须确保 dist 为最新编译产物；如无法确认，先 `rm -rf dist` 再 `npm run build`
- 打包镜像时确保所有运行时依赖完整，不可遗漏（特别注意 Python 脚本依赖和 native 模块）
- 打包 NAS 镜像导出固定为 `~/Documents/workspace/krio/yqad-latest.tar`，重名直接覆盖

## 关键规则

- openspec 归档时，如存在 delta specs 则直接归档到 specs，无需二次确认
- openspec 归档后，须确认归档的 changes 目录下无遗留文件

