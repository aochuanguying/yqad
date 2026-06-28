import { IAudiApi } from './types';
import { RealAudiApi } from './real-client';

// 直接导出 RealAudiApi 实例
export const apiClient: IAudiApi = new RealAudiApi();

export { IAudiApi } from './types';
export { RealAudiApi } from './real-client';
export { AuthService } from '../services/auth';
export { AutoPostService } from '../services/auto-post';
export * from './types';
