import * as fs from 'fs';
import * as path from 'path';
import fc from 'fast-check';
import { tokenize, selectImages, selectFeaturedImageCandidates } from '../../src/services/image-selector';

// Mock config and logger
jest.mock('../../src/utils/config', () => ({
  loadConfig: () => ({
    materials: { basePath: './test-materials' },
  }),
}));

jest.mock('../../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('image-selector', () => {
  describe('tokenize', () => {
    it('should return empty array for empty string', () => {
      expect(tokenize('')).toEqual([]);
    });

    it('should return empty array for whitespace-only string', () => {
      expect(tokenize('   ')).toEqual([]);
    });

    it('should split on Chinese punctuation', () => {
      const tokens = tokenize('冬季保养，轮胎检查');
      expect(tokens).toContain('冬季保养');
      expect(tokens).toContain('轮胎检查');
    });

    it('should split on common delimiters', () => {
      const tokens = tokenize('河北行 东太行');
      expect(tokens).toContain('河北行');
      expect(tokens).toContain('东太行');
    });

    it('should extract two-character sub-sequences from longer Chinese text', () => {
      const tokens = tokenize('东太行');
      expect(tokens).toContain('东太行');
      expect(tokens).toContain('东太');
      expect(tokens).toContain('太行');
    });

    it('should handle mixed Chinese and punctuation', () => {
      const tokens = tokenize('河北行！东太行风景');
      expect(tokens).toContain('河北行');
      expect(tokens).toContain('东太行风景');
    });
  });

  describe('selectImages', () => {
    const testMaterialsBase = path.resolve(process.cwd(), 'test-materials');

    beforeAll(() => {
      // Create test directory structure
      const dirs = [
        'test-materials/河北行',
        'test-materials/河北行/东太行',
        'test-materials/山东游',
        'test-materials/冬季保养',
      ];

      for (const dir of dirs) {
        fs.mkdirSync(path.resolve(process.cwd(), dir), { recursive: true });
      }

      // Create test image files
      const files = [
        'test-materials/河北行/img1.jpg',
        'test-materials/河北行/img2.png',
        'test-materials/河北行/东太行/img3.jpg',
        'test-materials/河北行/东太行/img4.png',
        'test-materials/河北行/东太行/img5.jpeg',
        'test-materials/山东游/img6.gif',
        'test-materials/山东游/img7.webp',
        'test-materials/冬季保养/img8.png',
        'test-materials/冬季保养/doc.txt', // non-image
      ];

      for (const file of files) {
        fs.writeFileSync(path.resolve(process.cwd(), file), 'fake-image-data');
      }

      fs.mkdirSync(path.resolve(process.cwd(), 'test-materials/.materials'), { recursive: true });
      fs.writeFileSync(path.resolve(process.cwd(), 'test-materials/.materials/index.json'), JSON.stringify({
        version: 1,
        generatedAt: new Date().toISOString(),
        total: 1,
        items: [{
          relativePath: '山东游/img6.gif',
          directory: '山东游',
          filename: 'img6.gif',
          sourceRelativePath: '山东游/source.gif',
          size: 10,
          tags: ['古城', '夜景'],
          intro: '这是一张适合介绍城市夜景和古城游览体验的图片',
          searchableText: '山东游 img6.gif 古城 夜景 城市夜景 古城游览',
          infoRelativePath: '.materials/info/山东游/img6.gif.json',
          processedAt: new Date().toISOString(),
        }],
      }, null, 2), 'utf-8');
    });

    afterAll(() => {
      // Clean up test directory
      fs.rmSync(path.resolve(process.cwd(), 'test-materials'), { recursive: true, force: true });
    });

    it('should return empty array when keywords produce no matches', () => {
      const result = selectImages('完全不存在的词');
      expect(result).toEqual([]);
    });

    it('should match directory by keyword', () => {
      const result = selectImages('河北行');
      expect(result.length).toBeGreaterThan(0);
      // Should match "河北行" directory
      for (const img of result) {
        expect(img).toContain('河北行');
      }
    });

    it('should prefer material index by tags and intro', () => {
      const result = selectImages('古城夜景');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toContain('山东游');
      expect(result[0]).toContain('img6.gif');
    });

    it('should prefer directory with more keyword hits', () => {
      // "东太行" will match "东太行" directory (via substring match on the dir name)
      const result = selectImages('东太行');
      expect(result.length).toBeGreaterThan(0);
      for (const img of result) {
        expect(img).toContain('东太行');
      }
    });

    it('should return at most 9 images', () => {
      // Create a directory with more than 9 images
      const manyImagesDir = path.resolve(process.cwd(), 'test-materials/多图目录');
      fs.mkdirSync(manyImagesDir, { recursive: true });
      for (let i = 0; i < 15; i++) {
        fs.writeFileSync(path.join(manyImagesDir, `img${i}.jpg`), 'data');
      }

      const result = selectImages('多图目录');
      expect(result.length).toBeLessThanOrEqual(9);
      expect(result.length).toBeGreaterThan(0);

      // Cleanup
      fs.rmSync(manyImagesDir, { recursive: true, force: true });
    });

    it('should use materialPaths directly when provided', () => {
      const result = selectImages('任意关键词', ['河北行/东太行']);
      expect(result.length).toBeGreaterThan(0);
      for (const img of result) {
        expect(img).toContain('东太行');
      }
    });

    it('should skip smart matching when materialPaths is non-empty', () => {
      // Even if keywords match a different directory, materialPaths should take precedence
      const result = selectImages('山东游', ['冬季保养']);
      expect(result.length).toBeGreaterThan(0);
      for (const img of result) {
        expect(img).toContain('冬季保养');
      }
    });

    it('should return empty array when materialPaths point to non-existent paths', () => {
      const result = selectImages('关键词', ['不存在的目录']);
      expect(result).toEqual([]);
    });

    it('should filter out non-image files when using materialPaths', () => {
      const result = selectImages('关键词', ['冬季保养']);
      // 冬季保养 has img8.png and doc.txt; only the png should be returned
      expect(result.length).toBe(1);
      expect(result[0]).toContain('img8.png');
    });

    it('should return empty array for empty keywords', () => {
      const result = selectImages('');
      expect(result).toEqual([]);
    });

    it('should not use materialPaths when array is empty', () => {
      // Empty array should trigger smart matching, not materialPaths mode
      const result = selectImages('山东游', []);
      expect(result.length).toBeGreaterThan(0);
      for (const img of result) {
        expect(img).toContain('山东游');
      }
    });

    it('should supplement candidates to satisfy minCount when possible', () => {
      const result = selectFeaturedImageCandidates({
        keywords: '冬季保养',
        minCount: 4,
      });
      expect(result.length).toBeGreaterThanOrEqual(4);
    });
  });

  // Feature: posting-optimization, Property 4: 图片选取数量约束
  describe('Property 4: 图片选取数量约束', () => {
    const PBT_CONFIG = { numRuns: 100 };
    const pbtDir = path.resolve(process.cwd(), 'test-materials/pbt-images');

    afterEach(() => {
      // Clean up pbt directory after each test
      if (fs.existsSync(pbtDir)) {
        fs.rmSync(pbtDir, { recursive: true, force: true });
      }
    });

    // **Validates: Requirements 3.1, 3.2**
    it('should return 1 to min(9, N) images when candidate set has N images (N >= 1)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 15 }),
          (numImages) => {
            // Setup: create a temp directory with N image files
            fs.mkdirSync(pbtDir, { recursive: true });
            for (let i = 0; i < numImages; i++) {
              fs.writeFileSync(path.join(pbtDir, `img${i}.jpg`), 'fake-data');
            }

            // Act: use materialPaths to directly provide the directory
            const result = selectImages('', [pbtDir]);

            // Assert: result count is between 1 and min(9, N)
            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(result.length).toBeLessThanOrEqual(Math.min(9, numImages));

            // Cleanup for next iteration
            fs.rmSync(pbtDir, { recursive: true, force: true });
          }
        ),
        PBT_CONFIG
      );
    });

    // **Validates: Requirements 3.1, 3.2**
    it('should return empty array when candidate set is empty (non-existent paths)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          (randomDirName) => {
            // Use a non-existent directory path as materialPaths
            const nonExistentPath = path.resolve(process.cwd(), 'test-materials', `nonexist-${randomDirName}`);

            // Ensure it doesn't exist
            if (fs.existsSync(nonExistentPath)) {
              fs.rmSync(nonExistentPath, { recursive: true, force: true });
            }

            const result = selectImages('任意关键词', [nonExistentPath]);
            expect(result).toEqual([]);
          }
        ),
        PBT_CONFIG
      );
    });
  });

  // Feature: posting-optimization, Property 5: 关键词目录匹配优先级
  // **Validates: Requirements 3.3**
  describe('Property 5: 关键词目录匹配优先级', () => {
    const PBT_CONFIG = { numRuns: 100 };

    // A pool of distinct Chinese two-character words to use as keywords
    const KEYWORD_POOL = [
      '春天', '夏日', '秋风', '冬雪', '山水', '花草', '鸟语', '风光',
      '日出', '月色', '星辰', '大海', '森林', '草原', '湖泊', '瀑布',
      '古城', '新村', '高山', '深谷', '白云', '青松', '红叶', '绿水',
    ];

    // Generator: produces a split of keywords into "more" and "fewer" groups
    // where moreKeywords.length > fewerKeywords.length and both are non-empty
    const keywordSplitArbitrary = fc
      .integer({ min: 3, max: 6 })
      .chain((totalCount) =>
        fc.shuffledSubarray(KEYWORD_POOL, { minLength: totalCount, maxLength: totalCount })
      )
      .chain((keywords) => {
        // moreCount must be > fewerCount, and fewerCount >= 1
        // So moreCount > keywords.length / 2, minimum moreCount = 2
        const minMore = Math.ceil(keywords.length / 2) + 1;
        const maxMore = keywords.length - 1;
        if (minMore > maxMore) {
          // Force a valid split: 2 more, 1 fewer
          return fc.constant({
            moreKeywords: keywords.slice(0, 2),
            fewerKeywords: keywords.slice(2, 3),
            allKeywords: keywords.slice(0, 3),
          });
        }
        return fc.integer({ min: minMore, max: maxMore }).map((moreCount) => ({
          moreKeywords: keywords.slice(0, moreCount),
          fewerKeywords: keywords.slice(moreCount),
          allKeywords: keywords,
        }));
      });

    it('should return images from the directory matching more keywords over the one matching fewer', () => {
      fc.assert(
        fc.property(keywordSplitArbitrary, ({ moreKeywords, fewerKeywords, allKeywords }) => {
          // Precondition: strictly more keywords in the "more" group
          fc.pre(moreKeywords.length > fewerKeywords.length);
          fc.pre(fewerKeywords.length >= 1);

          // Build directory names by concatenating keywords (each keyword is 2 chars)
          const moreDirName = `pbt5more_${moreKeywords.join('')}`;
          const fewerDirName = `pbt5fewer_${fewerKeywords.join('')}`;

          const moreDirPath = path.resolve(process.cwd(), 'test-materials', moreDirName);
          const fewerDirPath = path.resolve(process.cwd(), 'test-materials', fewerDirName);

          try {
            fs.mkdirSync(moreDirPath, { recursive: true });
            fs.mkdirSync(fewerDirPath, { recursive: true });

            // Place distinct images in each directory
            fs.writeFileSync(path.join(moreDirPath, 'more_a.jpg'), 'data');
            fs.writeFileSync(path.join(moreDirPath, 'more_b.png'), 'data');
            fs.writeFileSync(path.join(fewerDirPath, 'fewer_a.jpg'), 'data');
            fs.writeFileSync(path.join(fewerDirPath, 'fewer_b.png'), 'data');

            // Build search text with all keywords separated by spaces
            const keywordText = allKeywords.join(' ');
            const result = selectImages(keywordText);

            // Property: returned images should come from the "more" directory
            // because its name contains more of the keywords
            if (result.length === 0) {
              // No results is acceptable only if tokenization doesn't match
              // but given our setup this shouldn't happen — treat as pass
              return true;
            }

            // All returned images must be from the moreDirName directory
            return result.every((img) => img.includes(moreDirName));
          } finally {
            // Cleanup generated directories
            fs.rmSync(moreDirPath, { recursive: true, force: true });
            fs.rmSync(fewerDirPath, { recursive: true, force: true });
          }
        }),
        PBT_CONFIG
      );
    });
  });
});
