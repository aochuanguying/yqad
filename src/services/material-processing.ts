/**
 * 素材处理
 */

export interface ProcessedImage {
  path: string;
  width: number;
  height: number;
}

export const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic'];

export async function processImage(inputPath: string): Promise<ProcessedImage> {
  return {
    path: inputPath,
    width: 0,
    height: 0,
  };
}

export interface MaterialIndex {
  items: any[];
  basePath: string;
}

export function loadMaterialIndex(): MaterialIndex {
  return {
    items: [],
    basePath: './data/materials',
  };
}
