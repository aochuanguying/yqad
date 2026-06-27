/**
 * 车辆监控服务
 * 
 * 功能：
 * 1. 车辆登录认证和 Token 管理
 * 2. 定时获取车辆状态和位置
 * 3. 异常状态判定（车辆移动、门窗未关、设防状态等）
 * 4. Home Assistant 集成获取手机位置
 * 5. 安全距离计算和报警
 */

import * as path from 'path';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { sleep, randomDelay } from '../utils/retry';

const logger = getLogger('vehicle-monitor');

// ===================== 常量 =====================

const BASE_URL = 'https://ck.shjza.cn';
const APP_TYPE = 'audiAlone';
const APP_VERSION = '1.2.5';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Html5Plus/1.0 (Immersed/20) uni-app';

// 水箱温度哨兵值（熄火状态）
const WATER_TEMP_SENTINEL = 900;

// 油箱总容积（升）
const FUEL_TANK_CAPACITY_L = 73;

// 车门/车窗标签
const DOOR_LABELS = ['左前门', '右前门', '左后门', '右后门', '尾门', '前盖', '其它'];
const WINDOW_LABELS = ['左前窗', '右前窗', '左后窗', '右后窗', '天窗'];

// ===================== 类型定义 =====================

interface VehicleToken {
  token: string;
  lastUpdate?: string;
}

interface VehicleConfig {
  enabled: boolean;
  intervalMinutes: number;
  quickIntervalMinutes: number;
  safeDistanceMeters: number;
  alertPhone: string;
  haBaseUrl: string;
  haToken: string;
  deviceTrackerEntity: string;
  token: string;  // 直接使用 Token，避免登录踢出其他设备
  moveThresholdMeters: number;
  minBatteryVolt: number;
}

interface CarInfo {
  vin: string | null;
  plate: string | null;
  brand: string | null;
  series: string | null;
  seriesImg: string | null;
  modelName: string | null;
  machineId: string | null;
  isOnline: boolean;
}

interface OBDData {
  isOnline: boolean;
  isExpire: boolean;
  isDismantle: boolean;
  isDefence: boolean;
  oilLiters: number | null;
  oilPercent: number | null;
  enduranceMileage: number | null;
  currentMileage: number | null;
  batteryVolt: number | null;
  outsideTemp: number | null;
  interiorTemp: number | null;
  waterTemp: number | null;
  tirePressure: {
    fl: number | null;
    fr: number | null;
    rl: number | null;
    rr: number | null;
  };
  engineOn: boolean;
  brakeOn: boolean;
  carSpeed: number | null;
  engineSpeed: number | null;
  gearStatus: string | null;
  doors: Array<{ label: string; open: boolean; raw: number }>;
  windows: Array<{ label: string; open: boolean; raw: number }>;
  anyDoorOpen: boolean;
  anyWindowOpen: boolean;
}

interface LocationData {
  lng: number;
  lat: number;
  engineStatus: number | null;
}

interface VehicleState {
  carInfo: CarInfo | null;
  obd: OBDData | null;
  location: LocationData | null;
  lastLocation: LocationData | null;
  isAnomaly: boolean;
  anomalies: string[];
  lastCheckTime: string;
}

// ===================== MD5 工具函数 =====================

function md5(str: string): string {
  function rotl(n: number, c: number): number {
    return (n << c) | (n >>> (32 - c));
  }

  function toBytes(s: string): number[] {
    const utf8 = unescape(encodeURIComponent(s));
    const bytes: number[] = [];
    for (let i = 0; i < utf8.length; i++) {
      bytes.push(utf8.charCodeAt(i) & 0xff);
    }
    return bytes;
  }

  function toHex(num: number): string {
    let s = '';
    for (let i = 0; i < 4; i++) {
      s += ('0' + ((num >>> (i * 8)) & 0xff).toString(16)).slice(-2);
    }
    return s;
  }

  const bytes = toBytes(str);
  const origLenBits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 0; i < 4; i++) bytes.push((origLenBits >>> (i * 8)) & 0xff);
  for (let i = 0; i < 4; i++) bytes.push(0);

  const K: number[] = [];
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * Math.pow(2, 32)) >>> 0;
  }

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
    9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
    16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
    15, 21,
  ];

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let off = 0; off < bytes.length; off += 64) {
    const M: number[] = [];
    for (let i = 0; i < 16; i++) {
      M[i] =
        bytes[off + i * 4] |
        (bytes[off + i * 4 + 1] << 8) |
        (bytes[off + i * 4 + 2] << 16) |
        (bytes[off + i * 4 + 3] << 24);
    }
    let A = a0,
      B = b0,
      C = c0,
      D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, S[i])) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0);
}

