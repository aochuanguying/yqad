/**
 * AI Client - 统一的 AI 服务客户端
 * 支持多 provider 和兜底机制
 */

import axios from 'axios';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';

const logger = getLogger('ai-client');

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface GenerateContentOptions {
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  scene?: 'comment' | 'post' | 'analysis';
}

/**
 * 生成内容（调用 AI API）
 * 支持两种调用方式：
 * 1. generateContent(systemPrompt, userPrompt, options)
 * 2. generateContent({ systemPrompt, userPrompt, scene })
 */
export async function generateContent(
  systemPromptOrOptions: string | GenerateContentOptions,
  userPrompt?: string,
  options?: GenerateContentOptions
): Promise<string> {
  try {
    let systemPrompt: string;
    let finalUserPrompt: string | undefined;
    
    // 支持对象参数
    if (typeof systemPromptOrOptions === 'object') {
      systemPrompt = systemPromptOrOptions.systemPrompt || '';
      finalUserPrompt = systemPromptOrOptions.userPrompt;
      options = systemPromptOrOptions;
    } else {
      systemPrompt = systemPromptOrOptions;
      finalUserPrompt = userPrompt;
    }
    
    if (!finalUserPrompt) {
      throw new Error('userPrompt is required');
    }

    const config = loadConfig();
    const aiConfig = config.ai;
    
    console.log(`[AI Client] 配置中的 providers: ${JSON.stringify(aiConfig?.providers?.map(p => p.name) || [])}`);
    
    // 获取第一个 provider
    const provider = aiConfig.providers?.[0];
    if (!provider) {
      throw new Error('未配置 AI Provider');
    }

    logger.info(`使用 AI Provider: ${provider.name} (模型：${provider.model})`);
    
    // 构建请求体
    const messages: any[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: finalUserPrompt });

    const requestBody: any = {
      model: provider.model,
      messages,
      temperature: provider.temperature ?? 0.7,
      max_tokens: provider.maxTokens ?? 1000,
    };

    // 发送 API 请求
    const url = `${provider.baseUrl}/chat/completions`;
    const timeout = options?.timeout ?? provider.requestTimeout ?? 30000;
    
    logger.debug(`发送请求到：${url}`);
    
    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      },
      timeout,
    });

    // 解析响应
    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const content = response.data.choices[0].message?.content;
      if (content) {
        logger.info(`AI 响应成功 (${content.length} 字符)`);
        return content.trim();
      }
    }

    throw new Error('AI 响应格式异常');
  } catch (error: any) {
    logger.error(`AI 生成失败：${error.message}`);
    if (error.response) {
      logger.error(`API 响应状态：${error.response.status}`);
      logger.error(`API 响应数据：${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}


