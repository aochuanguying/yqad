/**
 * 告警通知服务
 * 
 * 负责车辆监控异常的告警通知，包括：
 * 1. 短信 + 电话双重通知
 * 2. 告警冷却机制（30 分钟）
 * 3. 告警历史记录
 */

import { telecomClient, TelecomConfig, MobileServiceConfig } from './telecom-client';
import { getLogger } from '../utils/logger';

const logger = getLogger('alert-service');

// ===================== 常量 =====================

const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 分钟冷却时间
const SMS_CALL_INTERVAL_MS = 5000; // 5 秒短信电话间隔
const MAX_ALERT_HISTORY = 100; // 最多保留 100 条历史记录

// ===================== 类型定义 =====================

export type AlertStatus = 'success' | 'failed' | 'timeout';

export interface AlertRecord {
  timestamp: string; // ISO 8601 格式
  anomalies: string[]; // 异常类型列表
  notificationType: 'sms' | 'call' | 'both'; // 通知方式
  smsStatus?: AlertStatus; // 短信状态
  callStatus?: AlertStatus; // 电话状态
  phone: string; // 接收人手机号（掩码）
}

export interface AlertStats {
  todayCount: number; // 今日告警次数
  weekCount: number; // 本周告警次数
  topAnomalies: { type: string; count: number }[]; // 最常见异常类型
}

export interface TriggerAlertResult {
  success: boolean;
  smsResult?: { success: boolean; message?: string; error?: string };
  callResult?: { success: boolean; message?: string; error?: string };
  skipped?: boolean;
  skipReason?: string;
}

// ===================== 告警服务类 =====================

class AlertService {
  private lastAlertTime: number = 0;
  private alertHistory: AlertRecord[] = [];
  private telecomConfig: TelecomConfig | null = null;
  private serviceConfig: MobileServiceConfig | null = null;

