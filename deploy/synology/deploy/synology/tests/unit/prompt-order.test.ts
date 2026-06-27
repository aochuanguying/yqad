import fc from 'fast-check';
import { buildPostSystemPrompt } from '../../src/ai/prompts';
import { GlobalPostPrompt } from '../../src/types/posting-optimization';
import { AnalysisSummary } from '../../src/services/content-analysis';

// Feature: posting-optimization, Property 2: Prompt 构建顺序（人设优先注入）

const PBT_CONFIG = { numRuns: 100 };

/**
 * 自定义 Arbitrary：生成随机 GlobalPostPrompt
 */
const globalPostPromptArb: fc.Arbitrary<GlobalPostPrompt> = fc.record({
  personalInfo: fc.record({
    carModel: fc.string({ minLength: 1, maxLength: 50 }),
    gender: fc.string({ minLength: 1, maxLength: 50 }),
    ageGroup: fc.string({ minLength: 1, maxLength: 50 }),
  }),
  styleDescription: fc.string({ minLength: 1, maxLength: 500 }),
});

/**
 * 自定义 Arbitrary：生成随机 AnalysisSummary
 */
const analysisSummaryArb: fc.Arbitrary<AnalysisSummary> = fc.record({
  topics: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
  styleDescription: fc.string({ minLength: 1, maxLength: 200 }),
  exampleTexts: fc.array(fc.string({ minLength: 0, maxLength: 100 }), { minLength: 0, maxLength: 3 }),
  avgPostLength: fc.integer({ min: 0, max: 1000 }),
  avgCommentLength: fc.integer({ min: 0, max: 500 }),
  updatedAt: fc.date().map(d => d.toISOString()),
  analyzedIds: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
});

describe('Property 2: Prompt 构建顺序（人设优先注入）', () => {
  // **Validates: Requirements 1.4**
  it('GlobalPostPrompt 的 "【发帖人设】" 标记应出现在 AnalysisSummary.styleDescription 之前', () => {
    fc.assert(
      fc.property(
        globalPostPromptArb,
        analysisSummaryArb,
        (globalPrompt, summary) => {
          const result = buildPostSystemPrompt(summary, globalPrompt);

          // 人设标记位置
          const personaIndex = result.indexOf('【发帖人设】');
          // 社区风格特征标记位置（summary.styleDescription 被包含在【社区风格特征】块中）
          const styleFeatureIndex = result.indexOf('【社区风格特征】');

          // 两个标记都应存在
          if (personaIndex === -1 || styleFeatureIndex === -1) {
            return false;
          }

          // 人设标记应在社区风格特征标记之前
          return personaIndex < styleFeatureIndex;
        }
      ),
      PBT_CONFIG
    );
  });

  it('GlobalPostPrompt.styleDescription 内容应出现在 AnalysisSummary.styleDescription 内容之前', () => {
    fc.assert(
      fc.property(
        globalPostPromptArb,
        analysisSummaryArb,
        (globalPrompt, summary) => {
          const result = buildPostSystemPrompt(summary, globalPrompt);

          // globalPrompt 的 styleDescription 以 "内容风格要求: xxx" 形式注入
          const globalStyleContent = `内容风格要求: ${globalPrompt.styleDescription}`;
          const globalStyleIndex = result.indexOf(globalStyleContent);

          // summary 的 styleDescription 出现在【社区风格特征】块中
          const summaryStyleIndex = result.indexOf(summary.styleDescription, result.indexOf('【社区风格特征】'));

          // 两者都应存在于结果中
          if (globalStyleIndex === -1 || summaryStyleIndex === -1) {
            return false;
          }

          // globalPrompt 的风格描述应出现在 summary 的风格描述之前
          return globalStyleIndex < summaryStyleIndex;
        }
      ),
      PBT_CONFIG
    );
  });
});
