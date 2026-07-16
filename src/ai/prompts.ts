import { Post } from '../api/types';
import { GlobalPostPrompt, PostSummary } from '../types/posting-optimization';

// 评论分析特征（临时定义，等待 comment-analyzer 模块）
interface PostFeatures {
  post: Post;
  topic?: string;
  sentiment?: string;
  keywords?: string[];
  type?: string;
}

/** 评论风格模板 */
type CommentStyle = 'empathy' | 'question' | 'experience' | 'casual-critique' | 'brief';

/** 评论风格模板池 */
const COMMENT_STYLES: { style: CommentStyle; instruction: string }[] = [
  {
    style: 'empathy',
    instruction: '用共鸣的语气回应，表达"我也有类似感受/经历"，语气温暖亲切',
  },
  {
    style: 'question',
    instruction: '用好奇的语气，对帖子内容中的某个细节追问，像真的想了解更多',
  },
  {
    style: 'experience',
    instruction: '分享自己的相关经验或做法，自然地接话，像车友之间聊天',
  },
  {
    style: 'casual-critique',
    instruction: '用轻松吐槽的语气评论，可以带点幽默或调侃，但不要恶意',
  },
  {
    style: 'brief',
    instruction: '简短有力地回应，像随手刷到顺嘴评一句，不要长篇大论',
  },
];

/**
 * 构建拟人化评论系统 Prompt
 * 
 * 基于帖子实时分析特征构建个性化的评论 Prompt
 */
export function buildHumanToneCommentPrompt(
  features: PostFeatures,
  options?: {
    previousComment?: string;
    batchIndex?: number;
    recentOpenings?: string[];
    useColloquial?: boolean;
  }
): { systemPrompt: string; userPrompt: string } {
  const { type, topic, sentiment, keywords, post } = features;
  
  // 根据 batchIndex 轮换风格，避免同批次重复
  const styleIndex = (options?.batchIndex ?? Math.floor(Math.random() * COMMENT_STYLES.length)) % COMMENT_STYLES.length;
  const selectedStyle = COMMENT_STYLES[styleIndex];

  // 构建避免开头列表
  const avoidOpeningsBlock = options?.recentOpenings && options.recentOpenings.length > 0
    ? `\n\n【禁止使用的开头方式】以下是最近用过的评论开头，你必须避免使用相同或相似的开头：\n${options.recentOpenings.slice(0, 10).map(o => `- "${o}"`).join('\n')}`
    : '';

  // 上次评论提示（兜底模式）
  const previousCommentBlock = options?.previousComment
    ? `\n\n【注意】你之前对这个帖子评论过："${options.previousComment}"。这次必须换一个完全不同的角度和表达方式，不能重复相同的意思。`
    : '';

  // 100% 启用口语化要求，让评论更像真人随手发的
  const useColloquial = true;
  const colloquialBlock = '\n- 必须使用口语化表达，像微信聊天一样随意：可以用"哈哈"、"emmm"、"绝了"、"真的假的"等语气词'

  // 构建帖子特征块
  const featuresBlock = `
【帖子特征】
- 类型：${type === 'text-only' ? '纯文字' : type === 'image-text-long' ? '长图文' : '图文混合'}
- 主题：${topic || '日常分享'}
- 情感：${sentiment === 'positive' ? '正面' : sentiment === 'negative' ? '负面' : '中性'}
- 关键词：${keywords && keywords.length > 0 ? keywords.join('、') : '无明显关键词'}
`.trim();

  const systemPrompt = `你是一个奥迪车主社区的普通用户，正在刷帖随手评论。

${featuresBlock}

【你这次的评论风格】
${selectedStyle.instruction}

【核心规则】
- 必须针对帖子内容中的具体细节来评论（提到帖子里的某个点、作者说的某句话、或者图片内容）
- 不要用"感谢分享"、"写得好"、"学习了"这类万能废话开头
- 不要用排比句、不要列条目、不要用"首先...其次...最后"这种结构
- 像真人一样，可以只说半句话、可以跑题、可以用口语连接词
- **句末标点符号可有可无，不要刻意添加句号、感叹号等，像随手发的消息**${colloquialBlock}${avoidOpeningsBlock}${previousCommentBlock}

只输出评论内容本身，不要加引号、不要加"评论："前缀。`;

  const userPrompt = `帖子标题：${post.title}
帖子作者：${post.author}
帖子内容：${post.content}

请写一条自然的评论：`;

  return { systemPrompt, userPrompt };
}

/**
 * 生成评论的系统 Prompt（已废弃，不再使用社区分析）
 */
export function buildCommentSystemPrompt(summary: any): string {
  return `你是一个奥迪车主社区的活跃用户。你需要对社区帖子发表真实、自然的评论。

要求：
- 评论要与帖子内容紧密相关
- 语气自然、友好，像真实车友在交流
- 可以分享个人经验、提出问题或表达共鸣
- 不要使用过于正式或模板化的语言
- 评论长度控制在 20-200 字之间
- 只输出评论内容，不要加引号或其他标记`;
}