// ===================== Token 存储 (Redis) =====================

// 懒加载 Redis 存储，避免在模块加载时初始化
let _vehicleTokenStorage: any = null;

function getVehicleTokenStorageLazy() {
  if (!_vehicleTokenStorage) {
    const { getVehicleTokenStorage } = require('../storage/redis/vehicle-token-storage');
    _vehicleTokenStorage = getVehicleTokenStorage();
  }
  return _vehicleTokenStorage;
}

async function loadVehicleToken(): Promise<VehicleToken | null> {
  try {
    const token = await getVehicleTokenStorageLazy().getToken();
    if (token) {
      return {
        token,
        lastUpdate: new Date().toISOString(),
      };
    }
  } catch (error) {
    logger.error('从 Redis 加载车辆 Token 失败:', error instanceof Error ? error.message : String(error));
  }
  return null;
}

async function saveVehicleToken(token: VehicleToken): Promise<void> {
  try {
    await getVehicleTokenStorageLazy().saveToken(token.token);
    logger.info('车辆 Token 已保存到 Redis');
  } catch (error) {
    logger.error('保存车辆 Token 到 Redis 失败:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// ===================== 网络请求封装 =====================

let _tokenInMemory = '';

async function getToken(): Promise<string> {
  if (_tokenInMemory) return _tokenInMemory;
  const tokenData = await loadVehicleToken();
  return tokenData?.token || '';
}

async function setToken(t: string): Promise<void> {
  _tokenInMemory = t;
  await saveVehicleToken({
    token: t,
    lastUpdate: new Date().toISOString(),
  });
}

/**
 * 更新车辆监控 Token（支持热加载）
 * @param newToken 新的 Token 字符串
 * @returns 是否更新成功
 */
export async function updateToken(newToken: string): Promise<boolean> {
  try {
    // 1. 基础验证
    if (!newToken || typeof newToken !== 'string' || newToken.trim() === '') {
      logger.error('Token 更新失败：Token 不能为空');
      return false;
    }

    // 2. 更新内存中的 Token（热加载）
    _tokenInMemory = newToken.trim();
    
    // 3. 保存到 Redis（等待完成）
    await saveVehicleToken({
      token: _tokenInMemory,
      lastUpdate: new Date().toISOString(),
    });

    logger.info('Token 已更新并热加载');
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Token 更新失败:', errorMsg);
    return false;
  }
}

function createVehicleAPI(): AxiosInstance {
  const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
      'accept': '*/*',
      'content-type': 'application/json;charset=utf-8',
      'accept-language': 'zh-CN,zh-Hans;q=0.9',
      'user-agent': UA,
    },
  });

  // 请求拦截器：自动添加 Token
  instance.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers['authorization'] = token;
    }
    return config;
  });

  return instance;
}

const vehicleAPI = createVehicleAPI();

// ===================== Token 验证 =====================

