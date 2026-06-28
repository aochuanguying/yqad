/**
 * 任务 7.5: 集成测试
 * 
 * 测试整个发帖流程的集成：
 * 1. 搜索词选择 → 2. 平台选择 → 3. 素材选择 → 4. 提示词生成 → 5. 内容生成
 */

import { PlatformAwareKeywordSelector } from '../services/internet-search/search-manager';
import {
  XiaohongshuPromptBuilder,
  ZhihuPromptBuilder,
  AutohomePromptBuilder,
  selectPromptBuilder,
  checkPlatformAdaptability,
} from '../ai/content-generator';
import { InternetReference } from '../types/posting-optimization';

describe('发帖流程集成测试', () => {
  describe('完整发帖流程测试', () => {
    test('小红书平台完整流程', () => {
      // 1. 搜索词选择
      const keywordSelector = new PlatformAwareKeywordSelector();
      const keywords = ['奥迪 Q5L', '奥迪自驾游', '奥迪露营'];
      const selectedKeyword = keywordSelector.select(keywords, 'xiaohongshu');
      
      expect(selectedKeyword).toBeDefined();
      expect(keywords).toContain(selectedKeyword);
      
      // 2. 提示词生成
      const topic = '奥迪 Q5L 自驾游体验';
      const references: InternetReference[] = [
        {
          title: '奥迪 Q5L 自驾游攻略',
          content: '动力强劲，空间宽敞',
          source: '小红书',
        },
      ];
      
      const promptBuilder = selectPromptBuilder(references);
      expect(promptBuilder).toBeInstanceOf(XiaohongshuPromptBuilder);
      
      const prompt = promptBuilder.build(topic, references);
      expect(prompt.systemPrompt).toBeDefined();
      expect(prompt.userPrompt).toBeDefined();
      expect(prompt.userPrompt).toContain(topic);
      
      // 3. 平台适配性检查（模拟生成内容）
      const mockContent = '🚗 奥迪 Q5L 自驾游太棒了！✨\n\n个人情况：提车 3 个月...\n使用场景：周末自驾游...\n优点：动力强劲，空间大...\n小缺点：油耗稍高...\n总结推荐：值得购买！💕\n\n#奥迪 Q5L #自驾游 #用车体验';
      
      const adaptability = checkPlatformAdaptability(mockContent, 'xiaohongshu');
      expect(adaptability).toBeDefined();
      // 小红书内容应该有较高的适配度
      expect(adaptability.score).toBeGreaterThan(50);
    });

    test('知乎平台完整流程', () => {
      // 1. 搜索词选择
      const keywordSelector = new PlatformAwareKeywordSelector();
      const keywords = ['如何评价奥迪 Q5L', '奥迪 Q5L 值得购买吗', '奥迪 Q5L vs 宝马 X3'];
      const selectedKeyword = keywordSelector.select(keywords, 'zhihu');
      
      expect(selectedKeyword).toBeDefined();
      // 知乎应该优先选择专业问句
      expect(selectedKeyword).toMatch(/(如何 | 评价 | 值得 | vs)/);
      
      // 2. 提示词生成
      const topic = '奥迪 Q5L 与宝马 X3 全面对比';
      const references: InternetReference[] = [
        {
          title: '奥迪 Q5L vs 宝马 X3 专业评测',
          content: '从动力、操控、配置等方面对比',
          source: '知乎',
        },
      ];
      
      const promptBuilder = selectPromptBuilder(references);
      expect(promptBuilder).toBeInstanceOf(ZhihuPromptBuilder);
      
      const prompt = promptBuilder.build(topic, references);
      expect(prompt.systemPrompt).toBeDefined();
      expect(prompt.systemPrompt).toMatch(/(专业 | 术语 | 数据 | 分析)/);
      
      // 3. 平台适配性检查（模拟生成内容）
      const mockContent = `# 奥迪 Q5L 与宝马 X3 全面对比分析

## 一、动力参数对比
- 奥迪 Q5L: 2.0T 高功率，最大功率 183kW
- 宝马 X3: 2.0T 高功率，最大功率 185kW

## 二、配置差��
1. 四驱系统：quattro vs xDrive
2. 变速箱：7 速双离合 vs 8AT

## 三、结论
从数据来看，两款车各有优势...`;

      const adaptability = checkPlatformAdaptability(mockContent, 'zhihu');
      expect(adaptability).toBeDefined();
      // 知乎内容应该有较高的适配度
      expect(adaptability.score).toBeGreaterThan(50);
    });

    test('汽车之家平台完整流程', () => {
      // 1. 搜索词选择
      const keywordSelector = new PlatformAwareKeywordSelector();
      const keywords = ['提车', '油耗', '改装', '奥迪 Q5L 怎么样'];
      const selectedKeyword = keywordSelector.select(keywords, 'autohome');
      
      expect(selectedKeyword).toBeDefined();
      // 汽车之家应该优先选择短词
      expect(selectedKeyword.length).toBeLessThanOrEqual(4);
      
      // 2. 提示词生成
      const topic = '奥迪 Q5L 提车作业';
      const references: InternetReference[] = [
        {
          title: '奥迪 Q5L 提车，分享用车感受',
          content: '真实车主，落地价 35 万',
          source: '汽车之家',
        },
      ];
      
      const promptBuilder = selectPromptBuilder(references);
      expect(promptBuilder).toBeInstanceOf(AutohomePromptBuilder);
      
      const prompt = promptBuilder.build(topic, references);
      expect(prompt.systemPrompt).toBeDefined();
      expect(prompt.systemPrompt).toMatch(/(真实车主 | 用车体验 | 配置 | 价格)/);
      
      // 3. 平台适配性检查（模拟生成内容）
      const mockContent = `【提车信息】
车型：2024 款 奥迪 Q5L 45T  quattro 豪华型
落地价：35.8 万
购车地点：北京

【配置亮点】
1. 2.0T 高功率发动机
2. 适时四驱系统
3. 全景天窗

【实际油耗】
市区：10.5L/100km
高速：7.8L/100km

【改装建议】
推荐加装 360 全景影像...`;

      const adaptability = checkPlatformAdaptability(mockContent, 'autohome');
      expect(adaptability).toBeDefined();
      // 汽车之家内容应该有较高的适配度
      expect(adaptability.score).toBeGreaterThan(50);
    });
  });

  describe('跨平台内容适配性测试', () => {
    test('小红书风格内容在知乎平台适配度应该较低', () => {
      const xiaohongshuStyleContent = '🚗 奥迪 Q5L 太香了！✨✨✨\n\n姐妹们，今天来分享一下...\n#奥迪 Q5L #用车体验 #真香';
      
      const zhihuAdaptability = checkPlatformAdaptability(xiaohongshuStyleContent, 'zhihu');
      
      // 小红书风格在知乎平台适配度应该较低
      expect(zhihuAdaptability.issues.length).toBeGreaterThan(0);
    });

    test('知乎风格内容在小红书平台适配度应该较低', () => {
      const zhihuStyleContent = `# 奥迪 Q5L 评测报告

## 摘要
本文从多个维度对奥迪 Q5L 进行全面评测...

## 1. 动力系统分析
搭载 2.0T EA888 发动机，最大功率 183kW...`;

      const xiaohongshuAdaptability = checkPlatformAdaptability(zhihuStyleContent, 'xiaohongshu');
      
      // 知乎风格在小红书平台适配度应该较低
      expect(xiaohongshuAdaptability.issues.length).toBeGreaterThan(0);
    });
  });
});
