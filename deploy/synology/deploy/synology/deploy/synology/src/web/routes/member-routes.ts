import { Router, Request, Response } from 'express';
import axios from 'axios';
import { RealAudiApi } from '../../api/real-client';
import { getLogger } from '../../utils/logger';
import { getAuthService, getRealApi } from '../services/auth-instance';

const logger = getLogger('member-routes');
const router = Router();

/**
 * GET /api/member/info
 * 获取当前会员信息
 *
 * 成功: 200 { code: 0, data: { memberLevel, memberScore, growthScore } }
 * Token缺失/过期: 401 { error: "..." }
 * 上游错误: 502 { error: "..." }
 * 网络超时: 503 { error: "..." }
 */
router.get('/info', async (req: Request, res: Response) => {
  try {
    const { authService: auth } = await getAuthService();
    const api = await getRealApi();

    // 检查 token 有效性
    const tokenStatus = auth.getTokenStatus();
    if (!tokenStatus.valid) {
      return res.status(401).json({ error: 'Token 缺失或已过期，请重新登录' });
    }

    if (!api) {
      return res.status(502).json({ error: '上游服务错误：API 客户端未初始化为 real 模式' });
    }

    // 获取 accessToken 并调用上游接口
    const accessToken = await auth.getAccessToken();
    const memberInfo = await api.getMemberInfo(accessToken);

    res.json({
      code: 0,
      data: {
        memberLevel: memberInfo.memberLevel,
        memberScore: memberInfo.memberScore,
        growthScore: memberInfo.growthScore,
      },
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        const reason = error.message || '请求超时';
        logger.error(`会员信息获取超时: ${reason}`);
        return res.status(503).json({ error: `无法连接上游服务: ${reason}` });
      }
      if (!error.response) {
        // 网络连接错误（无响应）
        const reason = error.message || '网络连接失败';
        logger.error(`会员信息网络错误: ${reason}`);
        return res.status(503).json({ error: `无法连接上游服务: ${reason}` });
      }
    }

    // 上游返回错误（code ≠ 0 时 getMemberInfo 会抛出 Error）
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`获取会员信息失败: ${msg}`);
    return res.status(502).json({ error: `上游服务错误: ${msg}` });
  }
});

export default router;