  /**
   * 初始化告警服务
   */
  async init(): Promise<void> {
    try {
      const { telecomApiStorage } = await import('../storage/mysql/telecom-api-storage');
      const { mobileServiceConfigStorage } = await import('../storage/mysql/mobile-service-config-storage');
      
      const telecomConfig = await telecomApiStorage.getConfig();
      const serviceConfig = await mobileServiceConfigStorage.getConfig();
      
      // 检查配置是否完整（mobile_service_config 表没有 enabled 字段）
      if (telecomConfig && telecomConfig.alertPhone && serviceConfig && serviceConfig.apiUrl && serviceConfig.apiToken) {
        this.telecomConfig = telecomConfig;
        this.serviceConfig = serviceConfig;
        telecomClient.init(telecomConfig, serviceConfig);
        logger.info('告警服务已初始化', { 
          apiUrl: serviceConfig.apiUrl,
          alertPhone: telecomConfig.alertPhone 
        });
      } else {
        logger.warn('告警服务未配置或配置不完整');
      }
    } catch (error) {
      logger.error('初始化告警服务失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 重新加载配置（支持热重载）
   */
  async reloadConfig(): Promise<void> {
    try {
      const { telecomApiStorage } = await import('../storage/mysql/telecom-api-storage');
      const { mobileServiceConfigStorage } = await import('../storage/mysql/mobile-service-config-storage');
      
      const telecomConfig = await telecomApiStorage.getConfig();
      const serviceConfig = await mobileServiceConfigStorage.getConfig();
      
      // 检查配置是否完整（mobile_service_config 表没有 enabled 字段）
      if (telecomConfig && telecomConfig.alertPhone && serviceConfig && serviceConfig.apiUrl && serviceConfig.apiToken) {
        const oldServiceConfig = this.serviceConfig;
        this.telecomConfig = telecomConfig;
        this.serviceConfig = serviceConfig;
        
        // 如果配置发生变化，重新初始化客户端
        if (!oldServiceConfig || oldServiceConfig.apiUrl !== serviceConfig.apiUrl || oldServiceConfig.apiToken !== serviceConfig.apiToken) {
          telecomClient.init(telecomConfig, serviceConfig);
          logger.info('告警服务配置已更新');
        }
      } else {
        this.telecomConfig = null;
        this.serviceConfig = null;
        logger.warn('告警服务配置未配置或不完整');
      }
    } catch (error) {
      logger.error('重新加载告警服务配置失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 检查配置是否有效
   */
  isConfigured(): boolean {
    return telecomClient.isConfigured();
  }

  /**
   * 触发告警通知
   * @param anomalies 异常类型列表
   * @param location 车辆位置信息（可选）
   */
  async triggerAlert(anomalies: string[], location?: { lat: number; lng: number; address?: string }): Promise<TriggerAlertResult> {
    // 检查配置
    if (!this.isConfigured() || !this.telecomConfig || !this.serviceConfig) {
      logger.warn('Telecom API 未配置，跳过告警通知');
      return { 
        success: false, 
        skipped: true, 
        skipReason: 'Telecom API 未配置' 
      };
    }

    // 检查冷却时间
    const now = Date.now();
    if (now - this.lastAlertTime < ALERT_COOLDOWN_MS) {
      const minutesLeft = Math.round((ALERT_COOLDOWN_MS - (now - this.lastAlertTime)) / 60000);
      logger.info(`告警冷却中，距离下次告警还有 ${minutesLeft} 分钟`);
      return { 
        success: false, 
        skipped: true, 
        skipReason: `冷却时间剩余 ${minutesLeft} 分钟` 
      };
    }

    logger.warn(`触发告警通知：${anomalies.join(', ')}`);

    const result: TriggerAlertResult = {
      success: false,
    };

    // 构造短信内容
    const smsContent = this.buildSmsContent(anomalies, location);

    // 1. 发送短信
    logger.info('开始发送告警短信');
    const smsResult = await telecomClient.sendSms(this.telecomConfig.alertPhone, smsContent);
    result.smsResult = smsResult;

    // 记录短信状态
    const smsStatus: AlertStatus = smsResult.success ? 'success' : (smsResult.error?.includes('超时') ? 'timeout' : 'failed');

    // 等待 5 秒间隔
    if (smsResult.success) {
      logger.info('短信发送成功，等待 5 秒后拨打电话');
      await this.sleep(SMS_CALL_INTERVAL_MS);
    }

    // 2. 拨打电话（无论短信是否成功都尝试）
    logger.info('开始拨打告警电话');
    const callResult = await telecomClient.makePhoneCall(this.telecomConfig.alertPhone);
    result.callResult = callResult;

    // 记录电话状态
    const callStatus: AlertStatus = callResult.success ? 'success' : (callResult.error?.includes('超时') ? 'timeout' : 'failed');

    // 更新冷却时间
    this.lastAlertTime = now;
    logger.info(`告警通知完成，冷却时间 30 分钟`);

    // 记录告警历史
    this.recordAlert(anomalies, smsStatus, callStatus);

    // 判断总体成功
    result.success = smsResult.success || callResult.success;

    return result;
  }

  /**
   * 获取告警历史记录
   * @param limit 返回数量限制
   */
  getAlertHistory(limit: number = 10): AlertRecord[] {
    return this.alertHistory.slice(-limit).reverse(); // 倒序返回，最新的在前
  }

  /**
   * 获取告警统计信息
   */
  getAlertStats(): AlertStats {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // 周一为起点
    weekStart.setHours(0, 0, 0, 0);

    let todayCount = 0;
    let weekCount = 0;
    const anomalyCountMap = new Map<string, number>();

    for (const record of this.alertHistory) {
      const recordTime = new Date(record.timestamp);
      
      if (recordTime >= todayStart) {
        todayCount++;
      }
      if (recordTime >= weekStart) {
        weekCount++;
      }

      // 统计异常类型
      for (const anomaly of record.anomalies) {
        anomalyCountMap.set(anomaly, (anomalyCountMap.get(anomaly) || 0) + 1);
      }
    }

    // 找出最常见的 3 种异常类型
    const topAnomalies = Array.from(anomalyCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));

    return {
      todayCount,
      weekCount,
      topAnomalies,
    };
  }

  /**
   * 构造短信内容
   */
  private buildSmsContent(anomalies: string[], location?: { lat: number; lng: number; address?: string }): string {
    const timestamp = new Date().toLocaleString('zh-CN');
    let content = `【车辆告警】${timestamp}\n异常：${anomalies.join(', ')}`;

    if (location && location.address) {
      content += `\n位置：${location.address}`;
    } else if (location) {
      content += `\n位置：${location.lat.toFixed(6)},${location.lng.toFixed(6)}`;
    }

    content += '\n请及时查看！';
    return content;
  }

  /**
   * 记录告警历史
   */
  private recordAlert(anomalies: string[], smsStatus: AlertStatus, callStatus: AlertStatus): void {
    const notificationType = smsStatus === 'success' && callStatus === 'success' ? 'both' : 
                             smsStatus === 'success' ? 'sms' : 'call';

    const record: AlertRecord = {
      timestamp: new Date().toISOString(),
      anomalies,
      notificationType,
      smsStatus,
      callStatus,
      phone: this.maskPhone(this.telecomConfig?.alertPhone || ''),
    };

    this.alertHistory.push(record);
    logger.debug('告警记录已保存', record);

    // 限制历史记录数量
    if (this.alertHistory.length > MAX_ALERT_HISTORY) {
      this.alertHistory.shift(); // 删除最早的记录
    }
  }

  /**
   * 手机号掩码处理（显示前 3 位和后 4 位）
   */
  private maskPhone(phone: string): string {
    if (!phone || phone.length !== 11) {
      return phone;
    }
    return phone.substring(0, 3) + '****' + phone.substring(7);
  }

  /**
   * 延时辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===================== 单例导出 =====================

export const alertService = new AlertService();
export default alertService;
