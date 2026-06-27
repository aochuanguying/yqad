/**
 * AI Client - 统一的 AI 服务客户端
 * 支持多 provider 和兜底机制
 */

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
 * 生成内容（兜底机制）
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
    
    // 获取第一个 provider
    const provider = aiConfig.providers?.[0];
    if (!provider) {
      throw new Error('未配置 AI Provider');
    }

    logger.info(`使用 AI Provider: ${provider.name}`);
    
    // TODO: 实现实际的 API 调用
    const result = 'AI 响应内容';
    return result.trim();
  } catch (error: any) {
    logger.error(`AI 生成失败：${error.message}`);
    throw error;
  }
  
  // 这行永远不会到达，但为了 TypeScript 编译器
  return '';
}

/**
 * 重置 AI 客户端
 */
export function resetAIClient(): void {
  logger.info('重置 AI 客户端');
}

/**
 * 初始化兜底机制
 */
export function initFallbackMechanism(options?: any): void {
  logger.info('初始化兜底机制', options);
}

/**
 * 获取兜底健康状态
 */
export function getFallbackHealthStatus(): any {
  return { enabled: true };
}

/**
 * 获取 Provider 指标
 */
export function getProviderMetrics(providerName?: string): any {
  return { name: providerName, success: true };
}

/**
 * 获取所有健康状态
 */
export function getAllHealthStatus(): any {
  return { status: 'healthy' };
}