/**
 * 生成评论的用户Prompt
 */
export function buildCommentUserPrompt(post: Post): string {
  return `请针对以下帖子写一条自然的评论：

帖子标题：${post.title}
帖子内容：${post.content}

请直接输出评论内容：`;
}

/**
 * 构建全局人设注入块
 * 当 GlobalPostPrompt 存在时，将人设信息格式化为首要指令
 */
function buildGlobalPromptBlock(globalPrompt?: GlobalPostPrompt): string {
  if (!globalPrompt) return '';

  const { personalInfo, styleDescription } = globalPrompt;
  
  // 解析车型信息中的关键信息（如提车时间、里程等）
  const carModelText = personalInfo.carModel;
  const ownershipInfo = extractOwnershipInfo(carModelText);
  
  return `【发帖人设 - 必须严格遵守】
车主身份：${personalInfo.gender}性，${personalInfo.ageGroup}
座驾信息：${carModelText}${ownershipInfo ? `\n用车状况：${ownershipInfo}` : ''}
内容风格：${styleDescription || '真实自然的车主分享'}

【绝对禁止】
- 禁止使用与人设矛盾的用车时间（如人设是"提车 2 年"，就不能说"提车一个月"、"三个月"、"刚提车"、"首保"等）
- 禁止使用与人设矛盾的里程数（如人设是"32500KM"，就不能说"1000 公里"、"刚过磨合期"等）
- 提到用车时长时，必须与人设一致或更久（可以说"两年多"、"快三年了"，不能说"几个月"）

【重要提醒】
即使参考素材中有"提车一个月"等内容，你也必须将其转换为符合人设的时间线。你是这个车的老车主，不是新车主！

`;
}

/**
 * 从车型字段中提取用车状况信息
 * 例如："奥迪 Q5L 2024 款 40TSFI 黑色 提车 2 年 里程 32500KM" -> "提车 2 年，行驶 32500 公里"
 */
function extractOwnershipInfo(carModel: string): string {
  const patterns = [
    /提车 (\d+[年月半])/,
    /里程 (\d+)KM/i,
    /行驶 (\d+) 公里/,
    /(\d+) 年车龄/,
  ];
  
  const results: string[] = [];
  
  for (const pattern of patterns) {
    const match = carModel.match(pattern);
    if (match) {
      if (pattern.source.includes('提车')) {
        results.push(`提车${match[1]}`);
      } else if (pattern.source.includes('里程') || pattern.source.includes('行驶')) {
        const km = match[1];
        results.push(`行驶${km}公里`);
      } else {
        results.push(match[0]);
      }
    }
  }
  
  return results.length > 0 ? results.join('，') : '';
}

/**
 * 构建主题历史去重上下文块
 * 当存在同主题历史帖子时，提示 AI 避免重复
 */
function buildTopicHistoryBlock(topicHistory?: PostSummary[]): string {
  if (!topicHistory || topicHistory.length === 0) return '';

  const historyItems = topicHistory
    .map((h, i) => `${i + 1}. 标题：${h.title}\n   摘要：${h.contentSnippet}`)
    .join('\n');

  return `\n\n【同主题历史帖子（请避免重复相同的标题和论述角度）】
${historyItems}`;
}

/**
 * 生成帖子的系统 Prompt
 * 深度注入历史帖子样例，让 AI 充分学习社区的写作风格、结构和行文习惯
 * 当 globalPrompt 存在时，将人设信息作为首要指令注入，优先于社区风格分析
 * 
 * @param summary 社区分析摘要
 * @param globalPrompt 全局人设（可选）
 * @param topicHistory 同主题历史帖子（可选，用于去重）
 * @param subDirection 子方向（可选，用于内容池模式）
 * @param isTitleReference 标题是否仅供参考（可选，默认 false）
 */
