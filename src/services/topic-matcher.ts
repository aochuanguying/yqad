import { HotTopic, MatchedTopic } from '../types/posting-optimization';
import { generateContent } from '../ai/client';
import { RealAudiApi } from '../api/real-client';
import { getLogger } from '../utils/logger';

const logger = getLogger('topic-matcher');

/** 单例 RealAudiApi 实例 */
const apiClient = new RealAudiApi();

/**
 * 获取热门话题列表
 * 调用 RealApiClient.getHotTopics，内部已有 10 秒超时
 * 分页获取 5 页（共 100 个话题），以扩大候选池提升匹配质量
 * 失败时返回已获取的话题或空列表
 */
export async function fetchHotTopics(token: string): Promise<HotTopic[]> {
  const allTopics: HotTopic[] = [];
  const totalPages = 5;
  
  try {
    for (let page = 1; page <= totalPages; page++) {
      try {
        const topics = await apiClient.getHotTopics(token, page, 20);
        if (topics.length === 0) {
          logger.info(`第${page}页无数据，提前结束获取`);
          break;
        }
        allTopics.push(...topics);
        logger.info(`获取第${page}页热门话题：${topics.length}个 (累计：${allTopics.length}个)`);
      } catch (pageError: any) {
        logger.warn(`获取第${page}页热门话题失败：${pageError.message}，继续获取下一页`);
        // 单页失败不影响已获取的数据
      }
    }
    
    if (allTopics.length > 0) {
      logger.info(`热门话题获取完成：共${allTopics.length}个话题`);
    }
    
    return allTopics;
  } catch (error: any) {
    logger.error(`获取热门话题异常：${error.message}`);
    return allTopics; // 返回已成功获取的数据
  }
}

/**
 * 构建话题匹配的系统提示词
 */
function buildMatchSystemPrompt(): string {
  return `你是一个话题匹配助手。你的任务是根据帖子内容，从候选话题列表中选出与帖子语义最相关的话题。

规则：
1. 仅选择与帖子内容有语义关联的话题，不要强行匹配
2. 最多选择5个话题，如果没有相关话题则返回空数组
3. 返回结果必须是严格的 JSON 数组格式

返回格式（严格JSON，不要包含其他文字）：
[{"id": "话题ID", "name": "#话题名称#"}]

如果没有匹配的话题，返回：
[]`;
}

/**
 * 构建话题匹配的用户提示词
 */
function buildMatchUserPrompt(title: string, content: string, candidates: HotTopic[]): string {
  const candidateList = candidates
    .map((t) => `- ID: ${t.id}, 名称: ${t.name}, 热度: ${t.heatDegree}`)
    .join('\n');

  return `帖子标题：${title}

帖子正文：${content}

候选话题列表：
${candidateList}

请从候选话题中选出与帖子内容语义相关的话题（0-5个），以JSON数组格式返回。`;
}

/**
 * 从 AI 返回的文本中解析 JSON 数组
 */
function parseMatchResult(aiResponse: string): MatchedTopic[] {
  try {
    // 尝试直接解析
    let parsed = tryParseJson(aiResponse);
    if (parsed) return parsed;

    // 尝试从 markdown 代码块中提取
    const codeBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      parsed = tryParseJson(codeBlockMatch[1].trim());
      if (parsed) return parsed;
    }

    // 尝试提取方括号内容
    const bracketMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (bracketMatch) {
      parsed = tryParseJson(bracketMatch[0]);
      if (parsed) return parsed;
    }

    logger.warn(`无法解析AI话题匹配结果: ${aiResponse.substring(0, 200)}`);
    return [];
  } catch (error: any) {
    logger.warn(`解析AI话题匹配结果异常: ${error.message}`);
    return [];
  }
}

/**
 * 尝试将字符串解析为 MatchedTopic 数组
 */
function tryParseJson(text: string): MatchedTopic[] | null {
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return null;

    const results: MatchedTopic[] = [];
    for (const item of data) {
      if (item && typeof item.id === 'string' && typeof item.name === 'string') {
        results.push({ id: item.id, name: item.name });
      } else if (item && (item.id !== undefined) && (item.name !== undefined)) {
        results.push({ id: String(item.id), name: String(item.name) });
      }
    }
    return results;
  } catch {
    return null;
  }
}

/**
 * AI 语义匹配话题
 * 将帖子标题+正文与候选话题列表提交给 AI，由 AI 判断语义相关的话题
 * 最多返回5个话题，AI 调用失败时返回空列表
 *
 * @param title 帖子标题
 * @param content 帖子正文
 * @param candidates 候选热门话题列表
 * @returns 匹配的话题列表（0-5个）
 */
export async function matchTopics(
  title: string,
  content: string,
  candidates: HotTopic[]
): Promise<MatchedTopic[]> {
  // 无候选话题时直接返回空
  if (!candidates || candidates.length === 0) {
    return [];
  }

  try {
    const systemPrompt = buildMatchSystemPrompt();
    const userPrompt = buildMatchUserPrompt(title, content, candidates);

    const aiResponse = await generateContent({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
    });

    const matched = parseMatchResult(aiResponse);

    // 限制最多5个话题（Requirements 2.3）
    return matched.slice(0, 5);
  } catch (error: any) {
    logger.error(`AI话题匹配失败: ${error.message}`);
    return [];
  }
}
