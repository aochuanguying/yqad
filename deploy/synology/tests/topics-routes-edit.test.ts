import express from 'express';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';

const TOPICS_PATH = path.resolve(process.cwd(), 'data/topics.json');

// Mock the topics-service
jest.mock('../src/web/services/topics-service');

import { createTopic, updateTopic, getAllTopics } from '../src/web/services/topics-service';
import topicsRoutes from '../src/web/routes/topics-routes';

const mockedCreateTopic = createTopic as jest.MockedFunction<typeof createTopic>;
const mockedUpdateTopic = updateTopic as jest.MockedFunction<typeof updateTopic>;
const mockedGetAllTopics = getAllTopics as jest.MockedFunction<typeof getAllTopics>;

let app: express.Application;

beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use('/api/topics', topicsRoutes);
  jest.clearAllMocks();
});

describe('PUT /api/topics/:id - 编辑主题', () => {
  const topicId = 'test-topic-id';

  beforeEach(() => {
    // Mock createTopic for POST requests
    mockedCreateTopic.mockImplementation((data) => ({
      id: topicId,
      title: data.title,
      direction: data.direction,
      outline: data.outline || '',
      materialPaths: data.materialPaths || [],
      status: 'unused',
      createdAt: new Date().toISOString(),
      useCount: 0,
      maxUseCount: data.maxUseCount ?? 1,
      postHistory: [],
    }));
  });

  it('应支持更新主题的基本字段', async () => {
    const mockTopic = {
      id: topicId,
      title: '新标题',
      direction: '新方向',
      outline: '新提纲',
      materialPaths: ['old/path.jpg'],
      status: 'unused' as const,
      createdAt: new Date().toISOString(),
      useCount: 0,
      maxUseCount: 2,
      postHistory: [],
    };
    mockedUpdateTopic.mockReturnValue(mockTopic);

    const resp = await request(app)
      .put(`/api/topics/${topicId}`)
      .send({
        title: '新标题',
        direction: '新方向',
        outline: '新提纲',
      });

    expect(resp.status).toBe(200);
    expect(resp.body.title).toBe('新标题');
    expect(resp.body.direction).toBe('新方向');
    expect(resp.body.outline).toBe('新提纲');
    expect(resp.body.id).toBe(topicId);
  });

  it('应支持更新 maxUseCount', async () => {
    const mockTopic = {
      id: topicId,
      title: '标题',
      direction: '方向',
      outline: '',
      materialPaths: [],
      status: 'unused' as const,
      createdAt: new Date().toISOString(),
      useCount: 0,
      maxUseCount: 5,
      postHistory: [],
    };
    mockedUpdateTopic.mockReturnValue(mockTopic);

    const resp = await request(app)
      .put(`/api/topics/${topicId}`)
      .send({
        title: '标题',
        direction: '方向',
        maxUseCount: 5,
      });

    expect(resp.status).toBe(200);
    expect(resp.body.maxUseCount).toBe(5);
  });

  it('应支持更新 materialPaths', async () => {
    const mockTopic = {
      id: topicId,
      title: '标题',
      direction: '方向',
      outline: '',
      materialPaths: ['new/path1.jpg', 'new/path2.jpg'],
      status: 'unused' as const,
      createdAt: new Date().toISOString(),
      useCount: 0,
      maxUseCount: 1,
      postHistory: [],
    };
    mockedUpdateTopic.mockReturnValue(mockTopic);

    const resp = await request(app)
      .put(`/api/topics/${topicId}`)
      .send({
        title: '标题',
        direction: '方向',
        materialPaths: ['new/path1.jpg', 'new/path2.jpg'],
      });

    expect(resp.status).toBe(200);
    expect(resp.body.materialPaths).toEqual(['new/path1.jpg', 'new/path2.jpg']);
  });

  it('应支持同时更新所有字段', async () => {
    const mockTopic = {
      id: topicId,
      title: '全新标题',
      direction: '全新方向',
      outline: '全新提纲',
      materialPaths: ['new1.jpg', 'new2.jpg'],
      status: 'unused' as const,
      createdAt: new Date().toISOString(),
      useCount: 0,
      maxUseCount: 10,
      postHistory: [],
    };
    mockedUpdateTopic.mockReturnValue(mockTopic);

    const resp = await request(app)
      .put(`/api/topics/${topicId}`)
      .send({
        title: '全新标题',
        direction: '全新方向',
        outline: '全新提纲',
        materialPaths: ['new1.jpg', 'new2.jpg'],
        maxUseCount: 10,
      });

    expect(resp.status).toBe(200);
    expect(resp.body.title).toBe('全新标题');
    expect(resp.body.direction).toBe('全新方向');
    expect(resp.body.outline).toBe('全新提纲');
    expect(resp.body.materialPaths).toEqual(['new1.jpg', 'new2.jpg']);
    expect(resp.body.maxUseCount).toBe(10);
  });

  it('应支持部分更新（保持其他字段不变）', async () => {
    const mockTopic1 = {
      id: topicId,
      title: '标题',
      direction: '方向',
      outline: '',
      materialPaths: [],
      status: 'unused' as const,
      createdAt: new Date().toISOString(),
      useCount: 0,
      maxUseCount: 3,
      postHistory: [],
    };
    const mockTopic2 = {
      ...mockTopic1,
      outline: '新提纲',
    };
    
    mockedUpdateTopic.mockReturnValueOnce(mockTopic1).mockReturnValueOnce(mockTopic2);

    // 先更新 maxUseCount
    await request(app)
      .put(`/api/topics/${topicId}`)
      .send({
        title: '标题',
        direction: '方向',
        maxUseCount: 3,
      });

    // 再只更新 outline
    const resp = await request(app)
      .put(`/api/topics/${topicId}`)
      .send({
        title: '标题',
        direction: '方向',
        outline: '新提纲',
      });

    expect(resp.status).toBe(200);
    expect(resp.body.outline).toBe('新提纲');
    expect(resp.body.maxUseCount).toBe(3); // 应保持不变
  });

  it('更新不存在的主题应返回 404', async () => {
    mockedUpdateTopic.mockReturnValue(null);

    const resp = await request(app)
      .put('/api/topics/nonexistent-id')
      .send({
        title: '新标题',
        direction: '方向',
      });

    expect(resp.status).toBe(404);
    expect(resp.body.error).toContain('不存在');
  });

  // 注意：当前后端没有对空字符串进行验证，只检查字段是否存在
  // 如果需要验证，可以在 routes 中添加验证逻辑
  it('标题为空字符串时会更新（当前无验证）', async () => {
    const mockTopic = {
      id: topicId,
      title: '',
      direction: '方向',
      outline: '',
      materialPaths: [],
      status: 'unused' as const,
      createdAt: new Date().toISOString(),
      useCount: 0,
      maxUseCount: 1,
      postHistory: [],
    };
    mockedUpdateTopic.mockReturnValue(mockTopic);

    const resp = await request(app)
      .put(`/api/topics/${topicId}`)
      .send({
        title: '',
        direction: '方向',
      });

    expect(resp.status).toBe(200);
  });
});