export function buildPostSystemPrompt(
  summary: any, // 已移除社区分析摘要
  globalPrompt?: GlobalPostPrompt,
  topicHistory?: PostSummary[],
  subDirection?: { title: string; direction: string; outline: string },
  isTitleReference: boolean = false
): string {
  // 构建全局人设块（出现在 styleDescription 之前）
  const globalPromptBlock = buildGlobalPromptBlock(globalPrompt);

  // 示例帖子学习块已移除（不再使用社区分析）
  const exampleBlock = '';

  // 平均帖子长度提示已移除
  const avgLenHint = '';

  // 主题历史去重块
  const historyBlock = buildTopicHistoryBlock(topicHistory);

  // 构建子方向提示块
  const subDirectionBlock = subDirection
    ? `\n\n【本次创作的具体方向】
主题标题：${subDirection.title}${isTitleReference ? '（仅供参考，不需要保持一致）' : ''}
子方向：${subDirection.direction}
内容提纲：${subDirection.outline || '无'}

注意：
- 标题请根据子方向和内容自由生成，体现帖子亮点${isTitleReference ? '，主题标题仅供参考' : ''}
- 同一主题的多次发帖应有差异化和递进性`
    : '';

  // 构建社区风格块（summary 不存在时跳过）
  const communityStyleBlock = summary
    ? `在生成内容前，请先从以下社区数据中学习：

【社区风格特征】
${summary.styleDescription}
${avgLenHint}

【近期热门话题】
${summary.topics.join('、')}`
    : '在生成内容前，请遵循以下要求：';

  return `你是一个奥迪车主社区的资深用户，经常分享用车经验和汽车知识。你需要创作一篇高质量的社区帖子。

${globalPromptBlock}${communityStyleBlock}${exampleBlock}${historyBlock}${subDirectionBlock}

【写作要求】（基于以上学习内容，模仿真实社区帖子的风格）
- 模仿示例帖子的段落结构、开头方式、行文节奏和用词习惯
- 内容要原创、有价值，能引起其他车友的兴趣和讨论
- 可以是用车体验、保养心得、改装分享、新车资讯、自驾游记等
- 语气真实自然，像车友在社区里分享，不要像 AI 生成的广告文案
- ⚠️ **重要：避免负面对比** - 不要贬低或对比其他品牌/车型（例如不要说"不像某些车..."、"比 XX 车好"等）
- ⚠️ **重要：避免具体数值** - 油耗、里程等数据用模糊表达（例如"油耗还可以"、"油耗不高"，不要说"7.8 个油"）
- ⚠️ **重要：避免重复模式** - 每次发帖请变化：
  - 标题句式（不要总是"X 万公里实测"、"值得吗"、"如何"、"香不香"）
  - 开头方式（不要总是"很多人问"、"提车两年"）
  - 内容角度（不要总是"高速稳定性" + "油耗与空间" + "保养方面"三段式）
  - 结尾互动（不要总是"欢迎评论区分享"、"点赞收藏不迷路"）
  - 里程描述（不要总是"32500 公里"、"两年三万公里"，可以用"这段时间"、"最近"等模糊表达）
- 正文长度控制在 100-800 字之间
- 输出格式必须为：
  第一行：标题（不要加"标题："前缀）
  空一行
  正文内容`;
}

/**
 * 生成帖子的用户Prompt
 */
export function buildPostUserPrompt(topic: string, avoidTopics: string[], maxBodyLength?: number): string {
  let prompt = `请围绕"${topic}"这个话题，创作一篇社区帖子。`;

  if (avoidTopics.length > 0) {
    prompt += `\n\n注意避免与以下最近已发布话题重复：${avoidTopics.join('、')}`;
  }

  if (maxBodyLength) {
    prompt += `\n\n字数要求：正文控制在 ${maxBodyLength} 字以内（含标点），确保标题 + 正文总计不超过 480 字。`;
  }

  prompt += '\n\n请直接输出（第一行标题，空行后正文）：';
  return prompt;
}

export function buildFeaturedPostUserPrompt(topic: string, avoidTopics: string[], minContentChars: number, maxBodyLength?: number): string {
  let prompt = `请围绕"${topic}"这个话题，创作一篇高质量的奥迪车主社区图文帖文案。`;

  if (avoidTopics.length > 0) {
    prompt += `\n\n注意避免与以下最近已发布话题重复：${avoidTopics.join('、')}`;
  }

  const maxLengthConstraint = maxBodyLength ? `，最多 ${maxBodyLength} 字` : '';
  prompt += `\n\n【精华帖创作要求】\n\n1. 标题要求：\n   - 字数控制在 10-20 字之间\n   - 必须包含热点关键词（如车型、功能、场景相关词汇）\n   - 使用吸睛句式：提问式（"如何..."）、数据式（"3 个技巧..."）、痛点式（"别再..."）\n\n2. 内容结构要求：\n   - 开头引入：用提问、数据或痛点引入（1-2 句），吸引读者继续阅读\n   - 分段逻辑：正文至少包含 2 个小标题或编号列表，分段清晰\n   - 结尾互动：用引导语结尾，邀请评论、点赞、收藏（如"你怎么看？"、"欢迎分享你的经验"）\n\n3. 正文要求：\n   - 字数：${minContentChars}-${maxBodyLength || '800'} 字${maxLengthConstraint}\n   - 排版清晰分层：至少 4 段，每段 1-3 句\n   - 内容真实、原创、逻辑清晰，围绕奥迪选车/购车/用车/保养/售后/精品等相关内容展开\n   - 写作风格：原创真实、非营销腔、带个人体验，像真实车主分享\n\n4. 图片配合（重要）：\n   - 文案中可以自然提及"如图所示"、"看细节图"、"从这张图能看到"等引导语\n   - ⚠️ 禁止在正文中列出图片建议、图片清单或说明要放什么图片（例如：不能说"图片建议放 6-9 张：车头、侧面..."）\n   - 图片会自动匹配，你只需要专注于文字内容\n\n请直接输出（第一行标题，空行后正文）：`;
  return prompt;
}
