import { createApiClient } from '../../api';
import { RealAudiApi } from '../../api/real-client';
import { AuthService } from '../../services/auth';
import { IAudiApi } from '../../api/types';

/**
 * 共享的 AuthService 单例
 * 
 * 所有 Web 路由都应该使用这个单例，而不是各自创建独立的 AuthService 实例。
 * 这样可以确保 Token 状态在所有路由之间保持一致。
 */
let authServiceInstance: AuthService | null = null;
let apiInstance: IAudiApi | null = null;

export async function getAuthService(): Promise<{ authService: AuthService; api: IAudiApi | null }> {
  if (!authServiceInstance) {
    const api = createApiClient();
    authServiceInstance = await AuthService.create(api);
    apiInstance = api;
  }
  
  return {
    authService: authServiceInstance,
    api: apiInstance,
  };
}

export async function getRealApi(): Promise<RealAudiApi | null> {
  if (!apiInstance) {
    // 如果还没有初始化，先初始化
    const { api } = await getAuthService();
    return (api instanceof RealAudiApi) ? api : null;
  }
  return (apiInstance instanceof RealAudiApi) ? apiInstance : null;
}
