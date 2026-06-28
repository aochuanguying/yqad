/**
 * Cookie 解析工具
 * 使用公共 AI 方法解析 Cookie 字符串
 */

import { generateContent } from '../ai';
import { getLogger } from './logger';

const logger = getLogger('cookie-parser');

export interface ParsedCookieResult {
  success: boolean;
  cookieDict?: Record<string, string>;
  a1Value?: string | null;
  error?: string;
}

/**
 * 使用 AI 解析 Cookie 字符串，提取所有键值对
 * 
 * @param cookieStr - Cookie 字符串
 * @returns 解析结果，包含 cookieDict 和 a1Value
 */
export async function parseCookieWithAI(cookieStr: string): Promise<ParsedCookieResult> {
  try {
    // 清理 Cookie 字符串（移除换行符和多余空格）
    const cleanedCookie = cookieStr.split(/\s+/).join(' ').trim();
    
    // 构建 Prompt
    const systemPrompt = '你是一个 Cookie 解析助手。你的任务是从 Cookie 字符串中提取所有键值对。';
    const userPrompt = `请从以下 Cookie 字符串中提取所有键值对，并以纯 JSON 格式返回（不要包含 markdown 格式，只要 JSON 对象）。

Cookie: ${cleanedCookie}

要求：
1. 提取所有键值对
2. 返回纯 JSON 对象，格式：{"key1": "value1", "key2": "value2"}
3. 不要包含任何解释文字，只要 JSON
4. 确保 JSON 格式正确，可以被解析`;

    // 调用公共 AI 方法
    const aiResponse = await generateContent({
      systemPrompt,
      userPrompt,
      scene: 'analysis',
    });

    logger.debug(`AI 解析 Cookie 响应：${aiResponse.substring(0, 200)}...`);

    // 解析 AI 返回的 JSON
    const cleanJson = aiResponse
      .trim()
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const cookieDict = JSON.parse(cleanJson) as Record<string, string>;
    const a1Value = cookieDict.a1 || null;

    logger.info(`✓ Cookie 解析成功，共 ${Object.keys(cookieDict).length} 个字段，a1: ${a1Value ? '存在' : '不存在'}`);

    return {
      success: true,
      cookieDict,
      a1Value,
    };
  } catch (error: any) {
    logger.warn(`AI 解析 Cookie 失败：${error.message}，使用简单解析回退`);

    // AI 解析失败，回退到简单解析
    const cookieDict: Record<string, string> = {};
    let a1Value: string | null = null;

    for (const item of cookieStr.split(';')) {
      if (item.includes('=')) {
        const [key, ...valueParts] = item.split('=');
        const value = valueParts.join('=').trim();
        const trimmedKey = key.trim();
        cookieDict[trimmedKey] = value;
        
        if (trimmedKey === 'a1') {
          a1Value = value;
        }
      }
    }

    logger.info(`简单解析 Cookie：共 ${Object.keys(cookieDict).length} 个字段，a1: ${a1Value ? '存在' : '不存在'}`);

    return {
      success: true,
      cookieDict,
      a1Value,
    };
  }
}

/**
 * 简单解析 Cookie（不使用 AI）
 * 
 * @param cookieStr - Cookie 字符串
 * @returns 解析结果
 */
export function parseCookieSimple(cookieStr: string): ParsedCookieResult {
  const cookieDict: Record<string, string> = {};
  let a1Value: string | null = null;

  for (const item of cookieStr.split(';')) {
    if (item.includes('=')) {
      const [key, ...valueParts] = item.split('=');
      const value = valueParts.join('=').trim();
      const trimmedKey = key.trim();
      cookieDict[trimmedKey] = value;
      
      if (trimmedKey === 'a1') {
        a1Value = value;
      }
    }
  }

  return {
    success: true,
    cookieDict,
    a1Value,
  };
}
