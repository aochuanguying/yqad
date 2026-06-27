import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { deleteProcessedMaterial, repairMaterialIndex } from '../src/services/material-processing';

function ensureDir(p: string): void {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeJson(p: string, v: any): void {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(v, null, 2), 'utf-8');
}

describe('material index repair', () => {
  test('deleteProcessedMaterial removes file, manifest record, info file and rebuilds index', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yqad-materials-'));
    const processed = path.join(root, 'foo.jpg');
    ensureDir(path.join(root, '.materials', 'info'));
    fs.writeFileSync(processed, 'x');

    const infoRel = '.materials/info/foo.jpg.json';
    const infoFull = path.join(root, infoRel);
    writeJson(infoFull, {
      source: { relativePath: 'raw/foo.heic', size: 1, mtimeMs: 1 },
      output: { relativePath: 'foo.jpg', size: 1, format: 'jpeg', width: 1, height: 1 },
      status: 'processed',
      processedAt: new Date().toISOString(),
      vision: { tags: [], intro: '' },
      sourceMetadata: {},
      outputMetadata: {},
    });

    const manifestPath = path.join(root, '.materials', 'manifest.json');
    writeJson(manifestPath, {
      version: 1,
      records: {
        fp1: { fingerprint: 'fp1', infoRelativePath: infoRel, status: 'processed', processedAt: new Date().toISOString() },
      },
    });

    const r = deleteProcessedMaterial('foo.jpg', root);
    expect(r.deleted).toBe(true);
    expect(fs.existsSync(processed)).toBe(false);
    expect(fs.existsSync(infoFull)).toBe(false);

    const afterManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(Object.keys(afterManifest.records)).toHaveLength(0);

    const indexPath = path.join(root, '.materials', 'index.json');
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    expect(index.total).toBe(0);
  });

  test('repairMaterialIndex removes stale processed records and orphan info files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yqad-materials-'));
    ensureDir(path.join(root, '.materials', 'info'));

    const infoRel = '.materials/info/missing.jpg.json';
    const infoFull = path.join(root, infoRel);
    writeJson(infoFull, {
      source: { relativePath: 'raw/missing.heic', size: 1, mtimeMs: 1 },
      output: { relativePath: 'missing.jpg', size: 1, format: 'jpeg', width: 1, height: 1 },
      status: 'processed',
      processedAt: new Date().toISOString(),
      vision: { tags: [], intro: '' },
      sourceMetadata: {},
      outputMetadata: {},
    });

    const orphanFull = path.join(root, '.materials', 'info', 'orphan.jpg.json');
    writeJson(orphanFull, {
      source: { relativePath: 'raw/orphan.heic', size: 1, mtimeMs: 1 },
      output: { relativePath: 'orphan.jpg', size: 1, format: 'jpeg', width: 1, height: 1 },
      status: 'processed',
      processedAt: new Date().toISOString(),
      vision: { tags: [], intro: '' },
      sourceMetadata: {},
      outputMetadata: {},
    });

    const manifestPath = path.join(root, '.materials', 'manifest.json');
    writeJson(manifestPath, {
      version: 1,
      records: {
        fp1: { fingerprint: 'fp1', infoRelativePath: infoRel, status: 'processed', processedAt: new Date().toISOString() },
      },
    });

    const r = repairMaterialIndex(root);
    expect(r.removedRecords).toBe(1);
    expect(r.removedInfoFiles).toBe(1);
    expect(r.removedOrphanInfoFiles).toBe(1);
    expect(r.total).toBe(0);
    expect(fs.existsSync(infoFull)).toBe(false);
    expect(fs.existsSync(orphanFull)).toBe(false);
  });
});

