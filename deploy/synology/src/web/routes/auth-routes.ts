/**
 * 认证路由
 * 
 * 提供登录、登出、状态查询等认证相关接口
 */

import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import axios from 'axios';
import { loadConfig } from '../../utils/config';
import { getLogger } from '../../utils/logger';
import { logLoginSuccess, logLoginFailed } from '../middleware/auth-middleware';
import { getAuthService } from '../services/auth-instance';
import { getMemberService } from '../../services/member-service';

const logger = getLogger('auth-routes');
const router = Router();
const memberService = getMemberService();

/**
 * POST /api/auth/send-code
 * 发送短信验证码（需腾讯滑块 ticket）
 */
router.post('/send-code', async (req: Request, res: Response) => {
  try {
    const { phone, ticket } = req.body;
    
    if (!phone || phone.length !== 11) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的 11 位手机号',
      });
    }
    
    if (!ticket) {
      return res.status(400).json({
        code: 400,
        message: '缺少滑块验证 ticket',
      });
    }
    
    const config = loadConfig();
    if (config.api.mode !== 'real') {
      return res.status(400).json({
        code: 400,
        message: '仅 real 模式支持登录',
      });
    }
    
    const { authService: auth, api } = await getAuthService();
    
    if (!api) {
      return res.status(500).json({
        code: 500,
        message: 'API 客户端未初始化为 real 模式',
      });
    }
    
    const success = await api.sendSmsCode(phone, ticket);
    
    if (success) {
      res.json({
        code: 0,
        message: '验证码已发送',
      });
    } else {
      res.status(500).json({
        code: 500,
        message: '验证码发送失败',
      });
    }
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`发送验证码失败：${msg}`);
    res.status(500).json({
      code: 500,
      message: msg,
    });
  }
});

/**
 * POST /api/auth/login
 * 用户登录接口（支持用户名密码登录和手机号验证码登录）
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const authConfig = config.web.auth;
    const { username, password, phone, code } = req.body;
    
    // 调试日志：查看请求体
    logger.debug(`登录请求体：username=${username}, password=${password ? '***' : 'undefined'}, phone=${phone}, code=${code ? '***' : 'undefined'}`);
    
    // 检查是否是手机号验证码登录（需要同时提供手机号和验证码）
    const isPhoneLogin = phone && typeof phone === 'string' && phone.length === 11 && code;
    
    logger.debug(`是否是手机号登录：${isPhoneLogin}`);
    
    if (isPhoneLogin) {
      // 手机号验证码登录
      if (config.api.mode !== 'real') {
        return res.status(400).json({
          code: 'INVALID_MODE',
          message: '仅 real 模式支持手机号登录',
        });
      }
      
      const { authService: auth, api } = await getAuthService();
      
      if (!api) {
        return res.status(500).json({
          code: 'CONFIG_ERROR',
          message: 'API 客户端未初始化为 real 模式',
        });
      }
      
      // 调用真实登录 API
      const loginResponse = await api.login(phone, code);
      
      // 保存到 AuthService
      auth.saveLoginToken(loginResponse.access_token, loginResponse.expires_in);
      
      res.json({
        code: 0,
        message: '登录成功',
        data: {
          tokenStatus: auth.getTokenStatus(),
        },
      });
      return;
    }
    
    // 用户名密码登录（Web 管理界面登录）
    // 验证必填字段
    if (!username || !password) {
      logger.warn('登录失败：用户名或密码为空');
      res.status(400).json({
        code: 'INVALID_INPUT',
        message: '用户名和密码不能为空',
      });
      return;
    }
    
    // 使用数据库认证
    logger.info(`尝试验证用户：${username}`);
    const member = await memberService.authenticate(username, password);
    
    if (!member) {
      logLoginFailed(req, username, '用户名或密码错误');
      res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: '用户名或密码错误',
      });
      return;
    }
    
    // 登录成功，设置 Session
    const session = req.session as any;
    session.authenticated = true;
    session.username = member.username;
    session.userId = member.id;
    session.loginTime = new Date().toISOString();
    
    logLoginSuccess(req, member.username);
    
    logger.info(`Session 已创建：${session.id} - 用户：${member.username}`);
    
    // 使用 Promise 包装 session.save，确保在响应之前完成保存
    await new Promise<void>((resolve, reject) => {
      session.save((err: any) => {
        if (err) {
          logger.error(`Session 保存失败：${err.message}`);
          reject(err);
        } else {
          logger.debug(`Session 保存成功：${session.id}`);
          resolve();
        }
      });
    });
    
    res.json({
      code: 'SUCCESS',
      message: '登录成功',
      data: {
        username,
        loginTime: session.loginTime,
      },
    });
  } catch (error: any) {
    logger.error(`登录处理异常：${error.message}`);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
});

/**
 * POST /api/auth/logout
 * 用户登出接口
 */
