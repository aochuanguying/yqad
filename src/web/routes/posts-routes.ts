import { Router, Request, Response } from 'express';
import { AuthService } from '../../services/auth';
import { AutoPostService } from '../../services/auto-post';
import { RealAudiApi } from '../../api/real-client';
import { getLogger } from '../../utils/logger';
import { GeneratePostRequest, GeneratePostResponse, BatchPostRequest, BatchPostResponse, TaskStatusResponse, AsyncTask, ConfirmPostRequest, ConfirmPostResponse, PendingPost } from '../../types/api-remote-post';
import { loadConfig } from '../../utils/config';
import { verifyApiToken, getTokenStatus } from '../../utils/api-token';
import { pendingPostService } from '../../services/pending-post-service';
import { postLoggingService } from '../../services/post-logging-service';
import { PostLog, LogQueryResponse, LogDetailResponse } from '../../types/post-logging';
import { createAutoJsApiClient } from '../../utils/autojs-api-client';
import { PostingMode } from '../../types/posting-optimization';
import { taskCacheStorage } from '../../storage/redis/task-cache-storage';

const logger = getLogger('posts-routes');

const router = Router();

// 使用 Redis 任务缓存存储
// const taskStore = new Map<string, AsyncTask>();

// 发帖并发控制标志位
let isPostTaskRunning = false;

// 清理过期任务（30 分钟）- Redis 会自动过期，这里只做日志
setInterval(async () => {
  logger.debug('执行定期过期任务清理（Redis 自动过期）');
  // Redis 中的任务有 30 分钟 TTL，会自动过期
  // 这里可以添加监控逻辑
}, 5 * 60 * 1000); // 每 5 分钟检查一次

/**
 * API Token 鉴权中间件
 * 用于验证远程发帖 API 的独立 Token，与登录 Token 分离
 */
async function apiTokenMiddleware(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    
    // 检查 Authorization 头是否存在
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('鉴权失败：缺少 Authorization 头');
      return res.status(401).json({ error: '缺少 Authorization 头', code: 'UNAUTHORIZED' });
    }

    // 提取 Token
    const token = authHeader.split(' ')[1];
    if (!token) {
      logger.warn('鉴权失败：Token 格式无效');
      return res.status(401).json({ error: 'Token 格式无效', code: 'INVALID_TOKEN' });
    }

    // 特殊标记：从配置文件读取 Token
    if (token === 'configured') {
      logger.debug('使用配置文件中的 Token 进行鉴权');
      const status = await getTokenStatus();
      if (status.configured) {
        logger.info('配置文件 Token 鉴权成功');
        return next();
      } else {
        logger.warn('配置文件中未配置 Token');
        return res.status(401).json({ error: '配置文件中未配置 Token', code: 'TOKEN_NOT_CONFIGURED' });
      }
    }

    // 验证 Token
    const isValid = await verifyApiToken(token);
    if (!isValid) {
      logger.warn(`鉴权失败：Token 无效 - ${token.substring(0, 10)}...`);
      return res.status(401).json({ error: 'Token 无效', code: 'INVALID_TOKEN' });
    }
    
    logger.info(`API Token 鉴权成功，Token 前缀：${token.substring(0, 10)}...`);
    next();
  } catch (error: any) {
    logger.error(`API Token 鉴权异常：${error.message}`);
    res.status(401).json({ error: '鉴权失败', code: 'AUTH_FAILED' });
  }
}

/**
 * Token 鉴权中间件（保留用于向后兼容）
 * @deprecated 请使用 apiTokenMiddleware
 */
async function authMiddleware(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '缺少 Authorization 头', code: 'UNAUTHORIZED' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token 格式无效', code: 'INVALID_TOKEN' });
    }

    // 验证 token（简单验证，实际应该检查 token 有效性）
    const authService = await AuthService.create(new RealAudiApi());
    // 这里可以调用 authService.verifyToken(token) 如果有这个方法的话
    // 暂时只检查 token 是否存在
    
    logger.info(`API 调用鉴权成功，token 前缀：${token.substring(0, 10)}...`);
    next();
  } catch (error: any) {
    logger.error(`鉴权失败：${error.message}`);
    res.status(401).json({ error: '鉴权失败', code: 'AUTH_FAILED' });
  }
}

