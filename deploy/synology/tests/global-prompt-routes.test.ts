import express from 'express';
import request from 'supertest';

// Mock the global-prompt-service
jest.mock('../src/services/global-prompt-service');

import { load, save, validate } from '../src/services/global-prompt-service';
import globalPromptRoutes from '../src/web/routes/global-prompt-routes';

const mockedLoad = load as jest.MockedFunction<typeof load>;
const mockedSave = save as jest.MockedFunction<typeof save>;
const mockedValidate = validate as jest.MockedFunction<typeof validate>;

describe('Global Prompt API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', globalPromptRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/global-prompt', () => {
    it('returns the config when it exists', async () => {
      const mockConfig = {
        personalInfo: { carModel: '奥迪A6L', gender: '男', ageGroup: '30-40岁' },
        styleDescription: '资深车主风格',
      };
      mockedLoad.mockReturnValue(mockConfig);

      const response = await request(app).get('/api/global-prompt');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockConfig);
    });

    it('returns null when config does not exist', async () => {
      mockedLoad.mockReturnValue(null);

      const response = await request(app).get('/api/global-prompt');

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });
  });

  describe('PUT /api/global-prompt', () => {
    const validPayload = {
      personalInfo: { carModel: '奥迪A6L', gender: '男', ageGroup: '30-40岁' },
      styleDescription: '亲切随和的分享风格',
    };

    it('returns 200 with success message when save succeeds', async () => {
      mockedValidate.mockReturnValue({ valid: true, errors: [] });
      mockedSave.mockReturnValue({ success: true });

      const response = await request(app)
        .put('/api/global-prompt')
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: '保存成功' });
    });

    it('returns 400 when styleDescription exceeds 500 characters', async () => {
      const invalidPayload = {
        personalInfo: { carModel: '奥迪A6L', gender: '男', ageGroup: '30-40岁' },
        styleDescription: 'a'.repeat(501),
      };
      mockedValidate.mockReturnValue({
        valid: false,
        errors: ['内容风格描述不能超过500个字符'],
      });

      const response = await request(app)
        .put('/api/global-prompt')
        .send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('内容风格描述不能超过500个字符');
    });

    it('returns 400 when request body is not a JSON object', async () => {
      const response = await request(app)
        .put('/api/global-prompt')
        .send('not json')
        .set('Content-Type', 'text/plain');

      expect(response.status).toBe(400);
    });

    it('returns 500 when save fails due to file system error', async () => {
      mockedValidate.mockReturnValue({ valid: true, errors: [] });
      mockedSave.mockReturnValue({ success: false, error: '权限不足' });

      const response = await request(app)
        .put('/api/global-prompt')
        .send(validPayload);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('权限不足');
    });
  });
});
