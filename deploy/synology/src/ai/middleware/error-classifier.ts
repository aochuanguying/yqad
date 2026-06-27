/**
 * 错误分类器
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  API = 'API',
  UNKNOWN = 'UNKNOWN',
}

export function classifyError(error: any): ErrorType {
  return ErrorType.UNKNOWN;
}
