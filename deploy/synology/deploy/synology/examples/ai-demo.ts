/**
 * 大模型调用 Demo
 * 演示两种模型的调用方式：外网 GPT-5 和 公司内网 HiGPT (qwen3.5)
 *
 * 运行方式：
 *   npx ts-node examples/ai-demo.ts
 */

import OpenAI from 'openai';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}，请先在终端中设置后再运行`);
  }
  return value;
}

function getEnvInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(`环境变量 ${name} 必须是正整数，当前值: ${raw}`);
  }
  return value;
}

function getEnvFloat(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`环境变量 ${name} 必须是数字，当前值: ${raw}`);
  }
  return value;
}

// ============================================================
// Demo 1: 外网 GPT-5 (http://47.104.95.133:16781)
// ============================================================

async function demoGPT5() {
  console.log('='.repeat(60));
  console.log('Demo 1: 外网 GPT-5');
  console.log('='.repeat(60));

  // 创建客户端
  // 标准 OpenAI SDK 用法，只需配置 apiKey 和 baseURL
  const client = new OpenAI({
    apiKey: requireEnv('GPT5_API_KEY'),
    baseURL: process.env.GPT5_BASE_URL || 'http://47.104.95.133:16781/v1',
  });

  // --- 示例 1: 列出可用模型 ---
  console.log('\n--- 列出可用模型 ---');
  const models = await client.models.list();
  for (const model of models.data) {
    console.log(`  ${model.id} (${(model as any).display_name || ''})`);
  }

  // --- 示例 2: 简单对话 ---
  console.log('\n--- 简单对话 ---');
  const simpleResponse = await client.chat.completions.create({
    model: 'gpt-5.4-mini',  // 成本低，适合日常评论
    messages: [
      { role: 'user', content: '用一句话介绍奥迪Q5L的优点' },
    ],
    max_tokens: 200,
    temperature: 0.7,
  });
  console.log('  回复:', simpleResponse.choices[0].message.content);
  console.log('  Token用量:', simpleResponse.usage);

  // --- 示例 3: 带 system prompt 的对话（模拟社区评论生成） ---
  console.log('\n--- 带 System Prompt 的对话（模拟评论生成）---');
  const commentResponse = await client.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      {
        role: 'system',
        content: `你是一个奥迪车主社区的活跃用户。
你需要对帖子发表真实、自然的评论。
要求：语气友好、口语化，像真实车友在交流，长度50-150字。`,
      },
      {
        role: 'user',
        content: `请针对以下帖子写一条评论：
标题：新款Q5L提车作业，分享一下用车感受
内容：上个月提的Q5L 45TFSI，目前开了1500公里，整体感受非常满意。动力充沛，底盘质感出色。`,
      },
    ],
    max_tokens: 300,
    temperature: 0.8, // 稍高的 temperature 让回复更有创意
  });
  console.log('  生成的评论:', commentResponse.choices[0].message.content);

  // --- 示例 4: 生成帖子 ---
  console.log('\n--- 生成帖子 ---');
  const postResponse = await client.chat.completions.create({
    model: 'gpt-5.4',  // 用更强的模型生成帖子，质量更高
    messages: [
      {
        role: 'system',
        content: `你是一个奥迪车主社区的资深用户。
请创作一篇高质量社区帖子。
输出格式：第一行是标题，空一行后是正文（200-400字）。`,
      },
      {
        role: 'user',
        content: '请围绕"冬季用车保养"话题写一篇帖子',
      },
    ],
    max_tokens: 800,
    temperature: 0.7,
  });
  console.log('  生成的帖子:');
  console.log('  ' + postResponse.choices[0].message.content?.replace(/\n/g, '\n  '));
}

// ============================================================
// Demo 2: 公司内网 HiGPT (qwen3.5-397b)
// ============================================================

async function demoHiGPT() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('Demo 2: 公司内网 HiGPT (qwen3.5-397b)');
  console.log('='.repeat(60));

  const higptMaxTokens = getEnvInt('HIGPT_MAX_TOKENS', 6000);
  const higptTemperature = getEnvFloat('HIGPT_TEMPERATURE', 0.7);

  // 创建客户端
  // 关键区别：需要通过 defaultQuery 传递 user_key 参数
  const client = new OpenAI({
    apiKey: requireEnv('HIGPT_API_KEY'),
    baseURL: process.env.HIGPT_BASE_URL || 'https://inner-apisix.hisense.com/higpt-new/v1',
    defaultQuery: {
      user_key: requireEnv('HIGPT_USER_KEY'),
    },
  });

  // --- 示例 1: 简单对话 ---
  console.log('\n--- 简单对话 ---');
  console.log('  (注意：qwen3.5 是思考型模型，会先输出 reasoning_content 再输出 content)');
  console.log(`  HIGPT_MAX_TOKENS: ${higptMaxTokens}`);

  const simpleResponse = await client.chat.completions.create({
    model: 'qwen3-5-397b',
    messages: [
      { role: 'user', content: '用一句话介绍奥迪品牌的核心理念' },
    ],
    max_tokens: higptMaxTokens,
    temperature: higptTemperature,
  });

  const msg = simpleResponse.choices[0].message as any;
  console.log(
    '  最终回复:',
    msg.content || `(content 为空，可能 max_tokens 不够；可提高 HIGPT_MAX_TOKENS，目前=${higptMaxTokens})`
  );
  if (msg.reasoning_content) {
    console.log('  思考过程（前200字）:', msg.reasoning_content.substring(0, 200) + '...');
  }
  console.log('  Token用量:', simpleResponse.usage);

  // --- 示例 2: 带 system prompt 的评论生成 ---
  console.log('\n--- 评论生成（带 System Prompt）---');
  const commentResponse = await client.chat.completions.create({
    model: 'qwen3-5-397b',
    messages: [
      {
        role: 'system',
        content: `你是一个奥迪车主社区用户。针对帖子写一条自然的评论。
