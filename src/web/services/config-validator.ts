/**
 * 配置验证器
 * 对各分组的配置值进行类型检查、数值范围和格式校验
 */

// 简单的 cron 表达式验证（5段格式）
function isValidCron(expression: string): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const ranges = [
    { min: 0, max: 59 },  // 分钟
    { min: 0, max: 23 },  // 小时
    { min: 1, max: 31 },  // 日
    { min: 1, max: 12 },  // 月
    { min: 0, max: 7 },   // 星期
  ];

  for (let i = 0; i < 5; i++) {
    const part = parts[i];
    if (part === '*') continue;

    // 支持 */n 格式
    if (/^\*\/\d+$/.test(part)) continue;

    // 支持逗号分隔的值
    const values = part.split(',');
    for (const val of values) {
      // 支持范围 n-m
      if (/^\d+-\d+$/.test(val)) {
        const [start, end] = val.split('-').map(Number);
        if (start < ranges[i].min || end > ranges[i].max || start > end) return false;
        continue;
      }

      const num = parseInt(val, 10);
      if (isNaN(num) || num < ranges[i].min || num > ranges[i].max) return false;
    }
  }

  return true;
}

function requireString(value: any, field: string): string | null {
  if (typeof value !== 'string') return `${field} 必须是字符串`;
  return null;
}

function requireNumber(value: any, field: string, min?: number, max?: number): string | null {
  // 自动转换字符串为数字（如果是有效数字）
  if (typeof value === 'string') {
    const num = Number(value);
    if (!isNaN(num)) {
      value = num;
    }
  }
  if (typeof value !== 'number' || isNaN(value)) return `${field} 必须是数字`;
  if (min !== undefined && value < min) return `${field} 不能小于 ${min}`;
  if (max !== undefined && value > max) return `${field} 不能大于 ${max}`;
  return null;
}

function requireBoolean(value: any, field: string): string | null {
  if (typeof value !== 'boolean') return `${field} 必须是布尔值`;
  return null;
}

