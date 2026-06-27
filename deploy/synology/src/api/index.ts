import { IAudiApi } from './types';
import { MockAudiApi } from './mock-client';
import { RealAudiApi } from './real-client';
import { getAPIConfigStorage } from '../storage/mysql/api-config-storage';

export async function createApiClientAsync(): Promise<IAudiApi> {
  // 仅从数据库读取 API 配置
  try {
    const dbConfig = await getAPIConfigStorage().getConfig();
    if (dbConfig && dbConfig.mode === 'real') {
      console.log('[API] 从数据库读取到 real 模式，使用 RealAudiApi');
      return new RealAudiApi(dbConfig.baseUrl, dbConfig.timeout);
    } else if (dbConfig) {
      console.log('[API] 从数据库读取到 mock 模式，使用 MockAudiApi');
    } else {
      console.log('[API] 数据库中没有 API 配置，使用默认 mock 模式');
    }
  } catch (error: any) {
    console.log('[API] 从数据库读取 API 配置失败:', error.message);
  }

  console.log('[API] 默认使用 MockAudiApi');
  return new MockAudiApi();
}

// 向后兼容的同步版本（仅用于测试，推荐使用 createApiClientAsync）
export function createApiClient(): IAudiApi {
  console.log('[API] 同步模式默认使用 MockAudiApi');
  return new MockAudiApi();
}

export { IAudiApi } from './types';
export { MockAudiApi } from './mock-client';
export { RealAudiApi } from './real-client';
export { AuthService } from '../services/auth';
export { AutoPostService } from '../services/auto-post';
export * from './types';
