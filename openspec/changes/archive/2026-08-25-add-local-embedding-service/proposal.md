## Why

当前 `embedding-vectorizer` 对所有文本恒定返回**零向量**（历史降级方案，注释称"当前所有 AI 模型都不支持向量化"）。这导致 ChromaDB 中所有向量完全相同，任意两条内容的 cosine 相似度恒为 `1.000`。直接后果是**内容去重功能彻底失效**：任何新帖都会被判定与历史帖 100% 重复，原创性评分为 0，合规检查拒绝发帖。线上已复现——手工触发发帖连续被"内容重复度过高 (100.0%)"拦截，无法发布。

现配置的 AI 网关（`ai.fssc.top`）不提供 `/embeddings` 接口，且无外部 embedding 服务账号。x5 服务器资源充足（22 线程 CPU、可用内存约 11Gi），可本地部署 embedding 模型治本。

## What Changes

- 在 x5 服务器用 Docker 部署本地 embedding 服务（bge-m3，1024 维），提供 OpenAI 兼容的 `/embeddings` 接口。
- 改造 `embedding-vectorizer`：调用本地 embedding 服务生成真实语义向量，保留服务不可用时的降级策略；移除恒定零向量逻辑。
- **BREAKING**：向量维度从 1536 变更为 1024。所有 ChromaDB 集合（content_dedup、materials、topic_recommend、sensitive_variants、comment_sentiment）中的旧零向量数据不兼容，必须清空并用真实向量重建。
- 提供历史数据重建流程：清空 prod 集合旧向量，从 MySQL 源数据重新生成真实向量写入 ChromaDB。
- 新增 embedding 服务连接配置（base_url、模型名、维度、超时）到 `config/default.yaml`。

## Capabilities

### New Capabilities
- `text-embedding`: 文本向量化能力。定义系统如何将文本转换为语义向量，包括调用本地 embedding 服务、失败降级、向量维度契约，以及零向量/异常向量的防御性处理。

### Modified Capabilities
- `vector-sync`: 批量同步与重建需求随真实向量化和维度变更而调整——同步时使用真实语义向量（非零向量），并支持因维度变更触发的全量重建。

## Impact

- 代码：`src/utils/embedding-vectorizer.ts`（核心改造）；`src/utils/chroma-connection-manager.ts`（维度 1536→1024）；`src/services/chroma-search-service.ts` 及所有调用 `embeddingVectorizer` 的服务（8 处，去重/素材/敏感词/主题推荐/评论情感）行为随之恢复正常。
- 配置：`config/default.yaml` 新增 embedding 服务配置项。
- 基础设施：x5 新增一个 embedding Docker 容器；`docker-compose.yml` 增加服务定义；容器间通过 bridge 网络服务名互联。
- 数据：ChromaDB 全部 prod 集合需清空重建（旧数据均为无效零向量，无损失）。
- 部署：需全量部署（`./scripts/deploy.sh --full`），涉及镜像依赖与 compose 变更。
