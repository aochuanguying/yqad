import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('material-processing HEIC fallback', () => {
  it('HEIC 转 JPEG 降级路径应按 jpegQuality 再编码输出', async () => {
    const rawDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yqad-raw-'));
    const processedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yqad-processed-'));
    const inputHeic = path.join(rawDir, 'a.heic');
    fs.writeFileSync(inputHeic, 'dummy', 'utf-8');

    const execFileSyncMock = jest.fn((cmd: string, args: string[]) => {
      const outIndex = args.findIndex((x) => x === '--out');
      const outPath = args[outIndex + 1];
      fs.writeFileSync(outPath, 'jpeg-from-sips', 'utf-8');
    });

    const sharpMock = jest.fn((inputPath: string) => {
      let jpegOptions: any;
      return {
        rotate() {
          return this;
        },
        jpeg(opts: any) {
          jpegOptions = opts;
          return this;
        },
        async toFile(outPath: string) {
          if (String(inputPath).endsWith('.heic')) throw new Error('heic not supported');
          fs.writeFileSync(outPath, `jpeg-quality:${jpegOptions?.quality ?? ''}`, 'utf-8');
        },
        async metadata() {
          return { format: 'jpeg', width: 1, height: 1 };
        },
      };
    });

    let processMaterials: any;
    jest.isolateModules(() => {
      jest.doMock('child_process', () => ({ execFileSync: execFileSyncMock }));
      jest.doMock('sharp', () => ({ __esModule: true, default: sharpMock }));
      jest.doMock('../../src/services/materials-paths', () => ({
        getMaterialsProcessedPath: () => processedDir,
        getMaterialsRawPath: () => rawDir,
        getMaterialsProcessingConfig: () => ({
          enabled: true,
          outputFormat: 'jpeg',
          jpegQuality: 77,
          enableVision: false,
          maxFilesPerRun: 1000,
        }),
      }));
      jest.doMock('../../src/utils/logger', () => ({
        getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
      }));

      processMaterials = require('../../src/services/material-processing').processMaterials;
    });

    const result = await processMaterials({ enableVision: false });
    expect(result.processed).toBe(1);
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
    const files = fs.readdirSync(processedDir, { recursive: true }) as string[];
    expect(files.some((f) => String(f).endsWith('.jpg'))).toBe(true);
  });
});
