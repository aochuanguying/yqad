import { Router, Request, Response } from 'express';
import { memberService } from '../../services/member-service';
import { getLogger } from '../../utils/logger';

const logger = getLogger('member-management');
const router = Router();

/**
 * POST /api/members
 * 创建会员
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, email, password, member_level } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        code: 400,
        message: '用户名和密码必填',
      });
    }

    // 检查用户名是否已存在
    const existing = await memberService.getMemberByUsername(username);
    if (existing) {
      return res.status(409).json({
        code: 409,
        message: '用户名已存在',
      });
    }

    const member = await memberService.createMember({
      username,
      email,
      password,
      member_level,
    });

    logger.info(`会员创建成功：${username}`);
    res.status(201).json({
      code: 0,
      data: member,
    });
  } catch (error: any) {
    logger.error(`创建会员失败：${error.message}`);
    res.status(500).json({
      code: 500,
      message: error.message,
    });
  }
});

/**
 * GET /api/members/:id
 * 根据 ID 查询会员
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const member = await memberService.getMemberById(req.params.id);

    if (!member) {
      return res.status(404).json({
        code: 404,
        message: '会员不存在',
      });
    }

    res.json({
      code: 0,
      data: member,
    });
  } catch (error: any) {
    logger.error(`查询会员失败：${error.message}`);
    res.status(500).json({
      code: 500,
      message: error.message,
    });
  }
});

/**
 * GET /api/members
 * 查询会员列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { page, pageSize, memberLevel, status } = req.query;

    const result = await memberService.queryMembers({
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 20,
      memberLevel: memberLevel as string,
      status: status as string,
    });

    res.json({
      code: 0,
      data: result,
    });
  } catch (error: any) {
    logger.error(`查询会员列表失败：${error.message}`);
    res.status(500).json({
      code: 500,
      message: error.message,
    });
  }
});

/**
 * PUT /api/members/:id
 * 更新会员信息
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { username, email, member_level, expires_at } = req.body;

    const member = await memberService.updateMember(req.params.id, {
      username,
      email,
      member_level,
      expires_at,
    });

    if (!member) {
      return res.status(404).json({
        code: 404,
        message: '会员不存在',
      });
    }

    res.json({
      code: 0,
      data: member,
    });
  } catch (error: any) {
    logger.error(`更新会员失败：${error.message}`);
    res.status(500).json({
      code: 500,
      message: error.message,
    });
  }
});

/**
 * DELETE /api/members/:id
 * 删除会员
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await memberService.deleteMember(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        code: 404,
        message: '会员不存在',
      });
    }

    res.json({
      code: 0,
      message: '删除成功',
    });
  } catch (error: any) {
    logger.error(`删除会员失败：${error.message}`);
    res.status(500).json({
      code: 500,
      message: error.message,
    });
  }
});

/**
 * POST /api/members/login
 * 会员登录
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress;

    if (!username || !password) {
      return res.status(400).json({
        code: 400,
        message: '用户名和密码必填',
      });
    }

    const member = await memberService.authenticate(username, password, ip);

    if (!member) {
      return res.status(401).json({
        code: 401,
        message: '用户名或密码错误',
      });
    }

    res.json({
      code: 0,
      data: member,
    });
  } catch (error: any) {
    logger.error(`登录失败：${error.message}`);
    res.status(500).json({
      code: 500,
      message: error.message,
    });
  }
});

export { router as memberManagementRoutes };
