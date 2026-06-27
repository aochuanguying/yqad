/**
 * 图片帖子处理 Demo
 * 演示如何用视觉大模型识别图片内容，生成评论和帖子
 *
 * 运行方式：
 *   npx ts-node examples/vision-demo.ts
 *
 * 已验证结论（2024-06测试）：
 *   ✅ GPT-5 支持 Vision API（base64 方式传图）
 *   ✅ 能正确识别图片内容并描述
 *   ⚠️ 直接传图片URL可能失败（服务端无法下载外部图片）
 *   ✅ 推荐方案：先下载图片 → 转 base64 → 传给模型
 *
 * 核心流程：
 *   1. 从帖子 API 获取帖子（可能只有标题 + 图片URL，没有正文）
 *   2. 下载图片转 base64，用视觉模型"看"图片，理解内容
 *   3. 基于图片理解 + 标题，生成评论或参考写帖子
 */

import OpenAI from 'openai';

// --- GPT-5 客户端 ---
const client = new OpenAI({
  apiKey: 'sk-chenyao-JBr74LyRGDbxaih1OqtHJcFP2Og3n8BeroW82Y2P',
  baseURL: 'http://47.104.95.133:16781/v1',
});

// ============================================================
// 模拟从 API 获取到的帖子数据（图片帖）
// ============================================================

interface ImagePost {
  id: string;
  title: string;
  content: string;          // 可能为空或很短
  images: string[];         // 图片URL列表
  author: string;
  likeCount: number;
  commentCount: number;
}

// 模拟一些典型的图片帖
const sampleImagePosts: ImagePost[] = [
  {
    id: 'post-img-001',
    title: '提车啦！全新A6L 黑武士',
    content: '',  // 没有文字内容，只有图片
    images: [
      'https://img.example.com/audi-a6l-black-1.jpg',
      'https://img.example.com/audi-a6l-black-2.jpg',
    ],
    author: '新车主小李',
    likeCount: 256,
    commentCount: 89,
  },
  {
    id: 'post-img-002',
    title: '一万公里保养清单，供参考',
    content: '刚做完一万公里保养',  // 很少的文字
    images: [
      'https://img.example.com/maintenance-list.jpg',  // 保养单据照片
    ],
    author: '细心车主',
    likeCount: 178,
    commentCount: 45,
  },
];

// ============================================================
// 方案 1: 用视觉模型识别图片内容
// ============================================================

/**
 * 用多模态模型识别图片内容
 * 支持传入图片 URL 或 base64 编码的图片
 */
async function describeImage(imageUrl: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'gpt-5.4-mini',  // 需要支持 vision 的模型
    messages: [
      {
        role: 'user',
        // content 使用数组格式，混合文本和图片
        content: [
          {
            type: 'text',
            text: '请描述这张图片的内容。如果是汽车相关的（车辆外观、内饰、保养记录等），请详细描述你看到的内容，包括车型、颜色、配置亮点等。如果图片中有文字，请提取出来。',
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              // detail: 'high',  // 可选：high/low/auto，high 更精确但消耗更多 token
            },
          },
        ],
      },
    ],
    max_tokens: 500,
  });

  return response.choices[0].message.content || '';
}

/**
 * 批量识别帖子中的所有图片
 */
async function analyzePostImages(post: ImagePost): Promise<string> {
  const descriptions: string[] = [];

  for (let i = 0; i < post.images.length; i++) {
    console.log(`    识别图片 ${i + 1}/${post.images.length}...`);
    const desc = await describeImage(post.images[i]);
    descriptions.push(`图片${i + 1}: ${desc}`);
  }

  return descriptions.join('\n');
}

// ============================================================
// 方案 2: 如果无法直接传图片URL，先下载转 base64
// ============================================================

/**
 * 将图片 URL 转为 base64 格式传给模型
 * 适用于：图片 URL 需要认证、或模型不支持直接访问 URL 的情况
 */
async function describeImageBase64(imageBuffer: Buffer, mimeType: string = 'image/jpeg'): Promise<string> {
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await client.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '请描述这张图片的内容，重点关注汽车相关信息。',
          },
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
    max_tokens: 500,
  });

  return response.choices[0].message.content || '';
}

// ============================================================
// 方案 3: 综合分析 - 标题+图片描述 → 生成评论
// ============================================================

/**
 * 基于图片帖子生成评论
 * 流程：标题 + 图片内容理解 → 生成自然评论
 */
async function generateCommentForImagePost(post: ImagePost, imageDescription: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      {
        role: 'system',
        content: `你是奥迪车主社区的活跃用户。
根据帖子的标题和图片内容描述，写一条自然、真实的评论。
要求：
- 像真实车友在评论，语气友好口语化
- 可以赞美、提问、分享自己的相关经验
- 50-150字
- 直接输出评论内容`,
      },
      {
        role: 'user',
        content: `帖子标题：${post.title}
帖子文字：${post.content || '（无文字内容）'}
作者：${post.author}
图片内容描述：
${imageDescription}

请针对这个帖子写一条评论：`,
      },
    ],
    max_tokens: 300,
    temperature: 0.8,
  });

  return response.choices[0].message.content || '';
}

// ============================================================
// 方案 4: 参考图片帖写自己的帖子
// ============================================================

/**
 * 参考多个图片帖的内容，生成自己的原创帖子
 * 流程：收集多个帖子的图片理解 → 提炼话题 → 生成原创帖子
 */
