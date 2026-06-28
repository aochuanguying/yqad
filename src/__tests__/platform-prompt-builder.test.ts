/**
 * 任务 7.2: 提示词构建器单元测试
 * 
 * 测试覆盖：
 * - 小红书风格提示词构建（emoji、情绪化、简短）
 * - 知乎风格提示词构建（专业术语、数据分析）
 * - 汽车之家风格提示词构建（真实车主、配置价格）
 * - 提示词风格选择逻辑
 */

import {
  IPromptBuilder,
  XiaohongshuPromptBuilder,
  ZhihuPromptBuilder,
  AutohomePromptBuilder,
  selectPromptBuilder,
} from '../ai/content-generator';
import { InternetReference } from '../types/posting-optimization';

describe('XiaohongshuPromptBuilder', () => {
  let builder: IPromptBuilder;

  beforeEach(() => {
    builder = new XiaohongshuPromptBuilder();
  });

  test('应该生成包含 emoji 和情绪化表达的提示词', () => {
    const topic = '奥迪 Q5L 使用体验';
    
    const result = builder.build(topic);
    
    expect(result.systemPrompt).toBeDefined();
    expect(result.userPrompt).toBeDefined();
    
    // 小红书风格应该包含 emoji 相关说明
    expect(result.systemPrompt).toMatch(/(emoji|表情符号)/i);
    
    // 应该包含情绪化表达要求
    expect(result.systemPrompt).toMatch(/(情绪 | 情感 | 口语化)/);
    
    // 应该包含字数限制（100-500 字）
    expect(result.systemPrompt).toMatch(/100.*500|500.*100/);
  });

  test('应该支持参考素材', () => {
    const topic = '奥迪 Q5L 使用体验';
    const references: InternetReference[] = [
      {
        title: '奥迪 Q5L 真实用车感受',
        content: '动力强劲，油耗适中',
        source: '小红书',
      },
    ];
    
    const result = builder.build(topic, references);
    
    expect(result.userPrompt).toContain(topic);
    // 应该引用参考素材
    expect(result.userPrompt.length).toBeGreaterThan(0);
  });
});

describe('ZhihuPromptBuilder', () => {
  let builder: IPromptBuilder;

  beforeEach(() => {
    builder = new ZhihuPromptBuilder();
  });

  test('应该生成包含专业术语和逻辑结构的提示词', () => {
    const topic = '奥迪 Q5L 与宝马 X3 对比';
    
    const result = builder.build(topic);
    
    expect(result.systemPrompt).toBeDefined();
    expect(result.userPrompt).toBeDefined();
    
    // 知乎风格应该包含专业术语要求
    expect(result.systemPrompt).toContain('专业');
    expect(result.systemPrompt).toContain('数据');
    
    // 应该包含逻辑结构要求
    expect(result.systemPrompt).toContain('逻辑');
    expect(result.systemPrompt).toContain('结构');
    
    // 应该包含字数要求（800-2000 字）
    expect(result.systemPrompt).toMatch(/800.*2000|2000.*800/);
  });

  test('应该支持数据对比和评测框架', () => {
    const topic = '奥迪 Q5L 评测';
    
    const result = builder.build(topic);
    
    expect(result.systemPrompt).toContain('对比');
    expect(result.systemPrompt).toContain('参数');
  });
});

describe('AutohomePromptBuilder', () => {
  let builder: IPromptBuilder;

  beforeEach(() => {
    builder = new AutohomePromptBuilder();
  });

  test('应该生成包含真实车主视角的提示词', () => {
    const topic = '奥迪 Q5L 提车作业';
    
    const result = builder.build(topic);
    
    expect(result.systemPrompt).toBeDefined();
    expect(result.userPrompt).toBeDefined();
    
    // 汽车之家风格应该包含真实车主要求
    expect(result.systemPrompt).toContain('真实车主');
    expect(result.systemPrompt).toContain('用车体验');
    
    // 应该包含配置和价格信息要求
    expect(result.systemPrompt).toContain('配置');
    expect(result.systemPrompt).toContain('价格');
    
    // 应该包含字数要求（500-1500 字）
    expect(result.systemPrompt).toMatch(/500.*1500|1500.*500/);
  });

  test('应该支持实用建议和改装分享', () => {
    const topic = '奥迪 Q5L 改装心得';
    
    const result = builder.build(topic);
    
    expect(result.systemPrompt).toContain('实用建议');
    expect(result.systemPrompt).toContain('改装');
  });
});

describe('selectPromptBuilder', () => {
  test('参考素材以小红书为主时应该选择小红书构建器', () => {
    const references: InternetReference[] = [
      { title: '笔记 1', content: '内容 1', source: '小红书' },
      { title: '笔记 2', content: '内容 2', source: '小红书' },
      { title: '回答 1', content: '内容 3', source: '知乎' },
    ];
    
    const builder = selectPromptBuilder(references);
    
    expect(builder).toBeInstanceOf(XiaohongshuPromptBuilder);
  });

  test('参考素材以知乎为主时应该选择知乎构建器', () => {
    const references: InternetReference[] = [
      { title: '回答 1', content: '内容 1', source: '知乎' },
      { title: '回答 2', content: '内容 2', source: '知乎' },
      { title: '回答 3', content: '内容 3', source: '知乎' },
      { title: '笔记 1', content: '内容 4', source: '小红书' },
    ];
    
    const builder = selectPromptBuilder(references);
    
    expect(builder).toBeInstanceOf(ZhihuPromptBuilder);
  });

  test('参考素材以汽车之家为主时应该选择汽车之家构建器', () => {
    const references: InternetReference[] = [
      { title: '帖子 1', content: '内容 1', source: '汽车之家' },
      { title: '帖子 2', content: '内容 2', source: '汽车之家' },
      { title: '笔记 1', content: '内容 3', source: '小红书' },
    ];
    
    const builder = selectPromptBuilder(references);
    
    expect(builder).toBeInstanceOf(AutohomePromptBuilder);
  });

  test('没有参考素材时应该默认使用小红书构建器', () => {
    const builder = selectPromptBuilder();
    
    expect(builder).toBeInstanceOf(XiaohongshuPromptBuilder);
  });

  test('三个平台素材相同时应该使用小红书构建器（默认）', () => {
    const references: InternetReference[] = [
      { title: '笔记 1', content: '内容 1', source: '小红书' },
      { title: '回答 1', content: '内容 2', source: '知乎' },
      { title: '帖子 1', content: '内容 3', source: '汽车之家' },
    ];
    
    const builder = selectPromptBuilder(references);
    
    expect(builder).toBeInstanceOf(XiaohongshuPromptBuilder);
  });
});
