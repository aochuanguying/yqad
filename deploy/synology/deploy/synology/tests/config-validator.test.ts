import { validateConfigGroup } from '../src/web/services/config-validator';

describe('配置验证器', () => {
  describe('api 分组', () => {
    it('应通过有效配置', () => {
      const result = validateConfigGroup('api', {
        mode: 'mock',
        baseUrl: 'https://example.com',
        timeout: 10000,
      });
      expect(result).toBeNull();
    });

    it('应拒绝无效的 mode', () => {
      const result = validateConfigGroup('api', {
        mode: 'invalid',
        baseUrl: 'https://example.com',
        timeout: 10000,
      });
      expect(result).toContain('mode');
    });

    it('应拒绝超出范围的 timeout', () => {
      const result = validateConfigGroup('api', {
        mode: 'mock',
        baseUrl: 'https://example.com',
        timeout: -1,
      });
      expect(result).toContain('timeout');
    });
  });

  describe('ai 分组', () => {
    it('应通过有效配置', () => {
      const result = validateConfigGroup('ai', {
        apiKey: 'sk-test',
        baseUrl: 'http://localhost:8080/v1',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
      });
      expect(result).toBeNull();
    });

    it('应拒绝超出范围的 temperature', () => {
      const result = validateConfigGroup('ai', {
        apiKey: 'sk-test',
        baseUrl: 'http://localhost:8080/v1',
        model: 'gpt-4',
        temperature: 3.0,
        maxTokens: 1000,
      });
      expect(result).toContain('temperature');
    });
  });

  describe('scheduler 分组', () => {
    const validScheduler = {
      signin: { cron: '0 8 * * *', randomOffsetMin: 0, randomOffsetMax: 60 },
      comment: { cron: '0 10 * * *', randomOffsetMin: 0, randomOffsetMax: 600 },
      post: { cron: '0 12 * * *', randomOffsetMin: 0, randomOffsetMax: 360 },
      materialProcessing: { cron: '0 7 * * *', randomOffsetMin: 0, randomOffsetMax: 30 },
    };

    it('应通过有效配置', () => {
      const result = validateConfigGroup('scheduler', validScheduler);
      expect(result).toBeNull();
    });

    it('应忽略历史 analysis 调度配置', () => {
      const result = validateConfigGroup('scheduler', {
        ...validScheduler,
        analysis: { cron: 'invalid', randomOffsetMin: 100, randomOffsetMax: 0 },
      });
      expect(result).toBeNull();
    });

    it('应拒绝无效的 cron 表达式', () => {
      const result = validateConfigGroup('scheduler', {
        ...validScheduler,
        signin: { cron: 'invalid', randomOffsetMin: 0, randomOffsetMax: 60 },
      });
      expect(result).toContain('cron');
    });

    it('应拒绝 min 大于 max 的偏移', () => {
      const result = validateConfigGroup('scheduler', {
        ...validScheduler,
        signin: { cron: '0 8 * * *', randomOffsetMin: 100, randomOffsetMax: 50 },
      });
      expect(result).toContain('randomOffsetMin');
    });
  });

  describe('materials 分组', () => {
    it('应通过 processedPath + rawPath 配置', () => {
      const result = validateConfigGroup('materials', {
        rawPath: './data/materials/raw',
        processedPath: './data/materials/processed',
        processing: {
          enabled: true,
          outputFormat: 'jpeg',
          jpegQuality: 82,
          enableVision: true,
          maxFilesPerRun: 50,
          heicFallback: {
            enabled: true,
            command: 'heif-convert',
            timeoutMs: 30000,
          },
        },
      });
      expect(result).toBeNull();
    });

    it('应兼容仅 basePath 的旧配置', () => {
      const result = validateConfigGroup('materials', {
        basePath: './data/materials',
      });
      expect(result).toBeNull();
    });

    it('应拒绝缺少 processedPath/basePath 的配置', () => {
      const result = validateConfigGroup('materials', {
        rawPath: './data/materials/raw',
      });
      expect(result).toContain('processedPath');
    });

    it('应拒绝无效的 heicFallback 超时', () => {
      const result = validateConfigGroup('materials', {
        rawPath: './data/materials/raw',
        processedPath: './data/materials/processed',
        processing: {
          enabled: true,
          outputFormat: 'jpeg',
          jpegQuality: 82,
          enableVision: true,
          maxFilesPerRun: 50,
          heicFallback: {
            enabled: true,
            command: 'heif-convert',
            timeoutMs: 100,
          },
        },
      });
      expect(result).toContain('heicFallback.timeoutMs');
    });
  });

  describe('comment 分组', () => {
    it('应通过有效配置', () => {
      const result = validateConfigGroup('comment', {
        enabled: true,
        dailyLimit: 3,
        delayMin: 30,
        delayMax: 120,
      });
      expect(result).toBeNull();
    });

    it('应拒绝 delayMin 大于 delayMax', () => {
      const result = validateConfigGroup('comment', {
        enabled: true,
        dailyLimit: 3,
        delayMin: 200,
        delayMax: 100,
      });
      expect(result).toContain('delayMin');
    });
  });

  describe('contentLimits 分组', () => {
    it('应通过有效配置', () => {
      const result = validateConfigGroup('contentLimits', {
        comment: { min: 20, max: 200 },
        post: { min: 100, max: 800 },
      });
      expect(result).toBeNull();
    });

    it('应拒绝 min 大于 max', () => {
      const result = validateConfigGroup('contentLimits', {
        comment: { min: 300, max: 200 },
        post: { min: 100, max: 800 },
      });
      expect(result).toContain('min');
    });
  });

  describe('featuredPosting 分组', () => {
    it('应通过有效配置', () => {
      const result = validateConfigGroup('featuredPosting', {
        enabled: true,
        minContentChars: 250,
        minImages: 4,
        maxImages: 9,
        maxGenerateRetries: 2,
        maxImageUploadRetries: 2,
      });
      expect(result).toBeNull();
    });

    it('应拒绝无效的 minImages', () => {
      const result = validateConfigGroup('featuredPosting', {
        enabled: true,
        minContentChars: 250,
        minImages: 99,
        maxImages: 9,
        maxGenerateRetries: 2,
        maxImageUploadRetries: 2,
      });
      expect(result).toContain('minImages');
    });
  });

  describe('未知分组', () => {
    it('应返回错误', () => {
      const result = validateConfigGroup('unknown', {});
      expect(result).toContain('未知');
    });
  });
});