async function validateToken(): Promise<boolean> {
  const token = await getToken();
  if (!token) {
    console.log('[VehicleMonitor] Token 未配置，请通过 Web 界面"车辆监控配置"页面设置 Token，或使用 API 接口保存 Token 到 Redis/数据库');
    return false;
  }
  
  console.log('[VehicleMonitor] Token 长度:', token.length);
  console.log('[VehicleMonitor] Token 前 20 位:', token.substring(0, 20) + '...');
  
  // 验证 Token 是否有效
  try {
    console.log('[VehicleMonitor] 开始验证 Token...');
    const testResp = await vehicleAPI.get('/api/car/getNowCar');
    console.log('[VehicleMonitor] HTTP 状态码:', testResp.status);
    console.log('[VehicleMonitor] 响应状态:', testResp.data?.status);
    console.log('[VehicleMonitor] 响应消息:', testResp.data?.message);
    
    const respData = testResp.data;
    if (respData && respData.status === '200') {
      console.log('[VehicleMonitor] Token 验证成功');
      logger.info('Token 验证成功');
      return true;
    } else {
      console.log('[VehicleMonitor] Token 验证失败:', respData?.message || '未知错误', '业务状态:', respData?.status || '无');
      logger.error('Token 验证失败:', respData?.message || '未知错误', '业务状态:', respData?.status || '无');
      return false;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log('[VehicleMonitor] Token 验证异常:', errorMsg);
    logger.error('Token 验证异常:', errorMsg);
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as any;
      console.log('[VehicleMonitor] HTTP 状态:', axiosError.response?.status);
      console.log('[VehicleMonitor] 响应数据:', JSON.stringify(axiosError.response?.data));
    }
    return false;
  }
}

// ===================== 车辆数据获取 =====================

async function getNowCar(): Promise<CarInfo | null> {
  try {
    console.log('[VehicleMonitor] 请求车辆信息...');
    const response = await vehicleAPI.get('/api/car/getNowCar');
    console.log('[VehicleMonitor] 响应状态:', response.data?.status);
    console.log('[VehicleMonitor] 响应消息:', response.data?.message);
    
    // 注意：API 返回结构是 { status, message, data: { carInfo } }
    const responseData = response.data?.data;
    console.log('[VehicleMonitor] 有 carInfo:', !!responseData?.carInfo);
    
    if (response.data && response.data.status === '200' && responseData?.carInfo) {
      const carInfo = responseData.carInfo;
      console.log('[VehicleMonitor] 车辆信息获取成功:', carInfo.vehPlateNo);
      return {
        vin: carInfo.vehFrameNo || null,
        plate: carInfo.vehPlateNo || null,
        brand: carInfo.vehBrandName || null,
        series: carInfo.vehSeriesName || null,
        seriesImg: carInfo.vehSeriesImg || null,
        modelName: carInfo.vehInfoName || null,
        machineId: carInfo.machineId || null,
        isOnline: carInfo.isOnline === 1,
      };
    }
    console.log('[VehicleMonitor] 获取车辆信息失败:', response.data?.message || '未知错误');
    logger.error('获取车辆信息失败:', response.data?.message || '未知错误');
    return null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log('[VehicleMonitor] 获取车辆信息异常:', errorMsg);
    logger.error('获取车辆信息异常:', errorMsg);
    return null;
  }
}

