import { getMaterialsProcessingConfig } from '../../src/services/materials-paths';
import { loadConfig } from '../../src/utils/config';

jest.mock('../../src/utils/config');

describe('素材处理配置', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('应提供 HEIC 兜底默认值', () => {
    (loadConfig as jest.Mock).mockReturnValue({
      materials: {
        basePath: './data/materials',
        processing: {},
      },
    });

    expect(getMaterialsProcessingConfig()).toEqual({
      enabled: true,
      outputFormat: 'jpeg',
      jpegQuality: 82,
      enableVision: true,
      maxFilesPerRun: 1000,
      heicFallback: {
        enabled: true,
        command: 'auto',
        timeoutMs: 30000,
      },
    });
  });

  it('应允许覆盖 HEIC 兜底配置', () => {
    (loadConfig as jest.Mock).mockReturnValue({
      materials: {
        basePath: './data/materials',
        processing: {
          enabled: true,
          outputFormat: 'jpeg',
          jpegQuality: 90,
          enableVision: false,
          maxFilesPerRun: 200,
          heicFallback: {
            enabled: false,
            command: 'heif-convert',
            timeoutMs: 60000,
          },
        },
      },
    });

    expect(getMaterialsProcessingConfig()).toEqual({
      enabled: true,
      outputFormat: 'jpeg',
      jpegQuality: 90,
      enableVision: false,
      maxFilesPerRun: 200,
      heicFallback: {
        enabled: false,
        command: 'heif-convert',
        timeoutMs: 60000,
      },
    });
  });
});
