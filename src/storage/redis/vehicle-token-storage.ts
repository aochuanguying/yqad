/**
 * 车辆监控 Token Redis 存储
 */

import { getRedisClient } from '../../utils/redis-connection-manager';
import { getLogger } from '../../utils/logger';

const logger = getLogger('vehicle-token-storage');

const VEHICLE_TOKEN_KEY = 'vehicle:token';

export class VehicleTokenStorage {
  private redis = getRedisClient();

  /**
   * 保存车辆 Token
   */
  async saveToken(token: string): Promise<void> {
    try {
      await this.redis.set(VEHICLE_TOKEN_KEY, token);
      logger.debug('车辆 Token 已保存到 Redis');
    } catch (error: any) {
      logger.error(`保存车辆 Token 失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 获取车辆 Token
   */
  async getToken(): Promise<string | null> {
    try {
      return await this.redis.get(VEHICLE_TOKEN_KEY);
    } catch (error: any) {
      logger.error(`获取车辆 Token 失败：${error.message}`);
      return null;
    }
  }

  /**
   * 删除车辆 Token
   */
  async deleteToken(): Promise<void> {
    try {
      await this.redis.del(VEHICLE_TOKEN_KEY);
      logger.debug('车辆 Token 已删除');
    } catch (error: any) {
      logger.error(`删除车辆 Token 失败：${error.message}`);
    }
  }

  /**
   * 检查 Token 是否存在
   */
  async hasToken(): Promise<boolean> {
    try {
      const exists = await this.redis.exists(VEHICLE_TOKEN_KEY);
      return exists === 1;
    } catch (error: any) {
      logger.error(`检查 Token 失败：${error.message}`);
      return false;
    }
  }
}

let instance: VehicleTokenStorage | null = null;
export const getVehicleTokenStorage = (): VehicleTokenStorage => {
  if (!instance) instance = new VehicleTokenStorage();
  return instance;
};
