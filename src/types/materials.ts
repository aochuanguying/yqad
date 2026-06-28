/**
 * 素材配置
 */
export interface MaterialsConfig {
  /** 基础路径 */
  basePath: string;
  /** 原始素材路径 */
  rawPath: string;
  /** 处理后素材路径 */
  processedPath: string;
  /** 处理配置 */
  processing?: {
    enabled: boolean;
    outputFormat: string;
    jpegQuality: number;
    enableVision: boolean;
    maxFilesPerRun: number;
    heicFallback?: {
      enabled: boolean;
      command: string;
      timeoutMs: number;
    };
  };
}

/**
 * 素材文件信息
 */
export interface MaterialFileInfo {
  /** 文件路径 */
  path: string;
  /** 文件哈希 */
  hash: string;
  /** 文件大小（字节） */
  size: number;
  /** 扩展名 */
  extension: string;
}

/**
 * 素材扫描结果
 */
export interface MaterialScanResult {
  /** 新素材列表 */
  newMaterials: MaterialFileInfo[];
  /** 已存在素材列表 */
  existingMaterials: MaterialFileInfo[];
  /** 扫描总数 */
  totalScanned: number;
  /** 新增数量 */
  newCount: number;
  /** 跳过数量 */
  skippedCount: number;
}

/**
 * 素材元数据
 */
export interface MaterialMetadata {
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 格式 */
  format: string;
  /** 文件大小（字节） */
  fileSize: number;
  /** 是否为 HEIC 格式 */
  isHeic?: boolean;
  /** 转换后的 JPEG 路径（HEIC 转换后） */
  convertedPath?: string;
  /** 转换是否失败 */
  conversionFailed?: boolean;
}

/**
 * 素材处理结果
 */
export interface MaterialProcessResult {
  /** 素材 ID */
  id: string;
  /** 文件路径 */
  path: string;
  /** 元数据 */
  metadata: MaterialMetadata;
  /** AI 生成的描述 */
  description: string;
  /** AI 生成的标签 */
  tags: string[];
  /** 是否成功 */
  success: boolean;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 素材整理统计
 */
export interface MaterialOrganizeStats {
  /** 扫描总数 */
  scanned: number;
  /** 新增数量 */
  added: number;
  /** 更新数量 */
  updated: number;
  /** 失败数量 */
  failed: number;
  /** 跳过数量 */
  skipped: number;
  /** 总耗时（毫秒） */
  durationMs: number;
}
