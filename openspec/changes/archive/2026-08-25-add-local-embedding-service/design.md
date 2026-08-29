## Context

现状约束（细节见 proposal.md）：

- `embedding-vectorizer` 恒返回 1536 维零向量，是全部语义能力（去重/素材/主题/敏感词/评论）的共同底层。
- x5 服务器：Intel Ultra 9 185H（22 线程），可用内存约 11Gi，无 NVIDIA GPU，x86_64，磁盘充足。
- 现有 AI 网关 `ai.fssc.top` 不提供 `/embeddings`，无外部 embedding key。
- 部署形态：docker compose，默认 bridge 网络，服务间用服务名互访（yqad 已用 `CHROMADB_URL=http://chromadb:8000`）。国内网络，镜像/依赖需走国内源。
- ChromaDB 各集合创建时以 `metadata.dimension` 声明维度（当前 1536），且用 cosine 距离；应用侧自行提供向量，ChromaDB 不生成 embedding。
- 调用方约定：`generateEmbedding(text)`、`batchGenerateEmbeddings(texts)`，返回 `number[]` / `number[][]`。改造须保持该签名不变，避免改动 8 处调用点。

## Goals / Non-Goals

**Goals:**
- 本地部署可用的文本 embedding 服务，产出真实语义向量，恢复内容去重及其它语义能力。
- `embedding-vectorizer` 接入该服务，保持现有函数签名与调用方零改动。
- embedding 服务不可用时安全降级，绝不因降级向量误判"完全重复"。
- 维度统一切换到 1024，并提供 ChromaDB 全量重建流程。

**Non-Goals:**
- 不引入 GPU 推理。
- 不改造去重/评分的业务阈值与权重（沿用现有 0.90 / minScore 60）。
- 不做 embedding 的多 provider 编排或计费统计。
- 不重写 ChromaDB 集合的距离函数（继续 cosine）。

## Decisions

### 决策 1：用 HF TEI（Text Embeddings Inference）CPU 镜像承载 bge-m3
- 理由：官方维护、性能优、原生提供 OpenAI 兼容 `/v1/embeddings`，有 CPU 镜像，直接支持 bge-m3。相比自写 FastAPI 更稳、免维护。
- bge-m3 输出 1024 维，多语言（中英俱佳），满足去重语义质量要求。
- 备选：自写 sentence-transformers FastAPI（维护成本高）、substratusai/stapi（社区活跃度低）。均不如 TEI。
- 部署：compose 新增 `embedding` 服务，bridge 网络，模型权重挂载到宿主机目录持久化避免每次重拉。首次启动需联网下载模型（走 HF 镜像站，若受限则先在宿主机拉好权重再挂载）。

### 决策 2：服务接入方式——OpenAI 兼容 HTTP，服务名 `embedding`
- yqad 容器通过 `EMBEDDING_URL=http://embedding:80/v1/embeddings`（TEI 默认监听 80）调用；`config/default.yaml` 新增 embedding 段（url、model、dimension=1024、timeout）。
- 本地开发连生产时通过 `192.168.50.10:<映射端口>` 访问同一服务，遵循"本地一律连生产"约定。

### 决策 3：embedding-vectorizer 改造——真实调用 + 防御式降级
- 保留 `EmbeddingVectorizer` / `CachedEmbeddingVectorizer` 结构与导出签名不变。
- `generateEmbedding`：POST 到 embedding 服务，解析返回向量；带超时与 1 次重试。
- 降级策略（关键）：服务失败时**抛出错误让上层走既有降级**，而不是返回零向量。`chroma-search-service.checkContentDuplicate` 的 catch 已能触发上层 `content-deduplication-service` 的文本相似度兜底（LCS+Jaccard），从而避免"零向量→相似度 1.000"的误判。
- 移除"零向量模式"日志与恒定零向量返回。dimension 默认改为 1024。
- 缓存：沿用现有 md5+TTL 内存缓存，减少重复文本请求。

### 决策 4：维度切换与全量重建
- `chroma-connection-manager` 中 5 个集合 `dimension` 由 1536 改为 1024。
- 由于 ChromaDB 集合维度在创建后不可变，需**删除并重建集合**。提供一次性重建脚本：
  1. 删除 prod_* 五个集合（旧数据均为无效零向量，无损失）。
  2. 让应用按新维度自动重建空集合（autoCreateCollections）。
  3. 从 MySQL 源数据（post_history、material_record 等）重新生成真实向量回填 content_dedup / materials 等。
- content_dedup 回填后，去重相似度即反映真实语义。

### 决策 5：部署路径
- 属全量部署：改了 compose、配置、需要新容器 →（本地）`./scripts/deploy.sh --full` 或在 x5 上 `docker compose up -d embedding` + 重启 yqad。
- x5 上构建/拉取镜像加 `--network host`；镜像/依赖走国内源。

## Risks / Trade-offs

- **首次模型下载**：bge-m3 权重约 2GB+，首次启动需联网。缓解：挂载持久化目录，必要时预下载权重到宿主机再挂载。
- **CPU 延迟**：单条 embedding CPU 推理约几十~几百 ms。发帖低频，可接受；批量重建走 batch 接口降低开销。
- **内存占用**：TEI + bge-m3 CPU 常驻约 2-4Gi。x5 可用 11Gi，安全；仍需给 embedding 服务设内存上限避免挤占。
- **维度变更破坏性**：重建期间去重能力短暂不可用。缓解：重建脚本幂等、可重跑；重建前旧数据本就是无效零向量。
- **降级期语义能力下降**：embedding 服务宕机时去重退化为文本相似度（能力弱但不误判、不阻断发帖）。可接受，优于当前"逢帖必拒"。
- **回填遗漏**：若某些集合无 MySQL 源（如 comment_sentiment 运行时累积），重建后从空开始，随运行自然回填，不影响发帖主流程。
