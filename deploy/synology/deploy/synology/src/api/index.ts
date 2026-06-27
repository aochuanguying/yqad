import { IAudiApi } from './types';
import { MockAudiApi } from './mock-client';
import { RealAudiApi } from './real-client';
import { loadConfig } from '../utils/config';

export function createApiClient(): IAudiApi {
  const config = loadConfig();

  if (config.api.mode === 'mock') {
    return new MockAudiApi();
  }

  if (config.api.mode === 'real') {
    return new RealAudiApi();
  }

  throw new Error(`Unsupported API mode: ${config.api.mode}. Supported: 'mock', 'real'.`);
}

export { IAudiApi } from './types';
export { MockAudiApi } from './mock-client';
export { RealAudiApi } from './real-client';
export { AuthService } from '../services/auth';
export { AutoPostService } from '../services/auto-post';
export * from './types';
