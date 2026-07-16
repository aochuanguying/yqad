import * as winston from 'winston';
import * as path from 'path';

let loggerInstance: winston.Logger | null = null;

export function getLogger(moduleName: string): winston.Logger {
  if (!loggerInstance) {
    const logDir = process.env.LOG_DIR || '/app/logs';
    const logFile = path.join(logDir, 'app.log');

    loggerInstance = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      // 关键：使用 async 模式，避免阻塞
      defaultMeta: { service: 'yqad-app' },
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, module, stack }) => {
          const modulePrefix = module ? `[${module}] ` : '';
          if (stack) {
            return `${timestamp} ${level} ${modulePrefix}${message}\n${stack}`;
          }
          return `${timestamp} ${level} ${modulePrefix}${message}`;
        })
      ),
      transports: [
        // 输出到文件（唯一输出）
        new winston.transports.File({
          filename: logFile,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
      ],
      // 退出时刷新所有 transport
      exitOnError: false,
    });
  }

  return loggerInstance.child({ module: moduleName });
}

export function resetLogger(): void {
  loggerInstance = null;
}