router.post('/logout', (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const username = session.username || 'unknown';
    
    // 销毁 Session
    req.session.destroy((err: any) => {
      if (err) {
        logger.error(`登出失败：${err.message}`);
        res.status(500).json({
          code: 'LOGOUT_ERROR',
          message: '登出失败',
        });
        return;
      }
      
      logger.info(`[AUTH] 登出成功 - 用户：${username} - IP: ${getClientIP(req)}`);
      
      res.json({
        code: 'SUCCESS',
        message: '登出成功',
      });
    });
  } catch (error: any) {
    logger.error(`登出处理异常：${error.message}`);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
});

/**
 * GET /api/auth/status
 * 查询当前登录状态（Session）
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const isAuthenticated = session && session.authenticated === true;
    
    if (isAuthenticated) {
      res.json({
        code: 'SUCCESS',
        data: {
          authenticated: true,
          username: session.username,
          loginTime: session.loginTime || null,
        },
      });
    } else {
      res.json({
        code: 'SUCCESS',
        data: {
          authenticated: false,
        },
      });
    }
  } catch (error: any) {
    logger.error(`状态查询异常：${error.message}`);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
});

/**
 * GET /api/auth/token-status
 * 查询 APP Token 状态（用于调用一汽奥迪 API）
 */
router.get('/token-status', async (req: Request, res: Response) => {
  try {
    const { authService: auth } = await getAuthService();
    const tokenStatus = auth.getTokenStatus();
    
    res.json({
      code: 'SUCCESS',
      data: {
        valid: tokenStatus.valid,
        remainingHours: tokenStatus.remainingHours,
        expiresAt: tokenStatus.expiresAt,
      },
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Token 状态查询异常：${msg}`);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: `Token 状态查询失败：${msg}`,
    });
  }
});

/**
 * POST /api/auth/verify
 * Token 在线验证（调用会员信息接口确认远端有效性）
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { authService: auth, api } = await getAuthService();
    
    // 检查是否有可用 Token
    const tokenStatus = auth.getTokenStatus();
    if (!tokenStatus.valid) {
      return res.status(401).json({
        code: 401,
        message: '无可用 Token 进行验证',
      });
    }
    
    if (!api) {
      return res.status(401).json({
        code: 401,
        message: '无可用 Token 进行验证',
      });
    }
    
    // 获取 access token 并调用 getMemberInfo 验证远端有效性
    const accessToken = await auth.getAccessToken();
    const memberInfo = await api.getMemberInfo(accessToken);
    
    // 远端验证成功
    return res.json({
      code: 0,
      data: {
        remoteValid: true,
        memberLevel: memberInfo.memberLevel,
      },
    });
  } catch (error: any) {
    // 网络错误（超时、连接失败等）
    if (axios.isAxiosError(error)) {
      const reason = error.code === 'ECONNABORTED'
        ? '请求超时'
        : (error.message || '网络异常');
      
      // 检查是否是上游返回了 HTTP 响应但 code 为 401/10009
      if (error.response?.data) {
        const upstreamCode = error.response.data.code;
        const upstreamMsg = error.response.data.message || '';
        if (upstreamCode === 401 || upstreamCode === 10009) {
          logger.warn(`Token 验证失败：code=${upstreamCode}, message=${upstreamMsg}`);
          return res.json({
            code: 0,
            data: {
              remoteValid: false,
              message: `Token 已失效或会话不匹配（${upstreamCode}）。请使用手机号验证码重新登录获取新 Token。`,
            },
          });
        }
      }
      
      return res.json({
        code: 0,
        data: {
          remoteValid: false,
          message: `网络错误：${reason}`,
        },
      });
    }
    
    // 其他错误
    const msg = error instanceof Error ? error.message : String(error);
    return res.json({
      code: 0,
      data: {
        remoteValid: false,
        message: `验证失败：${msg}`,
      },
    });
  }
});

/**
 * 获取客户端 IP 地址
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export default router;
