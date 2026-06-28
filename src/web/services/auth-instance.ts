import { apiClient } from '../../api';
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

export async function getAuthService(): Promise<{ authService: AuthService; api: IAudiApi | null }> {
  if (!authServiceInstance) {
    authServiceInstance = await AuthService.create(apiClient);
  }
  
  return {
    authService: authServiceInstance,
    api: apiClient,
  };
}

export async function getRealApi(): Promise<RealAudiApi | null> {
  return apiClient instanceof RealAudiApi ? apiClient : null;
}
