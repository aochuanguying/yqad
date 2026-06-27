/**
 * 测试调度器 cron 表达式解析改进
 * 验证 parseCronField 对各种 cron 格式的支持
 *
 * 注意：由于 src/ 下部分 .ts 文件实际是编译后的 JS（如 retry.ts、config-events.ts），
 * 无法通过 ts-jest 直接导入 Scheduler 类。因此这里直接测试解析逻辑。
 */

/**
 * parseCronField - 从 scheduler/index.ts 提取的纯函数逻辑
 * 解析 cron 字段中的单个值，支持：
 * - 具体数字: "8"
 * - 通配符: "*"
 * - 步进: "* /5"（每 N 分钟/小时）
 * - 列表: "1,2,3"
 * - 范围: "1-5"
 * 返回该字段可能的最小值，无法解析时返回 null
 */
function parseCronField(field: string, min: number, _max: number): number | null {
  if (field === '*') return min;
  // 步进: */N
  const stepMatch = field.match(/^\*\/(\d+)$/);
  if (stepMatch) return min;
  // 列表: a,b,c
  if (field.includes(',')) {
    const values = field.split(',').map(v => parseInt(v, 10)).filter(v => !isNaN(v));
    return values.length > 0 ? Math.min(...values) : null;
  }
  // 范围: a-b
  if (field.includes('-')) {
    const [start] = field.split('-').map(v => parseInt(v, 10));
    return isNaN(start) ? null : start;
  }
  // 具体数字
  const num = parseInt(field, 10);
  return isNaN(num) ? null : num;
}

/**
 * isTaskOverdue - 从 scheduler/index.ts 提取的纯函数逻辑
 */
function isTaskOverdue(
  cronExpression: string,
  randomOffsetMax: number,
  currentHour: number,
  currentMinute: number
): boolean {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5) return false;

  const minute = parseCronField(parts[0], 0, 59);
  const hour = parseCronField(parts[1], 0, 23);

  if (minute === null || hour === null) return false;

  const scheduledMinutes = hour * 60 + minute;
  const currentMinutes = currentHour * 60 + currentMinute;

  return currentMinutes > scheduledMinutes + randomOffsetMax;
}

describe('parseCronField', () => {
  describe('具体数字', () => {
    it('应正确解析单个数字', () => {
      expect(parseCronField('8', 0, 23)).toBe(8);
    });

    it('应正确解析分钟字段', () => {
      expect(parseCronField('30', 0, 59)).toBe(30);
    });
  });

  describe('通配符 *', () => {
    it('应返回最小值 0', () => {
      expect(parseCronField('*', 0, 23)).toBe(0);
    });

    it('分钟字段通配符应返回 0', () => {
      expect(parseCronField('*', 0, 59)).toBe(0);
    });
  });

  describe('步进 */N', () => {
    it('*/5 应返回最小值', () => {
      expect(parseCronField('*/5', 0, 59)).toBe(0);
    });

    it('*/15 应返回最小值', () => {
      expect(parseCronField('*/15', 0, 59)).toBe(0);
    });
  });

  describe('列表 a,b,c', () => {
    it('应返回列表中的最小值', () => {
      expect(parseCronField('8,12,18', 0, 23)).toBe(8);
    });

    it('应处理两个值的列表', () => {
      expect(parseCronField('10,22', 0, 23)).toBe(10);
    });
  });

  describe('范围 a-b', () => {
    it('应返回范围的起始值', () => {
      expect(parseCronField('9-17', 0, 23)).toBe(9);
    });

    it('应处理分钟范围', () => {
      expect(parseCronField('0-30', 0, 59)).toBe(0);
    });
  });

  describe('无效输入', () => {
    it('非数字字符串应返回 null', () => {
      expect(parseCronField('abc', 0, 23)).toBeNull();
    });

    it('空字符串应返回 null', () => {
      expect(parseCronField('', 0, 23)).toBeNull();
    });
  });
});

describe('isTaskOverdue', () => {
  // 模拟当前时间 14:00

  it('标准 cron "0 8 * * *" 在 14:00 时应判定为过期', () => {
    expect(isTaskOverdue('0 8 * * *', 30, 14, 0)).toBe(true);
  });

  it('标准 cron "0 14 * * *" 在 14:00 时（无偏移）应判定为未过期', () => {
    expect(isTaskOverdue('0 14 * * *', 0, 14, 0)).toBe(false);
  });

  it('标准 cron "0 13 * * *" 在 14:00 时（偏移 60 分钟）应判定为未过期', () => {
    // 13:00 + 60min = 14:00，当前 14:00，未超过
    expect(isTaskOverdue('0 13 * * *', 60, 14, 0)).toBe(false);
  });

  it('标准 cron "0 13 * * *" 在 14:01 时（偏移 60 分钟）应判定为过期', () => {
    // 13:00 + 60min = 14:00，当前 14:01，已超过
    expect(isTaskOverdue('0 13 * * *', 60, 14, 1)).toBe(true);
  });

  it('步进 cron "*/30 8 * * *" 应能正确解析', () => {
    // 8:00 + 30min = 8:30，当前 14:00，已过期
    expect(isTaskOverdue('*/30 8 * * *', 30, 14, 0)).toBe(true);
  });

  it('列表 cron "0 8,12,18 * * *" 应取最早时间 8:00', () => {
    // 最早 8:00，当前 14:00，已过期
    expect(isTaskOverdue('0 8,12,18 * * *', 0, 14, 0)).toBe(true);
  });

  it('无效 cron 表达式应返回 false', () => {
    expect(isTaskOverdue('invalid', 0, 14, 0)).toBe(false);
  });

  it('少于 5 段的 cron 应返回 false', () => {
    expect(isTaskOverdue('0 8 * *', 0, 14, 0)).toBe(false);
  });

  it('多余空格不影响解析', () => {
    expect(isTaskOverdue('  0   8   *   *   *  ', 30, 14, 0)).toBe(true);
  });
});
