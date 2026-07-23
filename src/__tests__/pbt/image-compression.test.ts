/**
 * Property 4: 图片压缩尺寸约束
 *
 * 对任意尺寸的图片输入，prepareImageForVision 处理后的输出图片长边应 ≤ 2048px，且格式为 JPEG。
 *
 * Validates: Requirements 3.4
 */

// Feature: ai-provider-vision-support, Property 4: 图片压缩尺寸约束

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
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';
import { prepareImageForVision } from '../../services/material-processor';

describe('Property 4: 图片压缩尺寸约束', () => {
  const MAX_DIM = 2048;

  it('对任意尺寸的图片，prepareImageForVision 输出长边 ≤ 2048px 且格式为 JPEG', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 8000 }),
        fc.integer({ min: 1, max: 8000 }),
        async (width, height) => {
          // 创建指定尺寸的纯色测试图片
          const tmpFile = path.join(os.tmpdir(), `pbt-img-${width}x${height}-${Date.now()}.png`);

          try {
            // 使用 sharp 创建纯色图片并写入临时文件
            await sharp({
              create: {
                width,
                height,
                channels: 3,
                background: { r: 128, g: 128, b: 128 },
              },
            })
              .png()
              .toFile(tmpFile);

            // 调用待测函数
            const base64Result = await prepareImageForVision(tmpFile);

            // prepareImageForVision 应返回有效 base64（非 null，除非超出 20MB）
            // 对于合理尺寸范围内的图片（≤8000px），压缩后不应超 20MB
            expect(base64Result).not.toBeNull();

            // 将 base64 解码为 Buffer，用 sharp 验证元数据
            const buffer = Buffer.from(base64Result!, 'base64');
            const metadata = await sharp(buffer).metadata();

            // 验证格式为 jpeg
            expect(metadata.format).toBe('jpeg');

            // 验证宽度和高度均 ≤ 2048
            expect(metadata.width).toBeLessThanOrEqual(MAX_DIM);
            expect(metadata.height).toBeLessThanOrEqual(MAX_DIM);
          } finally {
            // 清理临时文件
            if (fs.existsSync(tmpFile)) {
              fs.unlinkSync(tmpFile);
            }
          }
        }
      ),
      { numRuns: 30, verbose: true }
    );
  });
});