async function getCarOBD(): Promise<OBDData | null> {
  try {
    const response = await vehicleAPI.get('/api/car/getCarOBD');
    // API 返回结构：{ status, message, data: { ...obd 数据 } }
    const obdData = response.data?.data;
    
    logger.info('OBD API 原始返回:', JSON.stringify(obdData, null, 2));
    
    if (response.data && response.data.status === '200' && obdData) {
      const obd = obdData;
      
      // 解码 OBD 数据
      const oilLiters = isFiniteNum(obd.realTimeOilLevel) ? Number(obd.realTimeOilLevel) : null;
      const oilPercent = oilLiters != null && FUEL_TANK_CAPACITY_L > 0
        ? Math.round((oilLiters / FUEL_TANK_CAPACITY_L) * 100)
        : null;

      const batteryVolt = isFiniteNum(obd.batteryVolta) ? obd.batteryVolta / 10 : null;
      const outsideTemp = isFiniteNum(obd.outsideTemperature) ? obd.outsideTemperature / 10 : null;
      const interiorTemp = isFiniteNum(obd.interiorTemperature) && obd.interiorTemperature !== 0
        ? obd.interiorTemperature / 10
        : null;
      const waterTemp = !isFiniteNum(obd.waterTemperature) || obd.waterTemperature === WATER_TEMP_SENTINEL
        ? null
        : obd.waterTemperature / 10;

      // 解码胎压
      const tp = splitNums(obd.tirePressure).map((v) => v / 10);
      
      // 解码门窗
      const doors = decodeBits(obd.carDoor, DOOR_LABELS);
      const windows = decodeBits(obd.carWindow, WINDOW_LABELS);

      const carLocation = num(obd.carLocation);
      const currentMileage = num(obd.currentMileage);
      
      logger.info('总里程数据:', { carLocation, currentMileage, finalValue: carLocation || currentMileage });

      return {
        isOnline: obd.isOnline === 1,
        isExpire: obd.isExpire === 1,
        isDismantle: obd.isDismantle === 1,
        isDefence: obd.isDefence === 1,
        oilLiters,
        oilPercent,
        enduranceMileage: num(obd.enduranceMileage),
        // 优先使用 carLocation，其次使用 currentMileage（参考 vehicle-widget.js）
        currentMileage: carLocation || currentMileage,
        batteryVolt,
        outsideTemp,
        interiorTemp,
        waterTemp,
        tirePressure: {
          fl: tp[0] != null ? tp[0] : null,
          fr: tp[1] != null ? tp[1] : null,
          rl: tp[2] != null ? tp[2] : null,
          rr: tp[3] != null ? tp[3] : null,
        },
        engineOn: obd.engineFlag === 1,
        brakeOn: obd.brakeFlag === 1,
        carSpeed: num(obd.carSpeed),
        engineSpeed: num(obd.engineSpeed),
        gearStatus: obd.gearStatus || null,
        doors,
        windows,
        anyDoorOpen: doors.some((d: { open: boolean }) => d.open),
        anyWindowOpen: windows.some((w: { open: boolean }) => w.open),
      };
    }
    logger.error('获取 OBD 数据失败:', response.data?.message || '未知错误');
    return null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('获取 OBD 数据异常:', errorMsg);
    return null;
  }
}

async function getLocation(machineId: string): Promise<LocationData | null> {
  if (!machineId) {
    logger.error('获取位置失败：缺少 machineId');
    return null;
  }

  try {
    const response = await vehicleAPI.get(`/api/trail/getLocation?machineId=${encodeURIComponent(machineId)}`);
    // API 返回结构：{ status, message, data: { location, locationMessage, engineStatus } }
    const locData = response.data?.data;
    
    if (response.data && response.data.status === '200' && locData?.location) {
      const loc = locData.location;
      return {
        lng: Number(loc.lng),
        lat: Number(loc.lat),
        engineStatus: locData.engineStatus || null,
      };
    }
    logger.error('获取位置失败:', response.data?.message || '未知错误');
    return null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('获取位置异常:', errorMsg);
    return null;
  }
}

// ===================== 辅助函数 =====================

function splitNums(s: string | null): number[] {
  if (s == null) return [];
  return String(s)
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '')
    .map((x) => Number(x));
}

function decodeBits(s: string | null, labels: string[]): Array<{ label: string; open: boolean; raw: number }> {
  const vals = splitNums(s);
  return vals.map((v, i) => ({
    label: labels[i] || '位' + (i + 1),
    open: v !== 0,
    raw: v,
  }));
}

function num(v: any): number | null {
  return isFiniteNum(v) ? Number(v) : null;
}

function isFiniteNum(v: any): boolean {
  return v != null && !isNaN(Number(v)) && isFinite(Number(v));
}

// ===================== Home Assistant 集成 =====================

async function getHADevicePosition(config: VehicleConfig): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `${config.haBaseUrl}/api/states/${config.deviceTrackerEntity}`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${config.haToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    if (response.data && response.data.attributes) {
      const attrs = response.data.attributes;
      if (attrs.latitude && attrs.longitude) {
        logger.debug(`获取到设备位置：${attrs.latitude}, ${attrs.longitude}`);
        return {
          lat: Number(attrs.latitude),
          lng: Number(attrs.longitude),
        };
      }
    }
    logger.error('Home Assistant 设备位置数据无效');
    return null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('获取 Home Assistant 设备位置失败:', errorMsg);
    return null;
  }
}

// ===================== Haversine 距离计算 =====================

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // 地球半径（米）
  
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // 返回距离（米）
}

// ===================== 异常判定 =====================

