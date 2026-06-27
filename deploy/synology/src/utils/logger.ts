import * as winston from 'winston';

let loggerInstance: winston.Logger | null = null;

export function getLogger(moduleName: string): winston.Logger {
  if (!loggerInstance) {
    loggerInstance = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} ${level} ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
      ],
    });
  }

  return loggerInstance.child({ module: moduleName });
}

export function resetLogger(): void {
  loggerInstance = null;
}
