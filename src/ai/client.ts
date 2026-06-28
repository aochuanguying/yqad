/**
 * AI Client - 统一的 AI 服务客户端
 * 支持多 provider 和兜底机制
 */

import axios from 'axios';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { FallbackChain } from './middleware/fallback-chain';

const logger = getLogger('ai-client');

// 全局 FallbackChain 实例
let fallbackChain: FallbackChain | null = null;

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
 * 初始化 FallbackChain（必须在应用启动时调用）
 */
export function initFallbackChain(): void {
  const config = loadConfig();
  const aiConfig = config.ai;
  
  if (!aiConfig.providers || aiConfig.providers.length === 0) {
    logger.warn('未配置 AI Provider，无法初始化 FallbackChain');
    return;
  }

  const fallbackConfig = {
    enabled: aiConfig.fallback?.enabled ?? true,
    mode: aiConfig.fallback?.mode ?? 'robust',
    maxRetries: aiConfig.fallback?.maxRetries ?? 2,
    baseDelay: aiConfig.fallback?.baseDelay ?? 2000,
    maxDelay: aiConfig.fallback?.maxDelay ?? 10000,
    providerOrder: aiConfig.fallback?.providerOrder ?? aiConfig.providers.map(p => p.name),
  };

  const timeoutConfig = {};
  const rateLimitConfig = { tokensPerMinute: 60, burstSize: 10 };
  const circuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 60000,
    halfOpenMaxRequests: 3,
  };

  fallbackChain = new FallbackChain(
    fallbackConfig,
    timeoutConfig,
    rateLimitConfig,
    circuitBreakerConfig
  );

  fallbackChain.initProviders(aiConfig.providers);
  logger.info(`✓ FallbackChain 初始化完成 (${aiConfig.providers.length} 个 provider)`);
}

/**
 * 生成内容（调用 AI API）
 * 支持两种调用方式：
 * 1. generateContent(systemPrompt, userPrompt, options)
 * 2. generateContent({ systemPrompt, userPrompt, scene })
 * 
 * 使用 FallbackChain 兜底机制（如果已初始化）
 */
export async function generateContent(
  systemPromptOrOptions: string | GenerateContentOptions,
  userPrompt?: string,
  options?: GenerateContentOptions
): Promise<string> {
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
  
  if (!aiConfig.providers || aiConfig.providers.length === 0) {
    throw new Error('未配置 AI Provider');
  }

  // 如果 FallbackChain 已初始化，使用兜底机制
  if (fallbackChain) {
    logger.info(`使用 FallbackChain 调用 AI (scene=${options?.scene || 'comment'})`);
    
    const result = await fallbackChain.execute(
      async (provider, timeout) => {
        // 实际的 AI 调用逻辑
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

        const url = `${provider.baseUrl}/chat/completions`;
        
        logger.debug(`发送请求到：${url} (provider=${provider.name}, timeout=${timeout}ms)`);
        
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
            logger.debug(`✓ AI 响应成功 (provider=${provider.name}, ${content.length} 字符)`);
            return content.trim();
          }
        }

        throw new Error('AI 响应格式异常');
      },
      options?.scene
    );

    if (result.success && result.content) {
      logger.info(
        `✓ AI 生成成功 (provider=${result.usedProvider}, time=${result.responseTime}ms, fallbacks=${result.fallbacks.length})`
      );
      return result.content;
    } else {
      const errorMsg = result.errors.length > 0 
        ? result.errors.map(e => `${e.type}: ${e.message}`).join('; ')
        : '所有 provider 均失败';
      throw new Error(`AI 生成失败：${errorMsg}`);
    }
  }

  // FallbackChain 未初始化，使用传统模式（直接调用第一个 provider）
  logger.warn('FallbackChain 未初始化，使用传统模式');
  const provider = aiConfig.providers[0];
  
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
}