function checkAnomalies(state: VehicleState, config: VehicleConfig): string[] {
  const anomalies: string[] = [];

  if (!state.obd || !state.carInfo) {
    anomalies.push('车辆数据缺失');
    return anomalies;
  }

  // 1. 离线状态
  if (!state.carInfo.isOnline || !state.obd.isOnline) {
    anomalies.push('车辆离线');
  }

  // 2. 门窗未关
  if (state.obd.anyDoorOpen) {
    anomalies.push('车门未关');
  }
  if (state.obd.anyWindowOpen) {
    anomalies.push('车窗未关');
  }

  // 3. 设防状态异常（未设防且熄火）
  if (!state.obd.isDefence && !state.obd.engineOn) {
    anomalies.push('车辆未设防');
  }

  // 4. 电压异常
  if (state.obd.batteryVolt != null && state.obd.batteryVolt < config.minBatteryVolt) {
    anomalies.push(`电池电压过低 (${state.obd.batteryVolt}V)`);
  }

  // 5. 车辆移动检测
  if (state.location && state.lastLocation) {
    const distance = calculateDistance(
      state.lastLocation.lat,
      state.lastLocation.lng,
      state.location.lat,
      state.location.lng
    );
    if (distance > config.moveThresholdMeters) {
      anomalies.push(`车辆移动 (${Math.round(distance)}米)`);
    }
  }

  return anomalies;
}

// ===================== 报警通知 =====================

import { alertService } from './alert-service';

// 初始化告警服务（在模块加载时）
alertService.init().catch(error => {
  logger.error('初始化告警服务失败:', error instanceof Error ? error.message : String(error));
});

async function triggerAlert(config: VehicleConfig, anomalies: string[], location?: { lat: number; lng: number; address?: string }): Promise<void> {
  const reason = `车辆异常：${anomalies.join(', ')}`;
  logger.warn(`[ALERT] 触发报警：${reason}`);
  
  // 调用新的告警服务
  const result = await alertService.triggerAlert(anomalies, location);
  
  if (result.skipped) {
    logger.info(`[ALERT] 告警已跳过：${result.skipReason}`);
  } else if (result.success) {
    logger.info(`[ALERT] 告警通知成功`);
  } else {
    logger.error(`[ALERT] 告警通知失败`);
  }
}

// ===================== 主监控循环 =====================

let lastVehicleState: VehicleState | null = null;

export async function runVehicleMonitor(): Promise<void> {
  try {
    // 从数据库读取配置
    const { vehicleMonitorStorage } = await import('../storage/mysql/vehicle-monitor-storage');
    const vehicleConfig = await vehicleMonitorStorage.getConfig();
    
    logger.debug('车辆监控配置:', JSON.stringify(vehicleConfig, null, 2));
    
    // 检查是否启用
    if (!vehicleConfig || vehicleConfig.enabled === false) {
      logger.warn('车辆监控未启用，跳过', { hasConfig: !!vehicleConfig, enabled: vehicleConfig?.enabled });
      return;
    }

    logger.info('开始车辆监控...');

    // 1. 从数据库/Redis 加载 Token（如果内存和 Redis 中都没有）
    const currentToken = await getToken();
    logger.debug('当前 Token 状态:', {
      hasInMemory: !!_tokenInMemory,
      hasInRedis: !!(await loadVehicleToken())?.token,
      hasInDb: !!vehicleConfig.token,
      currentTokenLength: currentToken?.length || 0,
      dbTokenLength: vehicleConfig.token?.length || 0,
    });
    
    if (!currentToken && vehicleConfig.token) {
      logger.info('从数据库加载 Token');
      await setToken(vehicleConfig.token);
    }

    // 2. 验证 Token 有效性
    const tokenValid = await validateToken();
    if (!tokenValid) {
      logger.error('Token 无效，无法继续监控');
      return;
    }

    // 2. 获取车辆数据
    const carInfo = await getNowCar();
    const obd = await getCarOBD();
    
    let location: LocationData | null = null;
    if (carInfo && carInfo.machineId) {
      location = await getLocation(carInfo.machineId);
    }

    // 3. 构建车辆状态
    const currentState: VehicleState = {
      carInfo,
      obd,
      location,
      lastLocation: lastVehicleState?.location || null,
      isAnomaly: false,
      anomalies: [],
      lastCheckTime: new Date().toISOString(),
    };

    // 4. 异常判定
    const anomalies = checkAnomalies(currentState, vehicleConfig);
    currentState.isAnomaly = anomalies.length > 0;
    currentState.anomalies = anomalies;

    if (currentState.isAnomaly) {
      logger.warn(`检测到异常：${anomalies.join(', ')}`);
      
      // 5. 如果异常，获取手机位置并计算安全距离
      const devicePos = await getHADevicePosition(vehicleConfig);
      if (devicePos && location) {
        const distance = calculateDistance(
          location.lat,
          location.lng,
          devicePos.lat,
          devicePos.lng
        );
        
        logger.info(`车辆与手机距离：${Math.round(distance)}米`);
        
        if (distance > vehicleConfig.safeDistanceMeters) {
          logger.warn(`安全距离超标：${Math.round(distance)}米 > ${vehicleConfig.safeDistanceMeters}米`);
          await triggerAlert(vehicleConfig, anomalies, { lat: location.lat, lng: location.lng });
        } else {
          // 安全距离内也触发告警，但不包含位置信息
          await triggerAlert(vehicleConfig, anomalies);
        }
      } else {
        // 无法获取设备位置时，仍然触发告警
        await triggerAlert(vehicleConfig, anomalies, location ? { lat: location.lat, lng: location.lng } : undefined);
      }
    } else {
      logger.info('车辆状态正常');
    }

    // 6. 保存状态
    lastVehicleState = currentState;
    
    // 7. 更新服务状态（用于 Web 路由）
    vehicleMonitorService.updateStatus(currentState, new Date().toISOString());

    logger.info('车辆监控完成');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('车辆监控异常:', errorMsg);
  }
}

