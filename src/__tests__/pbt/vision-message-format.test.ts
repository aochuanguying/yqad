/**
 * Property-Based Test: Vision 消息格式构造正确性
 * 
 * Feature: ai-provider-vision-support, Property 2: Vision 消息格式构造正确性
 * 
 * 对任意合法 base64 图片数组（长度 1-5），buildUserMessage 构造的 message 应满足：
 * - content 数组长度 = 1 (text) + images.length (image_url)
 * - 每个 image_url 元素的 url 以 `data:image/jpeg;base64,` 开头
 * - 每个 image_url 元素的 detail 为 `auto`
 * - 第一个元素 type 为 `text`
 * 
 * **Validates: Requirements 2.2**
 */

// Mock logger to avoid filesystem dependency
jest.mock('../../utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock config to avoid filesystem dependency
jest.mock('../../utils/config', () => ({
  loadConfig: () => ({ ai: { providers: [] } }),
}));

import * as fc from 'fast-check';
import { buildUserMessage } from '../../ai/client';

describe('Property 2: Vision 消息格式构造正确性', () => {
  // Feature: ai-provider-vision-support, Property 2: Vision 消息格式构造正确性

  const validBase64Array = fc.array(
    fc.base64String({ minLength: 1 }),
    { minLength: 1, maxLength: 5 }
  );

  it('content 数组长度 = 1 (text) + images.length', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        validBase64Array,
        (text, images) => {
          const result = buildUserMessage(text, images);
          expect(result.content).toHaveLength(1 + images.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('每个 image_url 元素的 url 以 data:image/jpeg;base64, 开头', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        validBase64Array,
        (text, images) => {
          const result = buildUserMessage(text, images);
          // 跳过第一个 text 元素，检查后续所有 image_url 元素
          for (let i = 1; i < result.content.length; i++) {
            expect(result.content[i].image_url.url).toMatch(
              /^data:image\/jpeg;base64,/
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('每个 image_url 元素的 detail 为 auto', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        validBase64Array,
        (text, images) => {
          const result = buildUserMessage(text, images);
          for (let i = 1; i < result.content.length; i++) {
            expect(result.content[i].image_url.detail).toBe('auto');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('第一个元素 type 为 text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        validBase64Array,
        (text, images) => {
          const result = buildUserMessage(text, images);
          expect(result.content[0].type).toBe('text');
        }
      ),
      { numRuns: 100 }
    );
  });
});
