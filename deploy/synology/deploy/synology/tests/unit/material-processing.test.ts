import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let rawDir = '';
let processedDir = '';
let mockLoggingDir = '';
let enableVision = false;

jest.mock('../../src/utils/config', () => ({
  loadConfig: () =>
    ({
      materials: {
        basePath: processedDir,
        rawPath: rawDir,
        processedPath: processedDir,
        processing: { enabled: true, outputFormat: 'jpeg', jpegQuality: 80, enableVision, maxFilesPerRun: 50 },
      },
      ai: { providers: [] },
      logging: { level: 'error', dir: mockLoggingDir, retainDays: 1 },
      scheduler: {
        signin: { cron: '0 8 * * *', randomOffsetMin: 0, randomOffsetMax: 0 },
        analysis: { cron: '0 9 * * *', randomOffsetMin: 0, randomOffsetMax: 0 },
        comment: { cron: '0 10 * * *', randomOffsetMin: 0, randomOffsetMax: 0 },
        post: { cron: '0 12 * * *', randomOffsetMin: 0, randomOffsetMax: 0 },
        materialProcessing: { cron: '0 7 * * *', randomOffsetMin: 0, randomOffsetMax: 0 },
      },
    }) as any,
}));

jest.mock('../../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { getMaterialInfoByProcessedRelativePath, processMaterials } from '../../src/services/material-processing';

function writePng1x1(targetPath: string): void {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP8z8BQDwAFgwJ/l0YQqwAAAABJRU5ErkJggg==';
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, Buffer.from(base64, 'base64'));
}

describe('material-processing', () => {
  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yqad-mp-'));
    rawDir = path.join(tmp, 'raw');
    processedDir = path.join(tmp, 'processed');
    mockLoggingDir = tmp;
    enableVision = false;
    fs.mkdirSync(rawDir, { recursive: true });
    fs.mkdirSync(processedDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(path.dirname(rawDir), { recursive: true, force: true });
  });

  it('应处理新增原始素材并生成处理后文件与梳理信息', async () => {
    writePng1x1(path.join(rawDir, 'a.png'));
    const r = await processMaterials();
    expect(r.processed + r.copied + r.failed).toBe(1);

    const outName = fs.readdirSync(processedDir).find(n => n.endsWith('.jpg') || n.endsWith('.png'));
    expect(outName).toBeTruthy();

    const manifestPath = path.join(processedDir, '.materials', 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const info = getMaterialInfoByProcessedRelativePath(outName!);
    expect(info).toBeTruthy();
    expect(info!.source.relativePath).toBe('a.png');
    expect(info!.status).toBe('processed');
    expect(info!.sourceMetadata?.format).toBe('png');
    expect(info!.outputMetadata?.format).toBe('jpeg');

    const indexPath = path.join(processedDir, '.materials', 'index.json');
    expect(fs.existsSync(indexPath)).toBe(true);
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    expect(index.total).toBe(1);
    expect(index.items[0].relativePath).toBe(outName);
    expect(index.items[0].searchableText).toContain('a.png');
  });

  it('再次执行应只处理新增素材', async () => {
    writePng1x1(path.join(rawDir, 'a.png'));
    await processMaterials();
    const r2 = await processMaterials();
    expect(r2.processed + r2.copied + r2.failed).toBe(0);
    expect(r2.scanned).toBe(0);
  });

  it('已处理但缺少元数据的素材应在后续执行中补齐', async () => {
    writePng1x1(path.join(rawDir, 'a.png'));
    await processMaterials();
    const manifestPath = path.join(processedDir, '.materials', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const record = Object.values(manifest.records)[0] as any;
    const infoPath = path.join(processedDir, record.infoRelativePath);
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    delete info.sourceMetadata;
    delete info.outputMetadata;
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf-8');

    const r2 = await processMaterials();
    expect(r2.scanned).toBe(1);
    const enriched = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    expect(enriched.sourceMetadata?.format).toBe('png');
    expect(enriched.outputMetadata?.format).toBe('jpeg');
  });

  it('failed 状态的图片记录应允许后续重试处理', async () => {
    writePng1x1(path.join(rawDir, 'a.png'));
    await processMaterials();
    const manifestPath = path.join(processedDir, '.materials', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const fp = Object.keys(manifest.records)[0];
    manifest.records[fp].status = 'failed';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    const r2 = await processMaterials();
    expect(r2.scanned).toBe(1);
    expect(r2.processed + r2.copied + r2.failed).toBe(1);
  });

  it('非图片素材应记录 ignored 且后续不再处理', async () => {
    fs.writeFileSync(path.join(rawDir, 'note.txt'), 'not image', 'utf-8');
    const r = await processMaterials();
    expect(r.ignored).toBe(1);
    expect(r.processed + r.copied + r.failed).toBe(0);

    const r2 = await processMaterials();
    expect(r2.scanned).toBe(0);
  });

  it('并发触发时应拒绝重复执行', async () => {
    writePng1x1(path.join(rawDir, 'a.png'));
    const p1 = processMaterials();
    const p2 = processMaterials();
    const r2 = await p2;
    expect(r2).toEqual({ scanned: 0, processed: 0, copied: 0, failed: 0, ignored: 0, skipped: 0 });
    const r1 = await p1;
    expect(r1.processed + r1.copied + r1.failed).toBe(1);
  });
});