/**
 * 频率限制中间件（简单实现：基于 IP 和时间的计数）
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function rateLimitMiddleware(req: any, res: any, next: any) {
  const config = loadConfig();
  const limit = 10; // 每小时 10 次
  const windowMs = 60 * 60 * 1000; // 1 小时

  // 使用 IP 作为标识（实际应该使用设备 ID）
  const clientId = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();

  let clientData = rateLimitStore.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    // 新的时间窗口
    clientData = { count: 0, resetTime: now + windowMs };
    rateLimitStore.set(clientId, clientData);
  }

  if (clientData.count >= limit) {
    logger.warn(`频率限制：客户端 ${clientId} 已超限`);
    return res.status(429).json({ 
      error: '请求频率超限', 
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }

  clientData.count++;
  logger.debug(`频率限制：客户端 ${clientId} 当前计数 ${clientData.count}/${limit}`);
  next();
}

/**
 * POST /api/posts/generate
 * 生成单篇发帖内容（使用 API Token 鉴权）
 */
router.post('/generate', apiTokenMiddleware, rateLimitMiddleware, async (req, res) => {
  try {
    logger.info('收到发帖内容生成请求');
    
    const request: GeneratePostRequest = req.body;
    const api = new RealAudiApi();
    const authService = await AuthService.create(api);
    const postService = new AutoPostService(api, authService);

    const result = await postService.generatePostContent({
      useTopic: request.useTopic,
      mode: request.mode,
      topicId: request.topicId,
    });

    if (result.success && result.data) {
      logger.info(`发帖内容生成成功：${result.data.title}`);
      res.json(result as GeneratePostResponse);
    } else {
      logger.warn(`发帖内容生成失败：${result.error}`);
      res.status(400).json(result as GeneratePostResponse);
    }
  } catch (error: any) {
    logger.error(`发帖内容生成异常：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    } as GeneratePostResponse);
  }
});

/**
 * POST /api/posts/batch
 * 批量生成发帖内容（异步，使用 API Token 鉴权）
 */
router.post('/batch', apiTokenMiddleware, rateLimitMiddleware, async (req, res) => {
  try {
    logger.info('收到批量发帖请求');
    
    const request: BatchPostRequest = req.body;
    
    // 参数验证
    if (!request.count || request.count < 1 || request.count > 5) {
      return res.status(400).json({
        success: false,
        error: 'count 参数必须在 1-5 之间',
        code: 'INVALID_COUNT',
      } as BatchPostResponse);
    }

    // 创建异步任务
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task: AsyncTask = {
      id: taskId,
      status: 'pending',
      request,
      results: [],
      createdAt: Date.now(),
      progress: {
        total: request.count,
        completed: 0,
      },
    };

    // 保存到 Redis
    await taskCacheStorage.saveTask(taskId, task);
    logger.info(`创建批量任务：${taskId}, count=${request.count}`);

    // 异步执行任务
    (async () => {
      try {
        task.status = 'processing';
        await taskCacheStorage.updateTaskStatus(taskId, 'processing');
        
        const api = new RealAudiApi();
        const authService = await AuthService.create(api);
        const postService = new AutoPostService(api, authService);

        for (let i = 0; i < request.count; i++) {
          try {
            const result = await postService.generatePostContent({
              useTopic: request.useTopic,
              mode: request.mode,
            });

            if (result.success && result.data) {
              task.results.push(result.data);
              task.progress.completed++;
              // 更新 Redis 中的任务
              await taskCacheStorage.saveTask(taskId, task);
              logger.info(`批量任务 ${taskId} 进度：${task.progress.completed}/${task.progress.total}`);
            } else {
              logger.warn(`批量任务 ${taskId} 第 ${i + 1} 篇失败：${result.error}`);
            }
          } catch (error: any) {
            logger.error(`批量任务 ${taskId} 第 ${i + 1} 篇异常：${error.message}`);
          }
        }

        task.status = 'completed';
        task.completedAt = Date.now();
        await taskCacheStorage.saveTask(taskId, task);
        logger.info(`批量任务 ${taskId} 完成`);
      } catch (error: any) {
        task.status = 'failed';
        task.error = error.message;
        task.completedAt = Date.now();
        await taskCacheStorage.saveTask(taskId, task);
        logger.error(`批量任务 ${taskId} 失败：${error.message}`);
      }
    })();

    // 立即返回任务 ID
    res.status(202).json({
      success: true,
      taskId,
      status: 'pending',
      progress: {
        total: request.count,
        completed: 0,
      },
    } as BatchPostResponse);
  } catch (error: any) {
    logger.error(`批量发帖请求异常：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    } as BatchPostResponse);
  }
});

