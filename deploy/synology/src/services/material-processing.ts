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

export async function loadMaterialIndex(): Promise<any[]> {
  return [];
}
