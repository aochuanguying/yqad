/**
 * 错误分类器
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  API = 'API',
  UNKNOWN = 'UNKNOWN',
}

export class ClassifiedError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = 'ClassifiedError';
  }
}

export function classifyError(error: any): ErrorType {
  if (error?.code === 'ECONNRESET' || error?.code === 'ENOTFOUND') {
    return ErrorType.NETWORK;
  }
  if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
    return ErrorType.TIMEOUT;
  }
  if (error?.status >= 400 && error?.status < 500) {
    return ErrorType.API;
  }
  return ErrorType.UNKNOWN;
}

export class ErrorClassifier {
  classify(error: any): ErrorType {
    return classifyError(error);
  }
}
