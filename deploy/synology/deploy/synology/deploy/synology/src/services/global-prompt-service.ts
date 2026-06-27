/**
 * 全局人设配置服务
 * 
 * 提供全局人设配置的读取、保存和验证功能
 */

import { globalPromptStorage, CreateGlobalPromptInput } from '../storage/mysql/global-prompt-storage';
import { getLogger } from '../utils/logger';

const logger = getLogger('global-prompt-service');

/**
 * 个人信息接口
 */
export interface PersonalInfo {
  carModel: string;
  gender: string;
  ageGroup: string;
}

/**
 * 全局人设配置接口
 */
export interface GlobalPrompt {
  personalInfo: PersonalInfo;
  styleDescription: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 保存结果
 */
export interface SaveResult {
  success: boolean;
  error?: string;
}

/**
 * 验证全局人设配置字段长度约束
 */
export function validate(prompt: GlobalPrompt): ValidationResult {
  const errors: string[] = [];
  
  if (prompt.personalInfo.carModel.length > 50) {
    errors.push('车型字段不能超过 50 个字符');
  }
  if (prompt.personalInfo.gender.length > 50) {
    errors.push('性别字段不能超过 50 个字符');
  }
  if (prompt.personalInfo.ageGroup.length > 50) {
    errors.push('年龄段字段不能超过 50 个字符');
  }
  if (prompt.styleDescription && prompt.styleDescription.length > 500) {
    errors.push('内容风格描述不能超过 500 个字符');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * 读取全局人设配置（异步，从 MySQL）
 */
export async function load(): Promise<GlobalPrompt | null> {
  try {
    const mysqlPrompt = await globalPromptStorage.get();
    
    if (!mysqlPrompt) {
      logger.debug('MySQL 中未找到全局人设配置');
      return null;
    }
    
    // MySQL JSON 字段返回的可能是对象或字符串，需要兼容处理
    let personalInfo: any;
    if (typeof mysqlPrompt.personal_info === 'string') {
      personalInfo = JSON.parse(mysqlPrompt.personal_info);
    } else {
      personalInfo = mysqlPrompt.personal_info;
    }
    
    const styleDescription = mysqlPrompt.style_description || '';
    
    return {
      personalInfo,
      styleDescription,
    };
  } catch (error) {
    logger.error(`读取全局人设配置失败：${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * 保存全局人设配置（异步，到 MySQL），验证通过后写入
 */
export async function save(prompt: GlobalPrompt): Promise<SaveResult> {
  const result = validate(prompt);
  if (!result.valid) {
    return { success: false, error: result.errors.join('; ') };
  }
  
  try {
    const input: CreateGlobalPromptInput = {
      personalInfo: prompt.personalInfo,
      styleDescription: prompt.styleDescription || null,
    };
    
    await globalPromptStorage.save(input);
    logger.info('全局人设配置已保存到 MySQL');
    return { success: true };
  } catch (error) {
    logger.error(`保存全局人设配置失败：${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