const validators: Record<string, (data: any) => string | null> = {
  api(data) {
    if (!data || typeof data !== 'object') return 'api 配置无效';
    if (!['mock', 'real'].includes(data.mode)) return 'api.mode 必须是 "mock" 或 "real"';
    let err = requireString(data.baseUrl, 'api.baseUrl');
    if (err) return err;
    err = requireNumber(data.timeout, 'api.timeout', 1000, 60000);
    if (err) return err;
    return null;
  },

  auth(data) {
    if (!data || typeof data !== 'object') return 'auth 配置无效';
    // 只验证存在的字段（支持部分更新）
    if (data.username !== undefined) {
      const err = requireString(data.username, 'auth.username');
      if (err) return err;
    }
    if (data.password !== undefined) {
      const err = requireString(data.password, 'auth.password');
      if (err) return err;
    }
    return null;
  },

  ai(data) {
    if (!data || typeof data !== 'object') return 'ai 配置无效';

    // 支持 providers 数组格式（新格式）
    if (Array.isArray(data.providers) && data.providers.length > 0) {
      for (let i = 0; i < data.providers.length; i++) {
        const provider = data.providers[i];
        if (!provider || typeof provider !== 'object') return `ai.providers[${i}] 配置无效`;
        let err = requireString(provider.name, `ai.providers[${i}].name`);
        if (err) return err;
        err = requireString(provider.apiKey, `ai.providers[${i}].apiKey`);
        if (err) return err;
        err = requireString(provider.baseUrl, `ai.providers[${i}].baseUrl`);
        if (err) return err;
        err = requireString(provider.model, `ai.providers[${i}].model`);
        if (err) return err;
        if (provider.temperature !== undefined) {
          err = requireNumber(provider.temperature, `ai.providers[${i}].temperature`, 0, 2);
          if (err) return err;
        }
        if (provider.maxTokens !== undefined) {
          err = requireNumber(provider.maxTokens, `ai.providers[${i}].maxTokens`, 1, 100000);
          if (err) return err;
        }
      }
      return null;
    }

    // 兼容旧的顶层字段格式
    if (data.apiKey !== undefined) {
      let err = requireString(data.apiKey, 'ai.apiKey');
      if (err) return err;
    }
    if (data.baseUrl !== undefined) {
      let err = requireString(data.baseUrl, 'ai.baseUrl');
      if (err) return err;
    }
    if (data.model !== undefined) {
      let err = requireString(data.model, 'ai.model');
      if (err) return err;
    }
    if (data.temperature !== undefined) {
      let err = requireNumber(data.temperature, 'ai.temperature', 0, 2);
      if (err) return err;
    }
    if (data.maxTokens !== undefined) {
      let err = requireNumber(data.maxTokens, 'ai.maxTokens', 1, 100000);
      if (err) return err;
    }
    return null;
  },

  comment(data) {
    if (!data || typeof data !== 'object') return 'comment 配置无效';
    let err = requireBoolean(data.enabled, 'comment.enabled');
    if (err) return err;
    err = requireNumber(data.dailyLimit, 'comment.dailyLimit', 1, 50);
    if (err) return err;
    err = requireNumber(data.delayMin, 'comment.delayMin', 0, 3600);
    if (err) return err;
    err = requireNumber(data.delayMax, 'comment.delayMax', 0, 3600);
    if (err) return err;
    if (data.delayMin > data.delayMax) return 'comment.delayMin 不能大于 comment.delayMax';
    return null;
  },



  featuredPosting(data) {
    if (!data || typeof data !== 'object') return 'featuredPosting 配置无效';
    let err = requireBoolean(data.enabled, 'featuredPosting.enabled');
    if (err) return err;
    err = requireNumber(data.minContentChars, 'featuredPosting.minContentChars', 1, 10000);
    if (err) return err;
    err = requireNumber(data.minImages, 'featuredPosting.minImages', 0, 9);
    if (err) return err;
    err = requireNumber(data.maxImages, 'featuredPosting.maxImages', 0, 9);
    if (err) return err;
    err = requireNumber(data.maxGenerateRetries, 'featuredPosting.maxGenerateRetries', 0, 10);
    if (err) return err;
    err = requireNumber(data.maxImageUploadRetries, 'featuredPosting.maxImageUploadRetries', 0, 10);
    if (err) return err;
    return null;
  },

  scheduler(data) {
    if (!data || typeof data !== 'object') return 'scheduler 配置无效';
    
    // 自动补全缺失的子对象（向后兼容）
    if (!data.comment) data.comment = {};
    if (!data.materialProcessing) data.materialProcessing = {};
    
    // 验证 comment 任务（仅 Cron 模式）
    if (data.comment && Object.keys(data.comment).length > 0) {
      const task = data.comment;
      if (task.cron !== undefined) {
        if (!isValidCron(task.cron)) {
          return `scheduler.comment.cron 格式无效："${task.cron}"`;
        }
        if (task.randomOffsetMin !== undefined) {
          let err = requireNumber(task.randomOffsetMin, 'scheduler.comment.randomOffsetMin', 0, 1440);
          if (err) return err;
          if (task.randomOffsetMax !== undefined && task.randomOffsetMin > task.randomOffsetMax) {
            return 'scheduler.comment.randomOffsetMin 不能大于 randomOffsetMax';
          }
        }
        if (task.randomOffsetMax !== undefined) {
          const err = requireNumber(task.randomOffsetMax, 'scheduler.comment.randomOffsetMax', 0, 1440);
          if (err) return err;
        }
      }
    }
    

    
    // 验证 materialProcessing 任务（支持 Cron 和 Interval 两种模式）
    if (data.materialProcessing && Object.keys(data.materialProcessing).length > 0) {
      const task = data.materialProcessing;
      
      // 检查是否使用间隔模式
      if (typeof task.intervalMinutes === 'number') {
        // 间隔模式验证
        if (task.intervalMinutes < 5 || task.intervalMinutes > 1440) {
          return 'scheduler.materialProcessing.intervalMinutes 必须在 5-1440 分钟之间';
        }
        if (task.enabled !== undefined && typeof task.enabled !== 'boolean') {
          return 'scheduler.materialProcessing.enabled 必须是布尔值';
        }
      } else if (task.cron !== undefined) {
        // Cron 模式验证（向后兼容）
        if (!isValidCron(task.cron)) {
          return `scheduler.materialProcessing.cron 格式无效："${task.cron}"`;
        }
        if (task.randomOffsetMin !== undefined) {
          let err = requireNumber(task.randomOffsetMin, 'scheduler.materialProcessing.randomOffsetMin', 0, 1440);
          if (err) return err;
          if (task.randomOffsetMax !== undefined && task.randomOffsetMin > task.randomOffsetMax) {
            return 'scheduler.materialProcessing.randomOffsetMin 不能大于 randomOffsetMax';
          }
        }
        if (task.randomOffsetMax !== undefined) {
          const err = requireNumber(task.randomOffsetMax, 'scheduler.materialProcessing.randomOffsetMax', 0, 1440);
          if (err) return err;
        }
      }
    }
    
    return null;
  },

  web(data) {
    if (!data || typeof data !== 'object') return 'web 配置无效';
    let err = requireBoolean(data.enabled, 'web.enabled');
    if (err) return err;
    err = requireNumber(data.port, 'web.port', 1, 65535);
    if (err) return err;
    return null;
  },

  materials(data) {
    if (!data || typeof data !== 'object') return 'materials 配置无效';
    const hasProcessedPath = typeof data.processedPath === 'string' && data.processedPath.trim().length > 0;
    const hasBasePath = typeof data.basePath === 'string' && data.basePath.trim().length > 0;
    if (!hasProcessedPath && !hasBasePath) {
      return 'materials.processedPath 或 materials.basePath 必须配置';
    }

    if (hasBasePath) {
      let err = requireString(data.basePath, 'materials.basePath');
      if (err) return err;
    }
    if (hasProcessedPath) {
      let err = requireString(data.processedPath, 'materials.processedPath');
      if (err) return err;
    }
    if (data.rawPath !== undefined) {
      let err = requireString(data.rawPath, 'materials.rawPath');
      if (err) return err;
    }
    if (data.processing !== undefined) {
      const p = data.processing;
      if (!p || typeof p !== 'object') return 'materials.processing 配置无效';
      let err = requireBoolean(p.enabled, 'materials.processing.enabled');
      if (err) return err;
      err = requireString(p.outputFormat, 'materials.processing.outputFormat');
      if (err) return err;
      if (p.outputFormat !== 'jpeg') return 'materials.processing.outputFormat 目前仅支持 jpeg';
      err = requireNumber(p.jpegQuality, 'materials.processing.jpegQuality', 1, 100);
      if (err) return err;
      err = requireBoolean(p.enableVision, 'materials.processing.enableVision');
      if (err) return err;
      err = requireNumber(p.maxFilesPerRun, 'materials.processing.maxFilesPerRun', 1, 100000);
      if (err) return err;
      if (p.heicFallback !== undefined) {
        if (!p.heicFallback || typeof p.heicFallback !== 'object') {
          return 'materials.processing.heicFallback 配置无效';
        }
        err = requireBoolean(p.heicFallback.enabled, 'materials.processing.heicFallback.enabled');
        if (err) return err;
        err = requireString(p.heicFallback.command, 'materials.processing.heicFallback.command');
        if (err) return err;
        err = requireNumber(p.heicFallback.timeoutMs, 'materials.processing.heicFallback.timeoutMs', 1000, 300000);
        if (err) return err;
      }
    }
    return null;
  },

  contentLimits(data) {
    if (!data || typeof data !== 'object') return 'contentLimits 配置无效';

    for (const type of ['comment', 'post']) {
      const limits = data[type];
      if (!limits || typeof limits !== 'object') return `contentLimits.${type} 配置无效`;
      let err = requireNumber(limits.min, `contentLimits.${type}.min`, 1, 10000);
      if (err) return err;
      err = requireNumber(limits.max, `contentLimits.${type}.max`, 1, 10000);
      if (err) return err;
      if (limits.min > limits.max) {
        return `contentLimits.${type}.min 不能大于 contentLimits.${type}.max`;
      }
    }
    return null;
  },

  vehicleMonitor(data) {
    if (!data || typeof data !== 'object') return 'vehicleMonitor 配置无效';
    let err = requireBoolean(data.enabled, 'vehicleMonitor.enabled');
    if (err) return err;
    err = requireNumber(data.intervalMinutes, 'vehicleMonitor.intervalMinutes', 1, 1440);
    if (err) return err;
    err = requireNumber(data.quickIntervalMinutes, 'vehicleMonitor.quickIntervalMinutes', 1, 1440);
    if (err) return err;
    err = requireNumber(data.safeDistanceMeters, 'vehicleMonitor.safeDistanceMeters', 1, 10000);
    if (err) return err;
    err = requireNumber(data.moveThresholdMeters, 'vehicleMonitor.moveThresholdMeters', 1, 1000);
    if (err) return err;
    err = requireNumber(data.minBatteryVolt, 'vehicleMonitor.minBatteryVolt', 0, 100);
    if (err) return err;
    if (data.alertPhone !== undefined) {
      err = requireString(data.alertPhone, 'vehicleMonitor.alertPhone');
      if (err) return err;
    }
    if (data.haBaseUrl !== undefined) {
      err = requireString(data.haBaseUrl, 'vehicleMonitor.haBaseUrl');
      if (err) return err;
    }
    if (data.haToken !== undefined) {
      err = requireString(data.haToken, 'vehicleMonitor.haToken');
      if (err) return err;
    }
    if (data.deviceTrackerEntity !== undefined) {
      err = requireString(data.deviceTrackerEntity, 'vehicleMonitor.deviceTrackerEntity');
      if (err) return err;
    }
    if (data.token !== undefined) {
      err = requireString(data.token, 'vehicleMonitor.token');
      if (err) return err;
    }
    return null;
  },
};

/**
 * 验证指定分组的配置
 * @returns 验证错误信息，null 表示通过
 */
export function validateConfigGroup(group: string, data: any): string | null {
  const validator = validators[group];
  if (!validator) {
    return `未知的配置分组: ${group}`;
  }
  return validator(data);
}
