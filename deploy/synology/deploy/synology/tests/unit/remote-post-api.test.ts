import request from 'supertest';
import express from 'express';
import postsRoutes from '../../src/web/routes/posts-routes';
import { AutoPostService } from '../../src/services/auto-post';
import { RealAudiApi } from '../../src/api/real-client';
import { AuthService } from '../../src/services/auth';

// Mock dependencies
jest.mock('../../src/services/auto-post');
jest.mock('../../src/api/real-client');
jest.mock('../../src/services/auth');

describe('远程发帖 API', () => {
  let app: express.Express;
  let mockPostService: jest.Mocked<AutoPostService>;

  const mockToken = 'mock-token-12345';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/posts', postsRoutes);

    // 设置 mock
    mockPostService = {
      generatePostContent: jest.fn(),
      performDailyPosts: jest.fn(),
    } as any;

    (AutoPostService as jest.Mock).mockImplementation(() => mockPostService);
    (RealAudiApi as jest.Mock).mockImplementation(() => ({}));
    (AuthService as jest.Mock).mockImplementation(() => ({}));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/posts/generate', () => {
    it('应该成功生成发帖内容', async () => {
      const mockResponse = {
        success: true,
        data: {
          title: '测试标题',
          content: '测试内容',
          images: [
            {
              url: 'http://localhost:3000/images/test.jpg',
              relativePath: 'test.jpg',
              filename: 'test.jpg',
              size: 12345,
            },
          ],
          mode: 'featured' as const,
          metadata: {
            generatedAt: new Date().toISOString(),
          },
        },
      };

      (mockPostService.generatePostContent as jest.Mock).mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/posts/generate')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          useTopic: true,
          mode: 'featured',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('测试标题');
      expect(mockPostService.generatePostContent).toHaveBeenCalledWith({
        useTopic: true,
        mode: 'featured',
      });
    });

    it('应该在没有 Token 时返回 401', async () => {
      const response = await request(app)
        .post('/api/posts/generate')
        .send({})
        .expect(401);

      expect(response.body.error).toContain('Authorization');
    });

    it('应该在生成失败时返回错误', async () => {
      const mockError = {
        success: false,
        error: '标题去重失败',
      };

      (mockPostService.generatePostContent as jest.Mock).mockResolvedValue(mockError);

      const response = await request(app)
        .post('/api/posts/generate')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('标题去重失败');
    });

    it('应该处理内部错误', async () => {
      (mockPostService.generatePostContent as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      const response = await request(app)
        .post('/api/posts/generate')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({})
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('数据库错误');
    });
  });

  describe('POST /api/posts/batch', () => {
    it('应该创建批量任务', async () => {
      const response = await request(app)
        .post('/api/posts/batch')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          count: 2,
          mode: 'featured',
        })
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.taskId).toBeDefined();
      expect(response.body.status).toBe('pending');
      expect(response.body.progress).toEqual({
        total: 2,
        completed: 0,
      });
    });

    it('应该在 count 参数无效时返回 400', async () => {
      const response = await request(app)
        .post('/api/posts/batch')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          count: 0, // 无效值
        })
        .expect(400);

      expect(response.body.error).toContain('count');
    });

    it('应该在 count 超过 5 时返回 400', async () => {
      const response = await request(app)
        .post('/api/posts/batch')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          count: 6, // 超过最大值
        })
        .expect(400);

      expect(response.body.error).toContain('count');
    });

    it('应该在没有 Token 时返回 401', async () => {
      const response = await request(app)
        .post('/api/posts/batch')
        .send({ count: 2 })
        .expect(401);

      expect(response.body.error).toContain('Authorization');
    });
  });

  describe('GET /api/posts/tasks/:id', () => {
    it('应该查询任务状态', async () => {
      // 先创建一个任务
      const createResponse = await request(app)
        .post('/api/posts/batch')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ count: 1 });

      const taskId = createResponse.body.taskId;

      // 查询任务状态
      const response = await request(app)
        .get(`/api/posts/tasks/${taskId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.taskId).toBe(taskId);
      expect(['pending', 'processing', 'completed', 'failed']).toContain(
        response.body.status
      );
    });

    it('应该查询不存在的任务返回 404', async () => {
      const response = await request(app)
        .get('/api/posts/tasks/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('任务不存在');
    });

    it('应该在完成时返回结果', async () => {
      // 这个测试需要等待异步任务完成，实际使用时需要适当等待
      const createResponse = await request(app)
        .post('/api/posts/batch')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ count: 1 });

      const taskId = createResponse.body.taskId;

      // 等待任务完成（实际测试中应该使用更可靠的等待机制）
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await request(app)
        .get(`/api/posts/tasks/${taskId}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('progress');
    });
  });

  describe('鉴权中间件', () => {
    it('应该拒绝无效的 Token 格式', async () => {
      const response = await request(app)
        .post('/api/posts/generate')
        .set('Authorization', 'InvalidFormat')
        .send({})
        .expect(401);

      expect(response.body.error).toContain('Authorization');
    });

    it('应该接受 Bearer Token 格式', async () => {
      (mockPostService.generatePostContent as jest.Mock).mockResolvedValue({
        success: true,
        data: { title: 'test', content: 'test', images: [], mode: 'normal', metadata: { generatedAt: '' } },
      });

      await request(app)
        .post('/api/posts/generate')
        .set('Authorization', `Bearer valid-token`)
        .send({})
        .expect(200);
    });
  });
});