要求：口语化、友好、50-100字。直接输出评论内容，不要解释。`,
      },
      {
        role: 'user',
        content: `帖子标题：冬季保养小贴士，这几点要注意
帖子内容：北方的车友们注意了，冬季保养很重要：防冻液检查、电瓶电压、轮胎气压。`,
      },
    ],
    max_tokens: higptMaxTokens,
    temperature: higptTemperature,
  });

  const commentMsg = commentResponse.choices[0].message as any;
  console.log(
    '  生成的评论:',
    commentMsg.content || `(content 为空，可能 max_tokens 不够；可提高 HIGPT_MAX_TOKENS，目前=${higptMaxTokens})`
  );

  // --- 示例 3: Gemini 透传接口 ---
  console.log('\n--- Gemini 透传接口（如果可用）---');
  console.log('  URL: /v1/chat/completions/gemini-passthrough');
  console.log('  用法与标准接口一致，只是路径不同，用于 Gemini 模型');
  console.log('  （此 demo 不实际调用，避免报错）');
}

async function demoNasGateway() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('Demo 3: NAS OpenAI 兼容网关（外网标准 OpenAI 调用）');
  console.log('='.repeat(60));

  const client = new OpenAI({
    apiKey: requireEnv('OPENAI_GATEWAY_API_KEY'),
    baseURL: process.env.OPENAI_GATEWAY_BASE_URL || 'http://127.0.0.1:3000/v1',
  });

  console.log('\n--- 列出可用模型 ---');
  const models = await client.models.list();
  for (const model of models.data) {
    console.log(`  ${model.id}`);
  }

  console.log('\n--- 简单对话（model 使用别名 higpt）---');
  const resp = await client.chat.completions.create({
    model: 'higpt',
    messages: [{ role: 'user', content: '用一句话介绍奥迪品牌的核心理念' }],
    max_tokens: 500,
    temperature: 0.7,
  });

  console.log('  回复:', resp.choices[0].message.content);
  console.log('  Token用量:', resp.usage);
}

// ============================================================
// 辅助：对比两个模型的调用差异
// ============================================================

function printComparison() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('两个模型的关键差异对比');
  console.log('='.repeat(60));
  console.log(`
┌──────────────────┬───────────────────────────┬──────────────────────────────────┐
│                  │ GPT-5 (外网)               │ HiGPT qwen3.5 (内网)             │
├──────────────────┼───────────────────────────┼──────────────────────────────────┤
│ baseURL          │ http://47.104.95.133:16781/v1 │ https://inner-apisix.hisense.com/higpt-new/v1 │
│ 认证方式          │ Bearer token (标准)         │ Bearer token + URL query user_key │
│ SDK 配置          │ apiKey + baseURL           │ apiKey + baseURL + defaultQuery   │
│ 模型名称          │ gpt-5.4-mini / gpt-5.4    │ qwen3-5-397b                     │
│ 响应格式          │ 标准 content 字段           │ reasoning_content + content       │
│ max_tokens 建议   │ 500-1000                  │ 6000+（思考链消耗大量token）        │
│ 特点             │ 直接返回结果               │ 思考型模型，先推理再回答            │
│ 适用场景          │ NAS在家/外网环境           │ NAS在公司内网环境                  │
└──────────────────┴───────────────────────────┴──────────────────────────────────┘

代码核心区别：

  // GPT-5（标准用法）
  const gpt5Client = new OpenAI({
    apiKey: 'sk-xxx',
    baseURL: 'http://47.104.95.133:16781/v1',
  });

  // HiGPT（需要额外的 defaultQuery）
  const higptClient = new OpenAI({
    apiKey: 'sk-xxx',
    baseURL: 'https://inner-apisix.hisense.com/higpt-new/v1',
    defaultQuery: { user_key: 'xxxx' },
  });

处理 HiGPT 响应时需要注意：
  - qwen3.5 是思考型模型，最终答案在 content 字段
  - 如果 content 为空，说明 max_tokens 不够（思考链用完了）
  - 解决方案：增加 max_tokens（建议先设 HIGPT_MAX_TOKENS=6000 或更高）
`);
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log('大模型调用 Demo - GPT-5 & HiGPT\n');

  try {
    //await demoGPT5();
  } catch (error: any) {
    console.error('GPT-5 Demo 出错:', error.message);
  }

  try {
    await demoHiGPT();
  } catch (error: any) {
    console.error('HiGPT Demo 出错:', error.message);
    console.log('  （如果你不在公司内网，此错误是正常的）');
  }

  try {
    //await demoNasGateway();
  } catch (error: any) {
    console.error('NAS Gateway Demo 出错:', error.message);
  }

  //printComparison();
}

main().catch(console.error);