async function generatePostFromImagePosts(
  posts: Array<{ title: string; imageDescription: string }>
): Promise<{ title: string; content: string }> {
  // 将参考帖子信息整理为上下文
  const references = posts
    .map((p, i) => `参考帖${i + 1}：\n  标题：${p.title}\n  图片内容：${p.imageDescription}`)
    .join('\n\n');

  const response = await client.chat.completions.create({
    model: 'gpt-5.4',  // 用更好的模型写帖子
    messages: [
      {
        role: 'system',
        content: `你是奥迪车主社区的资深用户。
根据参考的社区热门帖子内容，创作一篇相关但原创的帖子。
要求：
- 不能照抄参考帖子，要有自己的视角和经验
- 内容真实自然，像真正的车主在分享
- 可以是用车心得、保养经验、改装分享等
- 输出格式：第一行标题，空一行后正文（200-400字）`,
      },
      {
        role: 'user',
        content: `以下是社区近期的热门帖子内容（通过图片识别）：

${references}

请参考这些帖子的话题方向，创作一篇原创帖子：`,
      },
    ],
    max_tokens: 800,
    temperature: 0.7,
  });

  const rawContent = response.choices[0].message.content || '';
  const lines = rawContent.split('\n');
  const title = lines[0].replace(/^[#\s]+/, '').trim();
  const content = lines.slice(1).join('\n').trim();

  return { title, content };
}

// ============================================================
// 完整流程演示
// ============================================================

async function fullPipelineDemo() {
  console.log('='.repeat(60));
  console.log('完整流程：图片帖识别 → 评论生成 → 参考发帖');
  console.log('='.repeat(60));

  const post = sampleImagePosts[0];
  console.log(`\n帖子: "${post.title}" (${post.images.length}张图片, 无文字内容)`);

  // 步骤1: 识别图片
  console.log('\n  步骤1: 用视觉模型识别图片内容...');
  // 注意：实际运行时需要真实可访问的图片URL
  // 这里用模拟数据演示
  const mockImageDescription = '一辆全黑色奥迪A6L，外观采用黑色运动套件，黑色轮毂，车身干净锃亮。拍摄于4S店门口，光线良好。第二张图片是车内中控台，全液晶仪表盘和MMI触控屏，黑色内饰搭配运动方向盘。';
  console.log(`  图片描述: ${mockImageDescription}`);

  // 步骤2: 生成评论
  console.log('\n  步骤2: 基于图片理解生成评论...');
  const comment = await generateCommentForImagePost(post, mockImageDescription);
  console.log(`  生成的评论: ${comment}`);

  // 步骤3: 参考写帖子
  console.log('\n  步骤3: 参考多个帖子写原创帖子...');
  const newPost = await generatePostFromImagePosts([
    { title: post.title, imageDescription: mockImageDescription },
    { title: sampleImagePosts[1].title, imageDescription: '一张保养工单照片，显示机油更换、空气滤清器更换、制动液检查，费用合计1850元。' },
  ]);
  console.log(`  生成的帖子标题: ${newPost.title}`);
  console.log(`  生成的帖子正文:\n  ${newPost.content.replace(/\n/g, '\n  ')}`);
}

// ============================================================
// 实际项目中的集成建议
// ============================================================

function printIntegrationGuide() {
  console.log(`
${'='.repeat(60)}
实际项目集成建议
${'='.repeat(60)}

1. API 返回数据结构中增加 images 字段：

   interface Post {
     id: string;
     title: string;
     content: string;       // 可能为空
     images: string[];      // 图片URL数组 ← 新增
     author: string;
     // ...
   }

2. 帖子分类处理：

   if (post.content.length > 50) {
     // 有文字的帖子：直接用文字生成评论（当前实现）
     await generateCommentFromText(post);
   } else if (post.images.length > 0) {
     // 图片帖：先识别图片，再生成评论
     const description = await analyzePostImages(post);
     await generateCommentFromImageDescription(post, description);
   } else {
     // 只有标题：仅基于标题生成简短评论
     await generateCommentFromTitle(post);
   }

3. 图片识别缓存：

   - 图片识别结果应该缓存（相同图片不需要重复识别）
   - 建议保存到 data/image-cache.json
   - 可以减少 API 调用次数和成本

4. 成本控制：

   - 图片识别比纯文本对话消耗更多 token
   - 建议每天限制图片识别数量（如最多10张）
   - 优先识别互动量高的帖子的图片

5. 模型选择建议：

   - GPT-5.4-mini: 支持 vision，成本低，适合日常图片识别
   - GPT-5.4: 图片理解更准确，适合需要精确描述的场景
   - gpt-image-1/1.5/2: 图片生成模型（如果需要生成配图）

6. 注意事项：

   - 一汽奥迪APP的图片URL可能需要认证才能访问
   - 如果模型无法直接访问图片URL，需要先下载图片再转 base64
   - base64 方式会增加请求体大小，注意接口的请求体限制
   - 经测试：GPT-5 不支持直接访问外部URL，必须用 base64 方式
   - 图片建议压缩到 500KB 以内再转 base64

7. 降级方案（如果 Vision 不可用或成本太高）：

   - 方案A：只评论有文字内容的帖子，跳过纯图片帖
   - 方案B：仅基于帖子标题 + 其他用户的评论来生成自己的评论
   - 方案C：用帖子标题让模型"猜测"图片可能的内容，再生成评论
   - 这些降级方案不需要 Vision API，成本为零
`);
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log('图片帖子处理 Demo\n');

  try {
    await fullPipelineDemo();
  } catch (error: any) {
    console.error('Demo 出错:', error.message);
    console.log('(如果是图片URL不可访问导致的错误，这是正常的)');
  }

  printIntegrationGuide();
}

main().catch(console.error);
