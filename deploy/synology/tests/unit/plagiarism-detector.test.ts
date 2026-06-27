import { detectPlagiarism } from '../../src/utils/plagiarism-detector';
import { ReferencePost } from '../../src/types/posting-optimization';
import fc from 'fast-check';

describe('detectPlagiarism', () => {
  const makeRef = (content: string): ReferencePost => ({
    title: 'test',
    content,
    source: 'xiaohongshu',
  });

  it('should return false for empty content', () => {
    const refs = [makeRef('这是一段足够长的参考素材内容用来测试抄袭检测功能是否正常工作')];
    expect(detectPlagiarism('', refs)).toBe(false);
  });

  it('should return false for empty references array', () => {
    expect(detectPlagiarism('这是一段足够长的帖子内容', [])).toBe(false);
  });

  it('should return false when content is shorter than 30 characters', () => {
    const refs = [makeRef('这是一段足够长的参考素材内容用来测试抄袭检测功能是否正常工作')];
    expect(detectPlagiarism('短内容', refs)).toBe(false);
  });

  it('should return false when reference content is shorter than 30 characters', () => {
    const content = '这是一段足够长的帖子内容用来测试抄袭检测功能是否正常工作的具体实现逻辑';
    const refs = [makeRef('短参考')];
    expect(detectPlagiarism(content, refs)).toBe(false);
  });

  it('should return true when content contains a 30+ char substring from reference', () => {
    // 确保共享文本 >= 30 字符
    const sharedText = '这是一段连续相同的文本内容刚好超过三十个字符的阈值用于验证抄袭检测功能'; // 33 chars
    const content = `开头不同的内容${sharedText}结尾也不同`;
    const refs = [makeRef(`参考帖子前缀${sharedText}参考帖子后缀`)];
    expect(detectPlagiarism(content, refs)).toBe(true);
  });

  it('should return false when no substring of 30+ chars matches', () => {
    const content = '今天去给车做了保养，感觉发动机声音比以前安静多了，师傅说机油换了之后效果很明显';
    const refs = [makeRef('周末天气不错出去自驾游了一圈，路上风景很好，心情很愉快，下次还要去')];
    expect(detectPlagiarism(content, refs)).toBe(false);
  });

  it('should detect plagiarism from any reference in the list', () => {
    const sharedText = '奥迪A6L的驾驶体验非常不错，动力输出平顺且充沛，隔音效果一流';
    const content = `我的用车感受：${sharedText}，值得推荐`;
    const refs = [
      makeRef('这是第一篇不相关的参考帖子，内容完全不同，没有任何重叠的部分'),
      makeRef(`车友分享：${sharedText}，性价比很高`),
    ];
    expect(detectPlagiarism(content, refs)).toBe(true);
  });

  it('should return false when matching substring is exactly 29 characters', () => {
    // 使用不同的前缀/后缀确保没有跨边界的30字符匹配
    const substring29 = 'a'.repeat(29);
    const content = `ABCDE${substring29}FGHIJ`;
    const refs = [makeRef(`VWXYZ${substring29}KLMNO`)];
    // 虽然29个a相同，但前后字符不同，任何30字符窗口都不会完全匹配
    expect(detectPlagiarism(content, refs)).toBe(false);
  });

  it('should return true when matching substring is exactly 30 characters', () => {
    // 30 个 'a' 字符 — 刚好达到阈值
    const substring30 = 'a'.repeat(30);
    const content = `prefix${substring30}suffix`;
    const refs = [makeRef(`ref_prefix${substring30}ref_suffix`)];
    expect(detectPlagiarism(content, refs)).toBe(true);
  });
});


// Feature: posting-optimization, Property 10: 内容原创性检测
// **Validates: Requirements 6.4**
describe('detectPlagiarism - Property 10: 内容原创性检测', () => {
  const PBT_CONFIG = { numRuns: 100 };

  const makeRef = (content: string): ReferencePost => ({
    title: 'ref',
    content,
    source: 'xiaohongshu',
  });

  it('should return true when content shares a >= 30 char fragment with a reference', () => {
    fc.assert(
      fc.property(
        // Generate a shared fragment of length >= 30
        fc.string({ minLength: 30, maxLength: 80 }),
        // Generate distinct prefix/suffix for content
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        // Generate distinct prefix/suffix for reference
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (sharedFragment, contentPrefix, contentSuffix, refPrefix, refSuffix) => {
          const content = contentPrefix + sharedFragment + contentSuffix;
          const refContent = refPrefix + sharedFragment + refSuffix;
          const references = [makeRef(refContent)];

          expect(detectPlagiarism(content, references)).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  it('should return false when content and reference use disjoint character sets (no 30-char match possible)', () => {
    fc.assert(
      fc.property(
        // Content uses only characters from "abc" set - guaranteed disjoint from reference
        fc.stringOf(fc.constantFrom('a', 'b', 'c'), { minLength: 30, maxLength: 100 }),
        // Reference uses only characters from "xyz" set - guaranteed disjoint from content
        fc.stringOf(fc.constantFrom('x', 'y', 'z'), { minLength: 30, maxLength: 100 }),
        (content, refContent) => {
          const references = [makeRef(refContent)];

          expect(detectPlagiarism(content, references)).toBe(false);
        }
      ),
      PBT_CONFIG
    );
  });
});
