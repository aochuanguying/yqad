/**
 * 图片 OCR 提取文字 Demo
 *
 * 场景：一汽奥迪APP的很多帖子是"长图文"形式
 *       用户写的图文内容被APP渲染成一张长图发布
 *       需要从图片中提取完整文字，才能理解帖子内容
 *
 * 方案：用 GPT-5 Vision + 专门的 OCR 提示词提取文字
 *
 * 运行方式：
 *   npx ts-node examples/ocr-demo.ts
 */

import OpenAI from 'openai';
import axios from 'axios';

const client = new OpenAI({
  apiKey: 'sk-chenyao-JBr74LyRGDbxaih1OqtHJcFP2Og3n8BeroW82Y2P',
  baseURL: 'http://47.104.95.133:16781/v1',
});

// ============================================================
// 核心函数：从图片中提取文字（OCR）
// ============================================================

/**
 * 从图片中提取文字内容
 * 适用于：长图文帖子、截图、文档照片等包含大量文字的图片
 *
 * @param imageBase64 图片的 base64 编码
 * @param mimeType 图片MIME类型，默认 image/jpeg
 * @returns 提取到的文字内容
 */
async function extractTextFromImage(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<string> {
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  const response = await client.chat.completions.create({
    model: 'gpt-5.4',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            // 关键：OCR 专用提示词，让模型专注于提取文字
            text: `请提取这张图片中的所有文字内容。要求：
1. 完整提取所有可见文字，不要遗漏
2. 保持原始的段落结构和换行
3. 如果有标题，保留标题格式
4. 忽略装饰性元素（背景、边框、图标等）
5. 只输出提取到的文字，不要添加任何解释或说明`,
          },
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
    max_tokens: 2000, // 长图文可能有很多文字
    temperature: 0.1, // 低温度，确保提取准确
  });

  return response.choices[0].message.content?.trim() || '';
}

/**
 * 下载图片并转为 base64
 * 支持带认证头的图片URL（一汽奥迪APP可能需要）
 */
async function downloadImageAsBase64(
  imageUrl: string,
  headers?: Record<string, string>
): Promise<{ base64: string; mimeType: string }> {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    headers: headers || {},
    timeout: 30000,
  });

  const buffer = Buffer.from(response.data);
  const base64 = buffer.toString('base64');

  // 从 content-type 获取 MIME 类型
  const contentType = (response.headers['content-type'] as string) || 'image/jpeg';
  const mimeType = contentType.split(';')[0].trim();

  return { base64, mimeType };
}

// ============================================================
// 帖子处理流程
// ============================================================

interface RawPost {
  id: string;
  title: string;
  content: string;    // 可能为空
  images: string[];   // 图片URL列表
}

interface ProcessedPost {
  id: string;
  title: string;
  extractedText: string;  // 从图片OCR提取的完整文字
  originalContent: string;
  source: 'text' | 'ocr' | 'title-only';
}

/**
 * 智能处理帖子内容
 * 根据帖子类型（纯文字/图文长图/纯图片）采用不同策略
 */
async function processPost(
  post: RawPost,
  authHeaders?: Record<string, string>
): Promise<ProcessedPost> {
  // 情况1：有足够的文字内容，直接使用
  if (post.content && post.content.length > 50) {
    return {
      id: post.id,
      title: post.title,
      extractedText: post.content,
      originalContent: post.content,
      source: 'text',
    };
  }

  // 情况2：有图片，尝试 OCR 提取文字
  if (post.images.length > 0) {
    console.log(`  帖子 "${post.title}" - 正在OCR提取图片文字...`);

    const allText: string[] = [];
    for (const imageUrl of post.images) {
      try {
        // 下载图片
        const { base64, mimeType } = await downloadImageAsBase64(imageUrl, authHeaders);
        // OCR 提取文字
        const text = await extractTextFromImage(base64, mimeType);
        if (text) {
          allText.push(text);
        }
      } catch (error: any) {
        console.log(`    图片处理失败: ${error.message}`);
      }
    }

    const extractedText = allText.join('\n\n');
    if (extractedText.length > 20) {
      return {
        id: post.id,
        title: post.title,
        extractedText,
        originalContent: post.content,
        source: 'ocr',
      };
    }
  }

  // 情况3：没有文字也没有可识别的图片，只有标题
  return {
    id: post.id,
    title: post.title,
    extractedText: post.title,
    originalContent: post.content,
    source: 'title-only',
  };
}

// ============================================================
// 基于 OCR 提取的内容生成评论
// ============================================================

async function generateCommentFromOCR(post: ProcessedPost): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      {
        role: 'system',
        content: `你是奥迪车主社区的活跃用户。根据帖子内容写一条自然评论。
要求：语气友好口语化，像真实车友交流，50-150字。直接输出评论。`,
      },
      {
        role: 'user',
        content: `帖子标题：${post.title}
帖子正文（从图片中提取）：
${post.extractedText}

请写一条评论：`,
      },
    ],
    max_tokens: 300,
    temperature: 0.8,
  });

  return response.choices[0].message.content || '';
}

// ============================================================
// 基于多个 OCR 帖子内容参考发帖
// ============================================================

