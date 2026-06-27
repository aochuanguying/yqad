import express from 'express';
import request from 'supertest';
import materialsRoutes from '../src/web/routes/materials-routes';
import { errorHandler } from '../src/web/middleware/error-handler';

jest.mock('../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../src/services/material-processing', () => ({
  processMaterials: jest.fn(async () => ({ scanned: 1, processed: 1, copied: 0, failed: 0, skipped: 0 })),
  getMaterialInfoByProcessedRelativePath: jest.fn((p: string) =>
    p === 'a.jpg'
      ? ({ source: { relativePath: 'raw/a.png', size: 1, mtimeMs: 1 }, output: { relativePath: 'a.jpg', size: 1, format: 'jpeg' }, status: 'processed', processedAt: '2026-01-01T00:00:00.000Z' } as any)
      : null
  ),
}));

jest.mock('../src/services/materials-paths', () => ({
  getMaterialsProcessedPath: jest.fn(() => '/tmp/processed'),
}));

jest.mock('../src/web/services/materials-service', () => ({
  getMaterials: jest.fn(() => []),
  getMaterialDirectories: jest.fn(() => []),
  refreshMaterials: jest.fn(() => []),
  getMaterialFilePath: jest.fn(() => null),
  listMaterialFiles: jest.fn(() => []),
  browseMaterials: jest.fn(() => ({ entries: [], currentPath: '' })),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/materials', materialsRoutes);
  app.use(errorHandler);
  return app;
}

describe('素材 API 路由', () => {
  it('POST /api/materials/process 应返回执行摘要', async () => {
    const app = createApp();
    const res = await request(app).post('/api/materials/process');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toMatchObject({ scanned: 1, processed: 1, copied: 0, failed: 0, skipped: 0 });
  });

  it('GET /api/materials/info/:path 应返回梳理信息', async () => {
    const app = createApp();
    const res = await request(app).get('/api/materials/info/a.jpg');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'processed');
    expect(res.body).toHaveProperty('output.relativePath', 'a.jpg');
  });

  it('GET /api/materials/info/:path 不存在应返回 404', async () => {
    const app = createApp();
    const res = await request(app).get('/api/materials/info/not-exist.jpg');
    expect(res.status).toBe(404);
  });

  it('GET /api/materials/info/:path 应拒绝路径穿越', async () => {
    const app = createApp();
    const res = await request(app).get('/api/materials/info/%2e%2e%2fsecret.txt');
    expect(res.status).toBe(400);
  });

  it('GET /api/materials/info/:path 应拒绝访问 .materials', async () => {
    const app = createApp();
    const res = await request(app).get('/api/materials/info/.materials/manifest.json');
    expect(res.status).toBe(400);
  });
});

