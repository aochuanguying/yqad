## 1. 部署本地 embedding 服务（x5）
- [x] 1.1 在 x5 拉取 HF TEI CPU 镜像（走南大 ghcr 镜像站），amd64 可用
- [x] 1.2 准备 bge-m3 权重持久化目录 `/opt/docker/embedding/data`；因 hf-mirror 不兼容 TEI range 请求且 config 走 xet 401，改用 huggingface_hub 预下载权重到缓存（禁用 xet）
- [x] 1.3 在 `/opt/docker/docker-compose.yml` 新增 `embedding` 服务（默认网络、mem_limit 4g、restart、端口 8100:80）
- [x] 1.4 `docker compose up -d embedding`，验证 `/v1/embeddings` 返回 1024 维向量，两段不同文本 cosine=0.3956（远低于阈值 0.90）

## 2. 应用配置接入
- [x] 2.1 `config/default.yaml` 新增 embedding 段（url=http://embedding:80/v1/embeddings、model=bge-m3、dimension=1024、timeout）
- [x] 2.2 yqad 服务环境变量新增 `EMBEDDING_URL`（compose environment），确认配置加载优先级正确

## 3. 改造 embedding-vectorizer
- [x] 3.1 `src/utils/embedding-vectorizer.ts`：`generateEmbedding` 改为真实 HTTP 调用 embedding 服务（含超时+1次重试），保持函数签名不变
- [x] 3.2 `batchGenerateEmbeddings` 改为调用服务批量接口，保持签名不变
- [x] 3.3 移除恒定零向量逻辑与"零向量模式"日志；默认维度改为 1024；从配置读取 url/model/dimension
- [x] 3.4 失败降级：服务不可用时抛错让上层走既有文本相似度兜底，禁止返回零向量；空文本确定性处理不抛异常
- [x] 3.5 保留 md5+TTL 缓存装饰器逻辑

## 4. 维度切换
- [x] 4.1 `src/utils/chroma-connection-manager.ts`：5 个集合 dimension 由 1536 改为 1024
- [x] 4.2 全局检索确认无其它硬编码 1536（content-deduplication-service 注释等）

## 5. ChromaDB 全量重建
- [x] 5.1 编写/复用一次性重建脚本：删除 prod_* 五个集合的旧零向量数据
- [x] 5.2 应用按新维度自动重建空集合（autoCreateCollections）
- [x] 5.3 从 MySQL post_history 回填 content_dedup 真实向量；从 material_record 回填 materials 真实向量
- [x] 5.4 脚本幂等、可重跑

## 6. 构建与部署
- [ ] 6.1 确认 dist 为最新（必要时 `rm -rf dist && npm run build`）
- [ ] 6.2 全量部署：`./scripts/deploy.sh --full`（或 x5 上重建 yqad 镜像 + compose 起 embedding）
- [ ] 6.3 部署前确认 `dist/web/public/` 存在且含 html

## 6b. 关联修复：去水印本地路径被当 URL 下载
- [x] 6b.1 `hybrid-material-service.downloadImageToTemp` 入口判断本地路径，直接复用不走网络
- [x] 6b.2 `image-downloader.downloadImages` 同样处理本地路径，避免 axios Invalid URL
- [x] 6b.3 编译通过并增量部署到 x5

## 6c. 关联修复：内容去重从未初始化（去重实际一直失效）
- [x] 6c.1 `chroma-search-service.checkContentDuplicate` 补 contentDedupStorage 懒初始化（此前一直抛"未初始化"被 catch 静默放行）
- [x] 6c.2 编译并部署；终验发帖去重显示真实相似度 0.517（非 0.000/1.000），无未初始化错误
- [x] 6c.3 materials 集合回填 186 条真实向量（MySQL 实际素材 186 条，非旧集合脏数据 71008）

## 7. 验证
- [x] 7.1 两段不同内容 cosine=0.3956，远低于阈值 0.90
- [x] 7.2 新集合查询：无关内容相似度 -0.06，相似内容 0.64，不再恒为 1.000
- [x] 7.3 手工触发发帖成功；重启 yqad 让 storage 重连新集合后，去重/合规链路正常（质量 92 分）
- [x] 7.4 降级路径由代码保证：embedding 调用失败抛错→上层文本相似度兜底（未实际停生产服务验证，逻辑已在 chroma-search catch + content-deduplication 降级分支覆盖）
- [x] 7.5 已清理本地/远端测试临时文件，无遗留测试进程与占用端口
