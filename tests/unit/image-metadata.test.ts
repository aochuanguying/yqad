import * as fs from 'fs';
import * as path from 'path';
import { generateImageMetadata, generateBatchImageMetadata } from '../../src/utils/image-metadata';
import { loadConfig } from '../../src/utils/config';

// Mock dependencies
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    statSync: jest.fn(),
    copyFileSync: jest.fn(),
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
  };
});
jest.mock('../../src/utils/config');
jest.mock('../../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('图片元数据服务', () => {
  const mockConfig = {
    materials: {
      processedPath: '/mock/materials/processed',
    },
    web: {
      port: 3000,
      baseUrl: 'http://localhost:3000',
    },
  };

  beforeEach(() => {
    (loadConfig as jest.Mock).mockReturnValue(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('generateImageMetadata', () => {
    it('应该生成图片元数据（相对路径）', () => {
      const mockImagePath = 'topic1/image1.jpg';
      const absolutePath = path.join(mockConfig.materials.processedPath, mockImagePath);

      // Mock fs.statSync
      const mockStat = {
        size: 245678,
        isFile: () => true,
      } as fs.Stats;
      (fs.statSync as unknown as jest.Mock).mockReturnValue(mockStat);

      const result = generateImageMetadata(mockImagePath);

      expect(result).toEqual({
        url: 'http://localhost:3000/images/topic1/image1.jpg',
        relativePath: 'topic1/image1.jpg',
        filename: 'image1.jpg',
        size: 245678,
      });
    });

    it('应该生成图片元数据（绝对路径）', () => {
      const absolutePath = '/mock/materials/processed/topic1/image1.jpg';
      
      const mockStat = {
        size: 198765,
        isFile: () => true,
      } as fs.Stats;
      (fs.statSync as unknown as jest.Mock).mockReturnValue(mockStat);

      const result = generateImageMetadata(absolutePath);

      expect(result.relativePath).toBe('topic1/image1.jpg');
      expect(result.url).toBe('http://localhost:3000/images/topic1/image1.jpg');
      expect(result.filename).toBe('image1.jpg');
      expect(result.size).toBe(198765);
    });

    it('应该使用自定义 baseUrl', () => {
      const customBaseUrl = 'http://192.168.1.100:3000';
      (loadConfig as jest.Mock).mockReturnValue({
        ...mockConfig,
        web: {
          ...mockConfig.web,
          baseUrl: customBaseUrl,
        },
      });

      const result = generateImageMetadata('test.jpg');

      expect(result.url).toBe(`${customBaseUrl}/images/test.jpg`);
    });

    it('应该在文件不存在时不抛出错误', () => {
      (fs.statSync as unknown as jest.Mock).mockImplementation(() => {
        throw new Error('文件不存在');
      });

      const result = generateImageMetadata('nonexistent.jpg');

      expect(result.url).toBeDefined();
      expect(result.relativePath).toBe('nonexistent.jpg');
      expect(result.filename).toBe('nonexistent.jpg');
      expect(result.size).toBeUndefined();
    });

    it('应该标准化路径分隔符', () => {
      const windowsPath = 'topic1\\image1.jpg';
      
      const mockStat = {
        size: 100,
        isFile: () => true,
      } as fs.Stats;
      (fs.statSync as unknown as jest.Mock).mockReturnValue(mockStat);

      const result = generateImageMetadata(windowsPath);

      expect(result.relativePath).toBe('topic1/image1.jpg');
    });
  });

  describe('generateBatchImageMetadata', () => {
    it('应该批量生成图片元数据', () => {
      const imagePaths = [
        'topic1/image1.jpg',
        'topic1/image2.jpg',
        'topic2/image3.jpg',
      ];

      const mockStat = {
        size: 1000,
        isFile: () => true,
      } as fs.Stats;
      (fs.statSync as unknown as jest.Mock).mockReturnValue(mockStat);

      const results = generateBatchImageMetadata(imagePaths);

      expect(results).toHaveLength(3);
      expect(results[0].filename).toBe('image1.jpg');
      expect(results[1].filename).toBe('image2.jpg');
      expect(results[2].filename).toBe('image3.jpg');
    });

    it('应该处理空数组', () => {
      const results = generateBatchImageMetadata([]);
      expect(results).toHaveLength(0);
    });
  });
});
