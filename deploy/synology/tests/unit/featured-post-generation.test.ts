const mockGenerateContent = jest.fn();
jest.mock('../../src/ai/client', () => ({
  generateContent: (...args: any[]) => mockGenerateContent(...args),
}));

jest.mock('../../src/utils/config', () => ({
  loadConfig: () => ({
    contentLimits: { post: { min: 100, max: 500 }, comment: { min: 20, max: 200 } },
    featuredPosting: { enabled: true, minContentChars: 250, minImages: 4, maxGenerateRetries: 2, maxImageUploadRetries: 2 },
  }),
}));

jest.mock('../../src/utils/logger', () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { generatePost } from '../../src/ai/content-generator';

describe('featured post generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('featured 模式应在 userPrompt 中包含字数与结构化要求', async () => {
    mockGenerateContent.mockResolvedValue('标题\n\n' + '字'.repeat(260));
    await generatePost(
      '奥迪用车分享',
      ['旧话题'],
      { topics: [], hotPosts: [], analyzedIds: [], styleDescription: '', avgPostLength: 0, exampleTexts: [] } as any,
      undefined,
      { mode: 'featured' }
    );
    const args = mockGenerateContent.mock.calls[0][0];
    expect(args.userPrompt).toContain('正文不少于 250 字');
    expect(args.userPrompt).toContain('排版清晰分层');
  });

  it('normal 模式不应强制包含精华硬性要求', async () => {
    mockGenerateContent.mockResolvedValue('标题\n\n' + '字'.repeat(120));
    await generatePost(
      '奥迪用车分享',
      [],
      { topics: [], hotPosts: [], analyzedIds: [], styleDescription: '', avgPostLength: 0, exampleTexts: [] } as any,
      undefined,
      { mode: 'normal' }
    );
    const args = mockGenerateContent.mock.calls[0][0];
    expect(args.userPrompt).not.toContain('正文不少于 250 字');
  });
});