/**
 * POST /api/posts/confirm
 * 客户端发帖成功回调（使用 API Token 鉴权）
 */
router.post('/confirm', apiTokenMiddleware, async (req, res) => {
  try {
    logger.info('收到发帖成功回调请求');
    
    const request: ConfirmPostRequest = req.body;
    
    // 参数验证
    if (!request.taskId) {
      return res.status(400).json({
        success: false,
        error: '缺少 taskId 参数',
        code: 'MISSING_TASK_ID',
      } as ConfirmPostResponse);
    }
    
    if (typeof request.success !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'success 参数必须为布尔值',
        code: 'INVALID_SUCCESS',
      } as ConfirmPostResponse);
    }
    
    // 获取待确认记录
    const pendingPost = await pendingPostService.get(request.taskId);
    
    if (!pendingPost) {
      logger.warn(`待确认记录不存在或已过期：${request.taskId}`);
      return res.status(404).json({
        success: false,
        error: '任务不存在或已过期',
        code: 'TASK_NOT_FOUND',
      } as ConfirmPostResponse);
    }
    
    // 如果发布失败，只删除记录，不扣减次数，并记录日志
    if (!request.success) {
      logger.info(`客户端回调发布失败：${request.taskId} (${pendingPost.title})`);
      
      // 记录发帖日志（失败）
      try {
        await postLoggingService.log({
          timestamp: Date.now(),
          triggerType: 'manual',  // 远程 API 回调视为手动
          postType: pendingPost.topicId ? 'topic' : 'free',
          mode: pendingPost.mode,
          topicId: pendingPost.topicId,
          topicName: undefined,  // 回调时无法获取主题名称
          title: pendingPost.title,
          content: pendingPost.content,
          imageUrls: pendingPost.images.map(img => img.url),
          status: 'failed',
          errorMessage: '客户端发布失败',
          taskId: request.taskId,
        });
        logger.debug(`已记录回调失败日志：${pendingPost.title}`);
      } catch (logError: any) {
        logger.warn(`记录回调失败日志失败：${logError.message}`);
      }
      
      return res.json({
        success: true,
        message: '已记录失败，未扣减次数',
      } as ConfirmPostResponse);
    }
    
    // 发布成功，扣减主题使用次数
    if (pendingPost.topicId) {
      const postSummary = {
        title: pendingPost.title,
        contentSnippet: pendingPost.content.substring(0, 200),
        timestamp: new Date().toISOString(),
        usedSubDirectionIndex: pendingPost.subDirectionIndex,
      };
      
      // TODO: 实现扣减主题使用次数的逻辑
      // const updatedTopicPromise = Promise.resolve(null);
      
      // 暂时跳过扣减次数逻辑，直接记录日志
      logger.info(`✓ 发帖回调成功，主题 "${pendingPost.topicId}"`);
      
      // 记录发帖日志（成功）
      try {
        await postLoggingService.log({
          timestamp: Date.now(),
          triggerType: 'manual',  // 远程 API 回调视为手动
          postType: 'topic',
          mode: pendingPost.mode,
          topicId: pendingPost.topicId,
          topicName: undefined,
          title: pendingPost.title,
          content: pendingPost.content,
          imageUrls: pendingPost.images.map(img => img.url),
          status: 'success',
          taskId: request.taskId,
        });
        logger.debug(`已记录回调成功日志：${pendingPost.title}`);
      } catch (logError: any) {
        logger.warn(`记录回调成功日志失败：${logError.message}`);
      }
      
      res.json({
        success: true,
      } as ConfirmPostResponse);
    } else {
      // 自由模式发帖，不扣减主题次数
      logger.info(`✓ 自由模式发帖回调成功：${request.taskId}`);
      
      // 记录发帖日志（自由模式成功）
      try {
        await postLoggingService.log({
          timestamp: Date.now(),
          triggerType: 'manual',
          postType: 'free',
          mode: pendingPost.mode,
          title: pendingPost.title,
          content: pendingPost.content,
          imageUrls: pendingPost.images.map(img => img.url),
          status: 'success',
          taskId: request.taskId,
        });
        logger.debug(`已记录自由模式回调成功日志：${pendingPost.title}`);
      } catch (logError: any) {
        logger.warn(`记录回调成功日志失败：${logError.message}`);
      }
      
      res.json({
        success: true,
        message: '回调成功',
      } as ConfirmPostResponse);
    }
  } catch (error: any) {
    logger.error(`发帖回调异常：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    } as ConfirmPostResponse);
  }
});

/**
 * GET /api/posts/tasks/:id
 * 查询异步任务状态
 */
router.get('/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const task = await taskCacheStorage.getTask(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
        code: 'TASK_NOT_FOUND',
        taskId: req.params.id,
        status: 'failed',
        createdAt: new Date().toISOString(),
      } as TaskStatusResponse);
    }

    const response: TaskStatusResponse = {
      success: true,
      taskId,
      status: task.status,
      progress: task.progress,
      createdAt: new Date(task.createdAt).toISOString(),
      completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : undefined,
    };

    if (task.status === 'completed' && task.results.length > 0) {
      response.results = task.results;
    }

    if (task.error) {
      response.error = task.error;
    }

    res.json(response);
  } catch (error: any) {
    logger.error(`查询任务状态异常：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
      taskId: req.params.id,
      status: 'failed',
      createdAt: new Date().toISOString(),
    } as TaskStatusResponse);
  }
});

