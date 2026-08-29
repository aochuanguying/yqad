/**
 * 素材向量化与检索完整流程 DEMO（纯 JS，Node 18+ 直接运行）
 *
 * 演示：Vision 识别图片 -> 描述向量化 -> 存入 ChromaDB -> 语义检索
 *
 * 说明：使用 ChromaDB 测试环境集合 dev_demo_pipeline（dev_ 前缀），不影响生产 prod_ 数据。
 *
 * 运行：
 *   node scripts/demo-vector-pipeline.js                       # 用示例文字（不调 Vision）
 *   node scripts/demo-vector-pipeline.js /本地/图片.jpg         # 带图片，走完整 Vision 流程
 *
 * 需要环境变量（走 Vision 时）：AI_API_KEY
 */

const fs = require('fs');

// ===== 服务端点（对应当前项目配置）=====
const AI_GATEWAY    = 'https://ai.fssc.top/v1/chat/completions';
const AI_API_KEY    = process.env.AI_API_KEY || '';
const VISION_MODEL  = 'qwen';

const EMBEDDING_URL   = 'http://192.168.50.10:8100/v1/embeddings';
const EMBEDDING_MODEL = 'bge-m3';

const CHROMA_BASE = 'http://192.168.50.10:8000'
  + '/api/v2/tenants/default_tenant/databases/default_database/collections';
// 使用 dev_ 前缀的测试集合（遵循项目 dev/prod 集合前缀约定），不污染生产 prod_ 集合
const DEMO_COLLECTION = 'dev_demo_pipeline';

// ---------- 工具：统一 POST JSON ----------
async function postJson(url, body, headers = {}) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`HTTP ${resp.status} @ ${url}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

// ============================================================
// 步骤 1：Vision 大模型识别图片 -> 描述
// ============================================================
async function generateDescription(imagePath) {
  const base64 = fs.readFileSync(imagePath).toString('base64');
  const body = {
    model: VISION_MODEL,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: '你是图片描述专家。请根据图片内容生成1-2句中文描述，只输出描述。' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
      ],
    }],
  };
  const json = await postJson(AI_GATEWAY, body, { Authorization: `Bearer ${AI_API_KEY}` });
  return json.choices[0].message.content.trim();
}

// ============================================================
// 步骤 2：调用 bge-m3 向量化（返回 1024 维数组）
// ============================================================
async function embed(text) {
  const json = await postJson(EMBEDDING_URL, { model: EMBEDDING_MODEL, input: text });
  const vec = json.data[0].embedding;
  console.log(`  [向量化] 文本长度=${text.length}, 向量维度=${vec.length}`);
  return vec;
}

// ---------- 确保演示集合存在（1024 维 cosine）----------
async function ensureCollection() {
  // get_or_create：已存在则返回，不存在则创建
  const json = await postJson(CHROMA_BASE, {
    name: DEMO_COLLECTION,
    metadata: { 'hnsw:space': 'cosine' },
    get_or_create: true,
  });
  return json.id;
}

// ============================================================
// 步骤 3：向量 + 元数据 存入 ChromaDB（应用层提供向量，upsert 幂等）
// ============================================================
async function upsert(collectionId, id, vector, metadata) {
  await postJson(`${CHROMA_BASE}/${collectionId}/upsert`, {
    ids: [id],
    embeddings: [vector],
    metadatas: [metadata],
  });
  console.log(`  [入库] id=${id}`);
}

// ============================================================
// 步骤 4：查询文本向量化 -> ChromaDB 检索相似
// ============================================================
async function search(collectionId, queryText, topK = 3) {
  const queryVec = await embed(queryText);
  const json = await postJson(`${CHROMA_BASE}/${collectionId}/query`, {
    query_embeddings: [queryVec],
    n_results: topK,
    include: ['metadatas', 'distances'],
  });
  const distances = json.distances[0];
  const metadatas = json.metadatas[0];
  console.log(`\n  [检索] "${queryText}" 命中 ${distances.length} 条：`);
  for (let i = 0; i < distances.length; i++) {
    const similarity = 1 - distances[i]; // cosine 距离 -> 相似度
    console.log(`    #${i + 1} 相似度=${similarity.toFixed(3)} - ${metadatas[i].description}`);
  }
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  const imagePath = process.argv[2];

  console.log('=== 步骤 1：获取素材描述 ===');
  let description;
  if (imagePath && fs.existsSync(imagePath)) {
    console.log(`  调用 Vision 识别图片：${imagePath}`);
    description = await generateDescription(imagePath);
  } else {
    // 没有本地图片时，用示例文字演示后续流程
    description = '蓝天白云下波光粼粼的宽阔海面，远处是连绵山脉与城市轮廓，前景绿树掩映，宁静开阔的夏日海滨风光。';
    console.log('  （未提供图片，使用示例描述文字）');
  }
  console.log(`  描述：${description}\n`);

  const collectionId = await ensureCollection();
  console.log(`=== 演示集合就绪：${DEMO_COLLECTION} (${collectionId}) ===\n`);

  console.log('=== 步骤 2+3：描述向量化并存入 ChromaDB ===');
  const vector = await embed(description);
  await upsert(collectionId, 'demo_material_1', vector, {
    file_name: imagePath ? imagePath.split('/').pop() : 'demo.jpg',
    description,
  });

  // 再存一条无关素材，用于对比检索区分度
  const otherDesc = '繁华都市夜晚，霓虹灯闪烁的商业街，人群穿梭，车水马龙。';
  const otherVec = await embed(otherDesc);
  await upsert(collectionId, 'demo_material_2', otherVec, { file_name: 'city.jpg', description: otherDesc });

  console.log('\n=== 步骤 4：语义检索 ===');
  await search(collectionId, '海边风景 大海');   // 应命中海滨那条（高相似度）
  await search(collectionId, '城市夜景 街道');   // 应命中都市那条

  console.log('\n=== DEMO 完成 ===');
}

main().catch(err => {
  console.error('DEMO 失败：', err.message);
  process.exit(1);
});
