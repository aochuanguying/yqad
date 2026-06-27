import express from 'express';
import request from 'supertest';

// Mock the topics-service
jest.mock('../src/web/services/topics-service');

import { updateTopic } from '../src/web/services/topics-service';
import topicsRoutes from '../src/web/routes/topics-routes';

const mockedUpdateTopic = updateTopic as jest.MockedFunction<typeof updateTopic>;

describe('PATCH /api/topics/:id/max-use-count', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/topics', topicsRoutes);
    jest.clearAllMocks();
  });

  it('returns 200 with updated topic when maxUseCount is valid', async () => {
    const mockTopic = {
      id: 'abc123',
      title: '测试主题',
      direction: '方向',
      outline: '',
      materialPaths: [],
      status: 'unused' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      useCount: 0,
      maxUseCount: 5,
      postHistory: [],
    };
    mockedUpdateTopic.mockReturnValue(mockTopic);

    const response = await request(app)
      .patch('/api/topics/abc123/max-use-count')
      .send({ maxUseCount: 5 });

    expect(response.status).toBe(200);
    expect(response.body.maxUseCount).toBe(5);
    expect(mockedUpdateTopic).toHaveBeenCalledWith('abc123', { maxUseCount: 5 });
  });

  it('returns 400 when maxUseCount is missing', async () => {
    const response = await request(app)
      .patch('/api/topics/abc123/max-use-count')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('maxUseCount');
  });

  it('returns 400 when maxUseCount is less than 1', async () => {
    const response = await request(app)
      .patch('/api/topics/abc123/max-use-count')
      .send({ maxUseCount: 0 });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('maxUseCount');
  });

  it('returns 400 when maxUseCount is greater than 100', async () => {
    const response = await request(app)
      .patch('/api/topics/abc123/max-use-count')
      .send({ maxUseCount: 101 });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('maxUseCount');
  });

  it('returns 400 when maxUseCount is not an integer', async () => {
    const response = await request(app)
      .patch('/api/topics/abc123/max-use-count')
      .send({ maxUseCount: 3.5 });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('maxUseCount');
  });

  it('returns 400 when maxUseCount is a string', async () => {
    const response = await request(app)
      .patch('/api/topics/abc123/max-use-count')
      .send({ maxUseCount: '5' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('maxUseCount');
  });

  it('returns 404 when topic does not exist', async () => {
    mockedUpdateTopic.mockReturnValue(null);

    const response = await request(app)
      .patch('/api/topics/nonexistent/max-use-count')
      .send({ maxUseCount: 3 });

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('nonexistent');
  });

  it('accepts boundary value maxUseCount = 1', async () => {
    const mockTopic = {
      id: 'abc123',
      title: '测试主题',
      direction: '方向',
      outline: '',
      materialPaths: [],
      status: 'unused' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      useCount: 0,
      maxUseCount: 1,
      postHistory: [],
    };
    mockedUpdateTopic.mockReturnValue(mockTopic);

    const response = await request(app)
      .patch('/api/topics/abc123/max-use-count')
      .send({ maxUseCount: 1 });

    expect(response.status).toBe(200);
  });

  it('accepts boundary value maxUseCount = 100', async () => {
    const mockTopic = {
      id: 'abc123',
      title: '测试主题',
      direction: '方向',
      outline: '',
      materialPaths: [],
      status: 'unused' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      useCount: 0,
      maxUseCount: 100,
      postHistory: [],
    };
    mockedUpdateTopic.mockReturnValue(mockTopic);

    const response = await request(app)
      .patch('/api/topics/abc123/max-use-count')
      .send({ maxUseCount: 100 });

    expect(response.status).toBe(200);
  });
});