async function generatePostFromOCRContent(
  processedPosts: ProcessedPost[]
): Promise<{ title: string; content: string }> {
  const references = processedPosts
    .map((p, i) => `参考帖${i + 1}：\n标题：${p.title}\n内容：${p.extractedText.substring(0, 300)}`)
    .join('\n\n---\n\n');

  const response = await client.chat.completions.create({
    model: 'gpt-5.4',
    messages: [
      {
        role: 'system',
        content: `你是奥迪车主社区的资深用户。
参考社区近期帖子内容，创作一篇原创帖子。
要求：
- 有自己的视角和真实经验感
- 可以是用车心得、保养分享、改装体验等
- 200-400字
- 格式：第一行标题，空行后正文`,
      },
      {
        role: 'user',
        content: `参考以下社区帖子内容（从图片OCR提取），写一篇原创帖子：

${references}`,
      },
    ],
    max_tokens: 800,
    temperature: 0.7,
  });

  const raw = response.choices[0].message.content || '';
  const lines = raw.split('\n');
  const title = lines[0].replace(/^[#\s]+/, '').trim();
  const content = lines.slice(1).join('\n').trim();
  return { title, content };
}

// ============================================================
// 演示
// ============================================================

async function demo() {
  console.log('='.repeat(60));
  console.log('图片OCR帖子处理 Demo');
  console.log('='.repeat(60));

  // 模拟已经 OCR 提取到文字的帖子（因为测试环境无法访问真实图片URL）
  const mockProcessedPost: ProcessedPost = {
    id: 'post-ocr-001',
    title: '两万公里用车总结，给犹豫的朋友一个参考',
    extractedText: `开了两万公里了，聊聊我对Q5L的真实感受。

动力方面，2.0T高功率版本日常完全够用，超车很有信心。Sport模式下推背感明显。油耗城市里10个左右，高速能到7.5，对于一台中型SUV来说很满意。

空间方面，后排腿部空间很宽裕，家里人都说坐着舒服。后备箱放两个28寸行李箱绰绰有余，平时买菜接娃完全OK。

槽点也有：1.中控屏幕反光严重 2.座椅通风只有高配有 3.胎噪在粗糙路面偏大 4.手机互联偶尔会断连

总的来说瑕不掩瑜，这个价位综合实力确实强。要是能再便宜2万就更完美了哈哈。`,
    originalContent: '',
    source: 'ocr',
  };

  console.log(`\n帖子: "${mockProcessedPost.title}"`);
  console.log(`来源: OCR提取 (${mockProcessedPost.extractedText.length}字)`);
  console.log(`内容预览: ${mockProcessedPost.extractedText.substring(0, 100)}...`);

  // 生成评论
  console.log('\n--- 基于 OCR 内容生成评论 ---');
  const comment = await generateCommentFromOCR(mockProcessedPost);
  console.log(`评论: ${comment}`);

  // 参考发帖
  console.log('\n--- 参考 OCR 内容写原创帖子 ---');
  const mockPost2: ProcessedPost = {
    id: 'post-ocr-002',
    title: 'A4L一年养车成本明细，供参考',
    extractedText: '保险6800，保养两次共3200，油费月均1200，停车费月均500，洗车美容年均2000。总计约三万五一年，比BBA同级偏低。',
    originalContent: '',
    source: 'ocr',
  };

  const newPost = await generatePostFromOCRContent([mockProcessedPost, mockPost2]);
  console.log(`标题: ${newPost.title}`);
  console.log(`正文:\n${newPost.content}`);
}

// ============================================================
// 使用指南
// ============================================================

function printGuide() {
  console.log(`
${'='.repeat(60)}
实际使用指南：处理长图文帖子
${'='.repeat(60)}

核心思路：
  图片帖 ≠ 没有文字
  很多图片帖实际是 APP 把图文内容渲染成长图
  用 Vision OCR 就能完整还原帖子正文

提取流程：
  1. 拿到帖子的图片URL列表
  2. 下载图片（可能需要带 APP 的认证 headers）
  3. 转 base64 传给 GPT-5 Vision
  4. 用 OCR 专用提示词提取文字
  5. 得到完整帖子正文 → 当作普通文字帖处理

关键提示词（OCR专用，不是"描述图片"）：
  "请提取这张图片中的所有文字内容，保持原始段落结构，不要添加解释"

与"描述图片"的区别：
  ❌ "描述这张图片" → "这是一张包含文字的长图..."（没用）
  ✅ "提取图片中的文字" → 直接输出帖子正文（有用）

参数建议：
  - model: gpt-5.4（OCR准确度更高）
  - max_tokens: 2000+（长图文可能有很多字）
  - temperature: 0.1（低温度确保提取准确，不乱编）

图片大小优化：
  - 长图可能很大（几MB），传 base64 会很慢
  - 建议：压缩到 1920px 宽度、质量 80%
  - 文字内容清晰即可，不需要原图品质

成本估算：
  - 一张长图 OCR ≈ 500-1000 token（图片编码）+ 输出 token
  - 每天处理 20 张图片 ≈ 20000-40000 token
  - 用 gpt-5.4-mini 可降低成本，OCR 准确度略低但够用

降级方案（省钱）：
  - 不是所有帖子都需要 OCR
  - 可以只对互动量高的帖子做 OCR
  - 或者先检查帖子是否有文字内容，只对纯图片帖做 OCR
  - 甚至可以用标题 + 其他人的评论来推断帖子内容
`);
}

async function main() {
  try {
    await demo();
  } catch (error: any) {
    console.error('Demo 出错:', error.message);
  }
  printGuide();
}

main().catch(console.error);
