/**
 * AI Client Vision 消息构造单元测试
 */

// Mock logger to avoid filesystem dependency
jest.mock('../utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock config to avoid filesystem dependency
jest.mock('../utils/config', () => ({
  loadConfig: () => ({ ai: { providers: [] } }),
}));

import { buildUserMessage, validateBase64Images } from '../ai/client';

describe('validateBase64Images', () => {
  it('应通过合法的 base64 字符串', () => {
    expect(() => validateBase64Images(['SGVsbG8=', 'V29ybGQ='])).not.toThrow();
  });

  it('应通过空字符串（有效的 base64）', () => {
    expect(() => validateBase64Images([''])).not.toThrow();
  });

  it('应通过无 padding 的 base64', () => {
    expect(() => validateBase64Images(['SGVsbG8'])).not.toThrow();
  });

  it('超过 5 张图片时应抛错', () => {
    const images = Array(6).fill('SGVsbG8=');
    expect(() => validateBase64Images(images)).toThrow('images 数组最多包含 5 张图片');
  });

  it('正好 5 张图片时不应抛错', () => {
    const images = Array(5).fill('SGVsbG8=');
    expect(() => validateBase64Images(images)).not.toThrow();
  });

  it('含非法字符时应抛错并指明索引', () => {
    expect(() => validateBase64Images(['SGVsbG8=', '中文字符'])).toThrow('images[1] 包含非法 base64 字符');
  });

  it('第一个元素非法时应指明索引 0', () => {
    expect(() => validateBase64Images(['!!!invalid!!!'])).toThrow('images[0] 包含非法 base64 字符');
  });

  it('含空格的字符串应视为非法', () => {
    expect(() => validateBase64Images(['SGVs bG8='])).toThrow('images[0] 包含非法 base64 字符');
  });
});

describe('buildUserMessage', () => {
  it('无图片时应返回纯文本格式', () => {
    const result = buildUserMessage('hello');
    expect(result).toEqual({ role: 'user', content: 'hello' });
  });

  it('images 为 undefined 时应返回纯文本格式', () => {
    const result = buildUserMessage('hello', undefined);
    expect(result).toEqual({ role: 'user', content: 'hello' });
  });

  it('images 为空数组时应返回纯文本格式', () => {
    const result = buildUserMessage('hello', []);
    expect(result).toEqual({ role: 'user', content: 'hello' });
  });

  it('有图片时应构造 Vision content 数组格式', () => {
    const result = buildUserMessage('describe this', ['SGVsbG8=']);
    expect(result.role).toBe('user');
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content).toHaveLength(2);
    expect(result.content[0]).toEqual({ type: 'text', text: 'describe this' });
    expect(result.content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,SGVsbG8=', detail: 'auto' },
    });
  });

  it('多张图片时 content 数组长度应正确', () => {
    const images = ['SGVsbG8=', 'V29ybGQ=', 'dGVzdA=='];
    const result = buildUserMessage('test', images);
    expect(result.content).toHaveLength(4); // 1 text + 3 image_url
  });

  it('每个 image_url 的 url 应以 data:image/jpeg;base64, 开头', () => {
    const images = ['SGVsbG8=', 'V29ybGQ='];
    const result = buildUserMessage('test', images);
    for (let i = 1; i < result.content.length; i++) {
      expect(result.content[i].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
      expect(result.content[i].image_url.detail).toBe('auto');
    }
  });

  it('含非法 base64 图片时应抛错', () => {
    expect(() => buildUserMessage('test', ['invalid!@#'])).toThrow('包含非法 base64 字符');
  });
});
