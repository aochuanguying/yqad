import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { createWebApp } from '../../src/web/server';
import { loadConfig } from '../../src/utils/config';

jest.mock('../../src/utils/config');
jest.mock('../../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('/images 静态访问', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yqad-images-test-'));
  const processedPath = path.join(tmpRoot, 'processed');

  beforeAll(() => {
    fs.mkdirSync(processedPath, { recursive: true });
    fs.writeFileSync(path.join(processedPath, 'a.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    fs.writeFileSync(path.join(processedPath, 'a.txt'), 'not an image');
  });

  beforeEach(() => {
    (loadConfig as jest.Mock).mockReturnValue({
      web: {
        enabled: true,
        port: 3000,
        baseUrl: 'http://localhost:3000',
      },
      materials: {
        processedPath,
      },
      logging: {
        level: 'info',
        dir: './logs',
        retainDays: 7,
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('应允许访问 jpg 文件', async () => {
    const app = createWebApp({ includeApiRoutes: false });
    const res = await request(app).get('/images/a.jpg').expect(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
  });

  it('应拒绝访问非图片文件', async () => {
    const app = createWebApp({ includeApiRoutes: false });
    await request(app).get('/images/a.txt').expect(403);
  });

  it('应拒绝越界路径访问', async () => {
    const app = createWebApp({ includeApiRoutes: false });
    await request(app)
      .get('/images/..%2Fconfig%2Fdefault.yaml')
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });
  });
});