// ========== API Token 管理路由 ==========

/**
 * GET /api/token
 * 查询 API Token 状态（不暴露完整 Token）
 */
router.get('/token', async (req, res) => {
  try {
    const status = await getTokenStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    logger.error(`查询 API Token 状态异常：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/token/generate
 * 生成或重置 API Token
 */
router.post('/token/generate', async (req, res) => {
  try {
    const { reset } = req.body || {};
    
    let newToken: string;
    let message: string;
    
    if (reset) {
      // 重置 Token
      const config = await import('../../utils/api-token');
      const result = await config.resetApiToken();
      newToken = result.token;
      message = 'API Token 已重置';
      logger.info('API Token 已被用户重置');
    } else {
      // 初次生成（如果已存在则返回错误）
      const config = await import('../../utils/api-token');
      const status = await config.getTokenStatus();
      
      if (status.configured) {
        return res.status(400).json({
          success: false,
          error: 'API Token 已存在，如需重置请传递 reset: true 参数',
          code: 'TOKEN_ALREADY_EXISTS',
        });
      }
      
      const result = await config.initApiToken();
      newToken = result.token;
      message = 'API Token 已生成';
      logger.info('API Token 已初始化');
    }
    
    res.json({
      success: true,
      message,
      data: {
        token: newToken,
        warning: '请妥善保管此 Token，刷新页面后将无法再次查看完整 Token',
      },
    });
  } catch (error: any) {
    logger.error(`生成/重置 API Token 异常：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

// ========== AutoJS API 配置和手工发帖路由 ==========

/**
 * GET /api/posts/autojs/config
 * 获取 AutoJS API 配置
 */
router.get('/autojs/config', async (req, res) => {
  try {
    logger.info('获取 AutoJS API 配置');
    
    // 从数据库读取配置
    const { autojsApiStorage } = await import('../../storage/mysql/autojs-api-storage');
    let autojsConfig = await autojsApiStorage.getConfig();
    
    if (!autojsConfig) {
      // 如果数据库中没有配置，使用默认值
      autojsConfig = {
        enabled: false,
        baseUrl: '',
        apiToken: '',
        postScript: 'audi_post.js',
      };
    }
    
    // 获取本服务的 API Token 状态
    const { getTokenStatus } = await import('../../utils/api-token');
    const tokenStatus = await getTokenStatus();
    
    res.json({
      success: true,
      data: {
        enabled: autojsConfig.enabled,
        baseUrl: autojsConfig.baseUrl,
        postScript: autojsConfig.postScript,
        apiTokenConfigured: tokenStatus.configured,
      },
    });
  } catch (error: any) {
    logger.error(`获取 AutoJS API 配置异常：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/posts/autojs/config
 * 保存 AutoJS API 配置
 */
router.post('/autojs/config', async (req, res) => {
  try {
    logger.info('保存 AutoJS API 配置');
    
    const { enabled, baseUrl, postScript } = req.body;
    
    // 参数验证
    if (enabled && !baseUrl) {
      return res.status(400).json({
        success: false,
        error: '启用 AutoJS API 时必须提供服务器地址',
        code: 'INVALID_CONFIG',
      });
    }
    
    // 从数据库读取当前配置
    const { autojsApiStorage } = await import('../../storage/mysql/autojs-api-storage');
    const currentConfig = await autojsApiStorage.getConfig();
    
    // 构建新配置
    const newConfig = {
      enabled: enabled || false,
      baseUrl: baseUrl || '',
      apiToken: currentConfig?.apiToken || '', // 保持原有的 apiToken
      postScript: postScript || 'audi_post.js',
    };
    
    // 保存到数据库
    await autojsApiStorage.saveConfig(newConfig);
    
    logger.info('AutoJS API 配置已保存到数据库');
    
    res.json({
      success: true,
      message: '配置已保存',
    });
  } catch (error: any) {
    logger.error(`保存 AutoJS API 配置异常：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

// ========== 手工发帖和日志查询路由 ==========

/**
 * POST /api/posts/execute
 * 手工立即发帖接口（通过 AutoJS API 远程执行脚本）
 */
router.post('/execute', async (req, res) => {
  try {
    logger.info('收到手工立即发帖请求');
    
    // 检查是否有发帖任务正在执行
    if (isPostTaskRunning) {
      logger.warn('发帖任务正在执行中，拒绝手工发帖请求');
      return res.status(409).json({
        success: false,
        error: '发帖任务正在执行中，请稍后再试',
        code: 'TASK_RUNNING',
      });
    }
    
    // 设置标志位
    isPostTaskRunning = true;
    
    try {
      // 从数据库读取 AutoJS API 配置
      const { autojsApiStorage } = await import('../../storage/mysql/autojs-api-storage');
      const autojsConfig = await autojsApiStorage.getConfig();
      
      // 检查 AutoJS API 是否启用
      if (!autojsConfig?.enabled) {
        logger.warn('AutoJS API 未启用，无法执行远程脚本');
        return res.status(503).json({
          success: false,
          error: 'AutoJS API 服务未启用',
          code: 'SERVICE_NOT_ENABLED',
        });
      }
      
      // 检查 AutoJS API Token
      if (!autojsConfig.apiToken) {
        logger.error('数据库中未配置 AutoJS API Token');
        return res.status(503).json({
          success: false,
          error: '请先在配置页面设置 AutoJS API Token',
          code: 'API_TOKEN_NOT_CONFIGURED',
        });
      }
      
      // 创建 AutoJS API 客户端（使用数据库中的配置）
      const autojsClient = createAutoJsApiClient({
        baseUrl: autojsConfig.baseUrl,
        apiToken: autojsConfig.apiToken,
      });
      
      // 健康检查
      logger.info('执行 AutoJS API 健康检查...');
      const healthStatus = await autojsClient.healthCheck();
      if (!healthStatus.success) {
        logger.warn(`AutoJS API 健康检查失败：${healthStatus.message}`);
        return res.status(503).json({
          success: false,
          error: `AutoJS API 服务不可用：${healthStatus.message}`,
          code: 'SERVICE_UNAVAILABLE',
        });
      }
      
      // 执行远程脚本（异步方式）
      const scriptName = autojsConfig.postScript || 'audi_post.js';
      logger.info(`执行远程脚本：${scriptName}`);
      
      const result = await autojsClient.executeScript(scriptName, false);
      
      if (result.success) {
        logger.info(`远程脚本执行成功：${scriptName}`);
        
        // 记录发帖日志（手动触发，等待 AutoJS 脚本回调）
        try {
          const taskId = `autojs_${Date.now()}`;
          await postLoggingService.log({
            timestamp: Date.now(),
            triggerType: 'manual',
            postType: 'free', // 初始为自由发帖，具体由回调更新
            mode: 'normal',
            title: '手工发帖（AutoJS 远程执行）',
            content: '等待 AutoJS 脚本回调更新...',
            imageUrls: [],
            status: 'pending',
            taskId,
          });
          logger.debug(`已记录手动发帖日志（等待回调）：${taskId}`);
        } catch (logError: any) {
          logger.warn(`记录发帖日志失败：${logError.message}`);
        }
        
        res.json({
          success: true,
          message: '脚本执行成功，发帖任务已启动（AutoJS 脚本将自行判断使用主题或自由模式）',
          data: {
            script: scriptName,
            sync: false,
          },
        });
      } else {
        logger.warn(`远程脚本执行失败：${result.message}`);
        res.status(400).json({
          success: false,
          error: result.message || '远程脚本执行失败',
          code: 'SCRIPT_EXECUTION_FAILED',
        });
      }
    } finally {
      // 释放标志位
      isPostTaskRunning = false;
    }
  } catch (error: any) {
    logger.error(`手工立即发帖异常：${error.message}`);
    isPostTaskRunning = false;
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/posts/autojs/callback
 * AutoJS 脚本发帖回调接口（使用 API Token 鉴权）
 */
router.post('/autojs/callback', apiTokenMiddleware, async (req, res) => {
  try {
    logger.info('收到 AutoJS 脚本发帖回调请求');
    
    const { 
      taskId, 
      success, 
      title, 
      content, 
      imageUrls, 
      topicId, 
      topicName,
      mode,
      errorMessage 
    } = req.body;
    
    // 参数验证
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: '缺少 taskId 参数',
        code: 'MISSING_TASK_ID',
      });
    }
    
    if (typeof success !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'success 参数必须为布尔值',
        code: 'INVALID_SUCCESS',
      });
    }
    
    // 查找对应的日志记录
    const log = await postLoggingService.findByTaskId(taskId);
    
    if (!log) {
      logger.warn(`日志记录不存在：${taskId}`);
      return res.status(404).json({
        success: false,
        error: '日志记录不存在',
        code: 'LOG_NOT_FOUND',
      });
    }
    
    // 更新日志记录
    if (success) {
      logger.info(`AutoJS 回调发帖成功：${title || log.title}`);
      
      // 清理内容，防止特殊字符导致乱码
      const cleanTitle = title ? String(title).trim() : log.title;
      const cleanContent = content ? String(content).trim() : log.content;
      const cleanImageUrls = Array.isArray(imageUrls) ? imageUrls.map(url => String(url).trim()) : log.imageUrls;
      
      await postLoggingService.update(log.id, {
        status: 'success',
        title: cleanTitle,
        content: cleanContent,
        imageUrls: cleanImageUrls,
        topicId: topicId || undefined,
        topicName: topicName || undefined,
      });
      
      logger.info(`已更新日志状态为成功：${log.id}`);
      
      res.json({
        success: true,
        message: '回调成功',
      });
    } else {
      logger.warn(`AutoJS 回调发帖失败：${errorMessage || '未知错误'}`);
      
      await postLoggingService.update(log.id, {
        status: 'failed',
        errorMessage: errorMessage || 'AutoJS 脚本执行失败',
      });
      
      logger.info(`已更新日志状态为失败：${log.id}`);
      
      res.json({
        success: true,
        message: '已记录失败状态',
      });
    }
  } catch (error: any) {
    logger.error(`AutoJS 回调异常：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/posts/logs
 * 查询发帖日志列表（分页）
 */
router.get('/logs', async (req, res) => {
  try {
    logger.info('收到查询发帖日志列表请求');
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const triggerType = req.query.triggerType as any;
    const postType = req.query.postType as any;
    const startDate = req.query.startDate ? parseInt(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? parseInt(req.query.endDate as string) : undefined;
    
    const result = await postLoggingService.query({
      page,
      limit,
      triggerType,
      postType,
      startDate,
      endDate,
    });
    
    res.json(result);
  } catch (error: any) {
    logger.error(`查询发帖日志列表异常：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    } as any);
  }
});

/**
 * GET /api/posts/logs/:id
 * 查询单条发帖日志详情
 */
router.get('/logs/:id', async (req, res) => {
  try {
    logger.info(`收到查询发帖日志详情请求：${req.params.id}`);
    
    const log = await postLoggingService.getDetail(req.params.id);
    
    if (!log) {
      return res.status(404).json({
        success: false,
        error: '日志记录不存在',
        code: 'LOG_NOT_FOUND',
      });
    }
    
    res.json({
      success: true,
      data: log,
    });
  } catch (error: any) {
    logger.error(`查询发帖日志详情异常：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    } as LogDetailResponse);
  }
});

/**
 * GET /api/posts/autojs/scripts
 * 获取 AutoJS 服务器上的脚本列表（代理接口）
 */
router.get('/autojs/scripts', async (req, res) => {
  try {
    logger.info('获取 AutoJS 脚本列表');
    
    // 从数据库读取配置
    const { autojsApiStorage } = await import('../../storage/mysql/autojs-api-storage');
    const autojsConfig = await autojsApiStorage.getConfig();
    
    // 检查 AutoJS API 是否启用
    if (!autojsConfig?.enabled) {
      return res.status(503).json({
        success: false,
        error: 'AutoJS API 服务未启用',
        code: 'SERVICE_NOT_ENABLED',
      });
    }
    
    // 检查 AutoJS API Token
    if (!autojsConfig.apiToken) {
      logger.error('数据库中未配置 AutoJS API Token');
      return res.status(503).json({
        success: false,
        error: '请先在配置页面设置 AutoJS API Token',
        code: 'API_TOKEN_NOT_CONFIGURED',
      });
    }
    
    // 创建 AutoJS API 客户端（使用配置文件中的 Token）
    const autojsClient = createAutoJsApiClient({
      baseUrl: autojsConfig.baseUrl,
      apiToken: autojsConfig.apiToken,
    });
    
    // 获取脚本列表
    const result = await autojsClient.getScripts();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    logger.error(`获取脚本列表异常：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/posts/autojs/execute
 * 执行 AutoJS 脚本（代理接口）
 */
router.post('/autojs/execute', async (req, res) => {
  try {
    logger.info('执行 AutoJS 脚本');
    
    const { script, sync = false } = req.body;
    
    // 参数验证
    if (!script) {
      return res.status(400).json({
        success: false,
        error: '缺少 script 参数',
        code: 'MISSING_SCRIPT',
      });
    }
    
    // 从数据库读取配置
    const { autojsApiStorage } = await import('../../storage/mysql/autojs-api-storage');
    const autojsConfig = await autojsApiStorage.getConfig();
    
    // 检查 AutoJS API 是否启用
    if (!autojsConfig?.enabled) {
      return res.status(503).json({
        success: false,
        error: 'AutoJS API 服务未启用',
        code: 'SERVICE_NOT_ENABLED',
      });
    }
    
    // 检查 AutoJS API Token
    if (!autojsConfig.apiToken) {
      logger.error('数据库中未配置 AutoJS API Token');
      return res.status(503).json({
        success: false,
        error: '请先在配置页面设置 AutoJS API Token',
        code: 'API_TOKEN_NOT_CONFIGURED',
      });
    }
    
    // 创建 AutoJS API 客户端（使用配置文件中的 Token）
    const autojsClient = createAutoJsApiClient({
      baseUrl: autojsConfig.baseUrl,
      apiToken: autojsConfig.apiToken,
    });
    
    // 执行脚本
    const result = await autojsClient.executeScript(script, sync);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    logger.error(`执行脚本异常：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
