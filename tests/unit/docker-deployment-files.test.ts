import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

describe('Docker 部署文件', () => {
  const projectRoot = path.resolve(__dirname, '../..');

  it('应提供面向群晖的 Dockerfile 运行时依赖', () => {
    const dockerfile = fs.readFileSync(path.join(projectRoot, 'Dockerfile'), 'utf-8');

    expect(dockerfile).toContain('FROM node:20-bookworm-slim');
    expect(dockerfile).toContain('libheif-examples');
    expect(dockerfile).toContain('libvips42');
    expect(dockerfile).toContain('ENTRYPOINT ["/usr/bin/tini", "--"]');
  });

  it('应提供 linux/amd64 的 docker-compose 配置', () => {
    const composeContent = fs.readFileSync(path.join(projectRoot, 'docker-compose.yml'), 'utf-8');
    const compose = yaml.parse(composeContent) as any;

    expect(compose.services.yqad.platform).toBe('linux/amd64');
    expect(compose.services.yqad.ports).toContain('${YQAD_PORT:-3000}:3000');
    expect(compose.services.yqad.volumes).toEqual(
      expect.arrayContaining([
        './config:/app/config',
        './data:/app/data',
        './logs:/app/logs',
      ]),
    );
  });

  it('应提供群晖示例配置', () => {
    const exampleContent = fs.readFileSync(path.join(projectRoot, 'config/local.docker.yaml.example'), 'utf-8');
    const example = yaml.parse(exampleContent) as any;

    expect(example.web.baseUrl).toContain('your-nas-ip');
    expect(example.materials.processing.heicFallback.enabled).toBe(true);
    expect(example.materials.processing.heicFallback.command).toBe('heif-convert');
    expect(example.materials.processing.heicFallback.timeoutMs).toBe(30000);
  });
});
