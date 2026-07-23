// Feature: ai-provider-vision-support, Property 3: 非法 base64 输入校验
/**
 * 属性测试：对任意包含非 base64 合法字符的字符串数组，
 * validateBase64Images 应抛出错误，且错误信息包含第一个非法元素的索引值。
 *
 * **Validates: Requirements 2.4**
 */

// Mock logger
jest.mock('../../utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock config
jest.mock('../../utils/config', () => ({
  loadConfig: () => ({ ai: { providers: [] } }),
}));

import * as fc from 'fast-check';
import { validateBase64Images } from '../../ai/client';

describe('Property 3: 非法 base64 输入校验', () => {
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

  /**
   * 生成一个非法 base64 字符串的 Arbitrary
   * 使用 unicodeString 并过滤掉合法 base64 字符串
   */
  const invalidBase64Arb = fc.unicodeString({ minLength: 1 }).filter(
    (s) => !base64Regex.test(s)
  );

  /**
   * 生成合法 base64 字符串的 Arbitrary
   */
  const validBase64Arb = fc.stringOf(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('')),
    { minLength: 0, maxLength: 50 }
  ).map((s) => {
    // 确保 padding 合法：长度 % 4 余数补 =
    const remainder = s.length % 4;
    if (remainder === 1) return s.slice(0, -1); // 去掉末尾使之合法
    if (remainder === 2) return s + '==';
    if (remainder === 3) return s + '=';
    return s;
  });

  /**
   * 生成一个数组（长度 1-5），其中至少有一个非法 base64 字符串。
   * 策略：先确定第一个非法元素的位置，在该位置放置非法字符串，
   * 其余位置（在非法元素之前）放置合法字符串。
   */
  const invalidArrayArb = fc.integer({ min: 1, max: 5 }).chain((len) =>
    fc.integer({ min: 0, max: len - 1 }).chain((invalidIdx) =>
      fc.tuple(
        // invalidIdx 之前的元素全部合法
        fc.array(validBase64Arb, { minLength: invalidIdx, maxLength: invalidIdx }),
        // 第一个非法元素
        invalidBase64Arb,
        // 之后的元素随机（合法或非法均可）
        fc.array(
          fc.oneof(validBase64Arb, invalidBase64Arb),
          { minLength: len - invalidIdx - 1, maxLength: len - invalidIdx - 1 }
        )
      ).map(([before, invalid, after]) => ({
        images: [...before, invalid, ...after],
        expectedInvalidIdx: invalidIdx,
      }))
    )
  );

  it('对任意含非法 base64 字符串的数组，validateBase64Images 应抛出错误且错误信息包含第一个非法元素的索引', () => {
    fc.assert(
      fc.property(invalidArrayArb, ({ images, expectedInvalidIdx }) => {
        // 验证 validateBase64Images 抛出 Error
        expect(() => validateBase64Images(images)).toThrow(Error);

        // 验证错误信息包含第一个非法元素的索引 `images[N]`
        try {
          validateBase64Images(images);
        } catch (e: any) {
          expect(e.message).toContain(`images[${expectedInvalidIdx}]`);
        }
      }),
      { numRuns: 100 }
    );
  });
});
