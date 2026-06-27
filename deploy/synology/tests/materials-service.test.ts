import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

let mockMaterialsBasePath = '';
let mockLoggingDir = '';

jest.mock('../src/utils/config', () => ({
  loadConfig: () =>
    ({
      materials: { basePath: mockMaterialsBasePath },
      logging: { level: 'error', dir: mockLoggingDir, retainDays: 1 },
    }) as any,
}));

import { getMaterials, isPathSafe, refreshMaterials, resolveMaterialPaths } from '../src/web/services/materials-service';

describe('materials-service', () => {
  describe('isPathSafe', () => {
    const basePath = '/mnt/nas/materials';

    it('应允许合法子路径', () => {
      expect(isPathSafe('travel/photo1.jpg', basePath)).toBe(true);
      expect(isPathSafe('cars/audi-q5.png', basePath)).toBe(true);
    });

    it('应拒绝路径穿越攻击', () => {
      expect(isPathSafe('../etc/passwd', basePath)).toBe(false);
      expect(isPathSafe('../../secret.txt', basePath)).toBe(false);
      expect(isPathSafe('travel/../../etc/passwd', basePath)).toBe(false);
    });

    it('应拒绝绝对路径', () => {
      expect(isPathSafe('/etc/passwd', basePath)).toBe(false);
    });

    it('应允许根目录自身', () => {
      expect(isPathSafe('.', basePath)).toBe(true);
    });
  });

  describe('materials sort & grouping', () => {
    let tempDir: string;

    function touch(filePath: string): void {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, 'x');
    }

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yqad-materials-'));
      mockMaterialsBasePath = tempDir;
      mockLoggingDir = tempDir;

      touch(path.join(tempDir, 'root2.jpg'));
      touch(path.join(tempDir, 'root1.jpg'));
      touch(path.join(tempDir, 'b', 'z.png'));
      touch(path.join(tempDir, 'b', 'a.jpg'));
      touch(path.join(tempDir, 'a', 'c.jpg'));
      touch(path.join(tempDir, 'b', 'sub', 'd.gif'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('getMaterials 应按 directory + filename 升序返回稳定顺序', () => {
      refreshMaterials();
      const items = getMaterials();
      const keys = items.map(i => `${i.directory}|${i.filename}`);
      expect(keys).toEqual([
        '|root1.jpg',
        '|root2.jpg',
        'a|c.jpg',
        'b|a.jpg',
        'b|z.png',
        'b/sub|d.gif',
      ]);
    });

    it('getMaterials(dir) 的排序规则应保持一致', () => {
      refreshMaterials();
      const items = getMaterials('b');
      const keys = items.map(i => `${i.directory}|${i.filename}`);
      expect(keys).toEqual(['b|a.jpg', 'b|z.png', 'b/sub|d.gif']);
    });

    it('resolveMaterialPaths 展开目录时应按文件名升序', () => {
      const resolved = resolveMaterialPaths(['b']);
      expect(resolved).toEqual([path.join(tempDir, 'b', 'a.jpg'), path.join(tempDir, 'b', 'z.png')]);
    });
  });
});
