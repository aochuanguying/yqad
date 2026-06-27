import * as path from 'path';

let mockMaterials: any = {};

jest.mock('../../src/utils/config', () => ({
  loadConfig: () =>
    ({
      materials: mockMaterials,
      ai: { providers: [] },
      logging: { level: 'error', dir: './logs', retainDays: 1 },
    }) as any,
}));

import { getMaterialsProcessedPath, getMaterialsRawPath, getMaterialsProcessingConfig } from '../../src/services/materials-paths';

describe('materials-paths', () => {
  beforeEach(() => {
    mockMaterials = { basePath: './data/materials' };
  });

  it('processedPath 优先，其次 basePath', () => {
    mockMaterials = { basePath: './data/materials', processedPath: './data/materials/processed' };
    expect(getMaterialsProcessedPath()).toBe(path.resolve(process.cwd(), './data/materials/processed'));
  });

  it('rawPath 优先，其次 basePath', () => {
    mockMaterials = { basePath: './data/materials', rawPath: './data/materials/raw' };
    expect(getMaterialsRawPath()).toBe(path.resolve(process.cwd(), './data/materials/raw'));
  });

  it('processing 配置应有默认值', () => {
    const p = getMaterialsProcessingConfig();
    expect(p.enabled).toBe(true);
    expect(p.outputFormat).toBe('jpeg');
    expect(p.jpegQuality).toBeGreaterThan(0);
    expect(p.maxFilesPerRun).toBeGreaterThan(0);
  });
});