// ===================== 导出 =====================

export type { VehicleConfig, VehicleState };
export { calculateDistance, md5 };

// ===================== 车辆监控服务类（用于 Web 路由） =====================

interface AlertLog {
  type: string;
  message: string;
  timestamp: string;
  action?: string;
}

export class VehicleMonitorServiceClass {
  private lastStatus: VehicleState | null = null;
  private lastMonitorTime: string | null = null;
  private alertLogs: AlertLog[] = [];

  /**
   * 执行监控（包装 runVehicleMonitor）
   */
  async runMonitor(): Promise<void> {
    await runVehicleMonitor();
  }

  /**
   * 获取上次监控状态
   */
  getLastStatus(): VehicleState | null {
    return this.lastStatus;
  }

  /**
   * 获取上次监控时间
   */
  getLastMonitorTime(): string | null {
    return this.lastMonitorTime;
  }

  /**
   * 获取告警记录
   */
  getAlertLogs(limit: number = 10): AlertLog[] {
    return this.alertLogs.slice(-limit);
  }

  /**
   * 清空告警记录
   */
  clearAlertLogs(): void {
    this.alertLogs = [];
  }

  /**
   * 记录告警（供 runVehicleMonitor 调用）
   */
  recordAlert(log: AlertLog): void {
    this.alertLogs.push(log);
    // 保持最多 100 条记录
    if (this.alertLogs.length > 100) {
      this.alertLogs.shift();
    }
  }

  /**
   * 更新状态（供 runVehicleMonitor 调用）
   */
  updateStatus(status: VehicleState, time: string): void {
    this.lastStatus = status;
    this.lastMonitorTime = time;
  }

  /**
   * 获取手机设备位置（通过 Home Assistant）
   */
  async getDeviceLocation(): Promise<{ lat: number; lng: number } | null> {
    // 从数据库读取配置
    const { vehicleMonitorStorage } = await import('../storage/mysql/vehicle-monitor-storage');
    const vehicleConfig = await vehicleMonitorStorage.getConfig();
    
    if (!vehicleConfig?.haBaseUrl || !vehicleConfig?.haToken || !vehicleConfig?.deviceTrackerEntity) {
      logger.warn('Home Assistant 设备追踪未配置');
      return null;
    }
    
    return await getHADevicePosition(vehicleConfig);
  }
}

// 导出单例
export const vehicleMonitorService = new VehicleMonitorServiceClass();
