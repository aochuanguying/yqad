import * as fs from 'fs';
import * as path from 'path';
import fc from 'fast-check';

// Mock logger before importing service
jest.mock('../../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const GLOBAL_PROMPT_PATH = path.resolve(process.cwd(), 'data/global-prompt.json');

import { load, save, validate } from '../../src/services/global-prompt-service';
import { GlobalPostPrompt } from '../../src/types/posting-optimization';

describe('global-prompt-service', () => {
  beforeEach(() => {
    if (fs.existsSync(GLOBAL_PROMPT_PATH)) {
      fs.unlinkSync(GLOBAL_PROMPT_PATH);
    }
  });

  afterEach(() => {
    if (fs.existsSync(GLOBAL_PROMPT_PATH)) {
      fs.unlinkSync(GLOBAL_PROMPT_PATH);
    }
  });

  describe('load()', () => {
    it('文件不存在时应返回 null', () => {
      const result = load();
      expect(result).toBeNull();
    });

    it('文件内容损坏时应返回 null', () => {
      fs.writeFileSync(GLOBAL_PROMPT_PATH, '{ invalid json !!!', 'utf-8');
      const result = load();
      expect(result).toBeNull();
    });

    it('文件内容有效时应返回配置对象', () => {
      const prompt: GlobalPostPrompt = {
        personalInfo: { carModel: '奥迪A6L', gender: '男', ageGroup: '30-40岁' },
        styleDescription: '理性分享风格',
      };
      fs.writeFileSync(GLOBAL_PROMPT_PATH, JSON.stringify(prompt, null, 2), 'utf-8');

      const result = load();
      expect(result).toEqual(prompt);
    });
  });

  describe('save()', () => {
    it('验证通过时应成功保存文件', () => {
      const prompt: GlobalPostPrompt = {
        personalInfo: { carModel: '奥迪A6L', gender: '男', ageGroup: '30-40岁' },
        styleDescription: '理性分享风格',
      };

      const result = save(prompt);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // 验证文件内容
      const saved = JSON.parse(fs.readFileSync(GLOBAL_PROMPT_PATH, 'utf-8'));
      expect(saved).toEqual(prompt);
    });

    it('验证不通过时应拒绝保存', () => {
      const prompt: GlobalPostPrompt = {
        personalInfo: { carModel: 'a'.repeat(51), gender: '男', ageGroup: '30-40岁' },
        styleDescription: '理性分享风格',
      };

      const result = save(prompt);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(fs.existsSync(GLOBAL_PROMPT_PATH)).toBe(false);
    });
  });

  describe('validate()', () => {
    it('所有字段在限制内时应通过验证', () => {
      const prompt: GlobalPostPrompt = {
        personalInfo: { carModel: '奥迪A6L', gender: '男', ageGroup: '30-40岁' },
        styleDescription: '理性分享风格',
      };

      const result = validate(prompt);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('carModel 超过50字符时应拒绝', () => {
      const prompt: GlobalPostPrompt = {
        personalInfo: { carModel: 'a'.repeat(51), gender: '男', ageGroup: '30-40岁' },
        styleDescription: '理性分享风格',
      };

      const result = validate(prompt);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('gender 超过50字符时应拒绝', () => {
      const prompt: GlobalPostPrompt = {
        personalInfo: { carModel: '奥迪A6L', gender: 'a'.repeat(51), ageGroup: '30-40岁' },
        styleDescription: '理性分享风格',
      };

      const result = validate(prompt);
      expect(result.valid).toBe(false);
    });

    it('ageGroup 超过50字符时应拒绝', () => {
      const prompt: GlobalPostPrompt = {
        personalInfo: { carModel: '奥迪A6L', gender: '男', ageGroup: 'a'.repeat(51) },
        styleDescription: '理性分享风格',
      };

      const result = validate(prompt);
      expect(result.valid).toBe(false);
    });

    it('styleDescription 超过500字符时应拒绝', () => {
      const prompt: GlobalPostPrompt = {
        personalInfo: { carModel: '奥迪A6L', gender: '男', ageGroup: '30-40岁' },
        styleDescription: 'a'.repeat(501),
      };

      const result = validate(prompt);
      expect(result.valid).toBe(false);
    });

    it('多个字段同时超限时应报告所有错误', () => {
      const prompt: GlobalPostPrompt = {
        personalInfo: { carModel: 'a'.repeat(51), gender: 'b'.repeat(51), ageGroup: 'c'.repeat(51) },
        styleDescription: 'd'.repeat(501),
      };

      const result = validate(prompt);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(4);
    });

    // Property 1: 全局人设字段长度验证
    // **Validates: Requirements 1.2, 1.6, 1.7**
    describe('Property 1: 全局人设字段长度验证', () => {
      const PBT_CONFIG = { numRuns: 100 };

      it('personalInfo 各字段 <= 50 字符时应通过验证', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 0, maxLength: 50 }),
            fc.string({ minLength: 0, maxLength: 50 }),
            fc.string({ minLength: 0, maxLength: 50 }),
            fc.string({ minLength: 0, maxLength: 500 }),
            (carModel, gender, ageGroup, styleDescription) => {
              const prompt: GlobalPostPrompt = {
                personalInfo: { carModel, gender, ageGroup },
                styleDescription,
              };
              const result = validate(prompt);
              return result.valid === true && result.errors.length === 0;
            }
          ),
          PBT_CONFIG
        );
      });

      it('personalInfo 任一字段 > 50 字符时应拒绝验证', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 51, maxLength: 100 }),
            fc.string({ minLength: 0, maxLength: 50 }),
            fc.string({ minLength: 0, maxLength: 50 }),
            fc.string({ minLength: 0, maxLength: 500 }),
            (carModel, gender, ageGroup, styleDescription) => {
              const prompt: GlobalPostPrompt = {
                personalInfo: { carModel, gender, ageGroup },
                styleDescription,
              };
              const result = validate(prompt);
              return result.valid === false && result.errors.length > 0;
            }
          ),
          PBT_CONFIG
        );
      });

      it('styleDescription > 500 字符时应拒绝验证', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 0, maxLength: 50 }),
            fc.string({ minLength: 0, maxLength: 50 }),
            fc.string({ minLength: 0, maxLength: 50 }),
            fc.string({ minLength: 501, maxLength: 600 }),
            (carModel, gender, ageGroup, styleDescription) => {
              const prompt: GlobalPostPrompt = {
                personalInfo: { carModel, gender, ageGroup },
                styleDescription,
              };
              const result = validate(prompt);
              return result.valid === false && result.errors.length > 0;
            }
          ),
          PBT_CONFIG
        );
      });
    });
  });
});
