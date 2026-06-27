import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import {
  IAudiApi,
  LoginResponse,
  PostListResponse,
  CommentListResponse,
  PublishCommentResponse,
  PublishPostResponse,
  MemberInfoResponse,
  Post,
} from './types';
import { HotTopic, PublishOptions } from '../types/posting-optimization';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { generateVrfCode, buildContentJson } from '../utils/publish-helpers';
import { getAPIConfigStorage } from '../storage/mysql/api-config-storage';

const logger = getLogger('real-api');

/**
 * contentType 到嵌套字段的映射
 */
const FEED_TYPE_MAP: Record<string, string> = {
  'INFORMATION': 'information',
  'DYNAMIC': 'subject',
  'ARTICLE': 'subject',
  'NOTES': 'nous',
};

/**
 * Token 续期回调类型
 */
export type TokenRenewalCallback = (newToken: string) => void;

export class RealAudiApi implements IAudiApi {
  private _client: AxiosInstance;
  private tokenRenewalCallback: TokenRenewalCallback | null = null;

  private get client(): AxiosInstance {
    return this._client;
  }

  constructor(baseUrl?: string, timeout?: number) {
    // 使用传入的参数或默认值初始化
    this._client = axios.create({
      baseURL: baseUrl || 'https://audi2c.faw-vw.com',
      timeout: timeout || 10000,
      httpAgent: new (require('http').Agent)({ keepAlive: true, maxSockets: 10 }),
      httpsAgent: new (require('https').Agent)({ keepAlive: true, maxSockets: 10 }),
    });
    logger.info(`RealAudiApi 初始化：${this._client.defaults.baseURL}`);
  }

  /**
   * 设置 Token 续期回调（由 AuthService 注入）
   */
  setTokenRenewalCallback(callback: TokenRenewalCallback): void {
    this.tokenRenewalCallback = callback;
  }

  // ========== 请求头构建 ==========

  private buildAppHeaders(token: string): Record<string, string> {
    const config = loadConfig();
    const deviceId = config.api.deviceId || 'AUDI_APP_iPhone_71A0E430-DB97-448F-868A-A6352E31FC13_26.5_6.1.1';
    return {
      'x-access-token': token,
      'x-audi-did': deviceId,
      'x-channel': 'iOS',
      'x-audi-entry': 'app',
      'x-microservice-name': 'api-gateway',
      'x-namespace-code': 'production',
      'sv': '6.1.1',
      'user-agent': 'AudiApp/506.1.1 (com.fawvw.audisuper; build:33; iOS 26.5.0) Alamofire/5.11.1',
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-lang': 'zh-CN',
    };
  }

  private buildMapiHeaders(token?: string, contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': contentType || 'application/json',
      'x-channel': 'MINI_PROGRAM',
      'x-microservice-name': 'audi-app-gateway-c',
      'x-namespace-code': 'faw-audi-dev',
      'x-timestamp': String(Date.now()),
    };
    if (token) {
      headers['x-access-token'] = token;
    }
    return headers;
  }

  // ========== Token 续期检查 ==========

  private checkTokenRenewal(response: AxiosResponse, currentToken: string): void {
    const newToken = response.headers['x-access-token'];
    if (newToken && newToken !== currentToken && newToken.startsWith('eyJ')) {
      logger.info('检测到 Token 续期，保存新 Token');
      if (this.tokenRenewalCallback) {
        this.tokenRenewalCallback(newToken);
      }
    }
  }

  // ========== IAudiApi 实现 ==========

  async login(username: string, password: string): Promise<LoginResponse> {
    // password 参数在此场景中作为验证码使用
    logger.info(`登录中: ${username}`);
    const response = await this.client.post('/mapi/user/v1/account/login', {
      accountLoginDto: {
        account: username,
        headImage: '',
        loginTypeEnum: 'MOBILE_VERIFICATION_CODE',
        loginChannelEnum: 'WECHAT_MINI_PROGRAM',
        password: '',
        verificationCode: password,
        code: '',
      },
    }, {
      headers: this.buildMapiHeaders(),
    });

    const data = response.data;
    if (data.code !== 0 || !data.data?.accessToken) {
      throw new Error(`登录失败: ${data.message || 'code=' + data.code}`);
    }

    const accessToken = data.data.accessToken;
    // JWT Token 有效期约 83h（300000 秒）
    return {
      access_token: accessToken,
      refresh_token: '', // 真实 API 无 refresh_token，通过响应头续期
      expires_in: 300000,
    };
  }

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    // 真实 API 不使用 refresh_token 机制，通过响应头滑动续期
    throw new Error('真实 API 不支持 refreshToken，Token 通过响应头自动续期');
  }

  async getPosts(accessToken: string, page: number, pageSize: number): Promise<PostListResponse> {
    const nonce = crypto.randomUUID();
    const timestamp = String(Date.now());

    const response = await this.client.get('/cnapi/v2/feed', {
      params: { current: page, size: pageSize, nonce, timestamp },
      headers: this.buildAppHeaders(accessToken),
    });

    this.checkTokenRenewal(response, accessToken);

    const data = response.data;
    if (data.code !== 0) {
      throw new Error(`获取帖子列表失败: code=${data.code} ${data.message || ''}`);
    }

    const records: any[] = data.data?.records || [];
    const posts: Post[] = [];

    for (const record of records) {
      const contentType: string = record.contentType || '';
      const objKey = FEED_TYPE_MAP[contentType];

      if (!objKey) {
        logger.debug(`跳过未知 contentType: ${contentType}`);
        continue;
      }

      const obj = record[objKey];
      if (!obj || !obj.id) {
        logger.debug(`跳过无效记录: contentType=${contentType}, 无 id`);
        continue;
      }

      posts.push({
        id: String(obj.id),
        title: (obj.title || '').replace(/<[^>]+>/g, '').trim(),
        content: this.extractTextContent(obj.content || ''),
        images: this.extractImages(obj),
        author: obj.nickName || obj.roleName || obj.author || '',
        publishTime: obj.createTime || obj.publishTime || '',
        likeCount: obj.likeCount || obj.praiseCount || 0,
        commentCount: obj.commentCount || 0,
        contentType,
      });
    }

    logger.info(`获取到 ${posts.length} 篇帖子 (page=${page}, 原始 ${records.length} 条)`);

    return {
      posts,
      total: posts.length,
      page,
      pageSize,
    };
  }

  async getComments(accessToken: string, postId: string): Promise<CommentListResponse> {
    logger.debug('getComments: 真实 API 暂无独立评论列表查询端点，返回空数组');
    return {
      comments: [],
      total: 0,
    };
  }

  async publishComment(accessToken: string, postId: string, content: string, contentType?: string): Promise<PublishCommentResponse> {
    const config = loadConfig();
    const nonce = crypto.randomUUID();
    const timestamp = String(Date.now());

    const body: Record<string, string> = {
      content,
      subjectId: postId,
      subjectContentTypeEnum: contentType || 'INFORMATION',
      nickName: config.api.nickName || '',
      avatarUrl: '',
      ipRegion: config.api.ipRegion || '',
    };

    const response = await this.client.post(
      `/cnapi/v1/comment_center/comment/save?nonce=${nonce}&timestamp=${timestamp}`,
      body,
      { headers: this.buildAppHeaders(accessToken) },
    );

    this.checkTokenRenewal(response, accessToken);

    const data = response.data;
    if (data.code === 0) {
      logger.info(`评论发布成功: postId=${postId}`);
      return { success: true, commentId: `real-${Date.now()}` };
    } else {
      logger.error(`评论发布失败: code=${data.code} ${data.message || ''}`);
      return { success: false, commentId: '' };
    }
  }

  async publishPost(accessToken: string, title: string, content: string, options?: PublishOptions): Promise<PublishPostResponse> {
    const config = loadConfig();
    const deviceId = config.api.deviceId || 'AUDI_APP_iPhone_71A0E430-DB97-448F-868A-A6352E31FC13_26.5_6.1.1';
    const ipRegion = config.api.ipRegion || '';

    // 构建帖子正文：标题 + 正文
    const fullContent = title + '\n\n' + content;

    // 构建请求体
    const body = {
      type: 0,
      topicList: options?.topicList?.map(t => ({ name: t.name, id: t.id })) || [],
      momentDto: {
        imgUrlList: options?.imageUrls || [],
        content: fullContent,
        contentJson: buildContentJson(fullContent),
      },
      vrfCode: generateVrfCode(deviceId),
      ipRegion,
      confirmPublish: false,
    };

    try {
      const response = await this.client.post(
        '/cnapi/v1/community/subject/publish',
        body,
        { headers: this.buildAppHeaders(accessToken) },
      );

      this.checkTokenRenewal(response, accessToken);

      const data = response.data;
      if (data.code === 0) {
        const postId = String(data.data?.id || '');
        logger.info(`发帖成功: postId=${postId}`);
        return { success: true, postId };
      } else {
        logger.error(`发帖失败: code=${data.code} ${data.message || ''}`);
        return { success: false, postId: '', code: data.code, message: data.message };
      }
    } catch (error: any) {
      logger.error(`发帖请求异常: ${error.message}`);
      return { success: false, postId: '' };
    }
  }

  /**
   * 获取热门话题列表
   * @param token 用户访问令牌
   * @param page 页码，默认1
   * @param pageSize 每页数量，默认20
   * @returns 热门话题列表，失败时返回空数组
   */
  async getHotTopics(token: string, page: number = 1, pageSize: number = 20): Promise<HotTopic[]> {
    const nonce = crypto.randomUUID();
    const timestamp = String(Date.now());

    try {
      const response = await this.client.get('/cnapi/v1/community/topic/hot', {
        params: { current: page, pageSize, nonce, timestamp },
        headers: this.buildAppHeaders(token),
        timeout: 10000,
      });

      this.checkTokenRenewal(response, token);

      const data = response.data;
      if (data.code !== 0) {
        logger.error(`获取热门话题失败: code=${data.code} ${data.message || ''}`);
        return [];
      }

      const records: any[] = data.data?.records || data.data || [];
      const topics: HotTopic[] = records.map((item: any) => ({
        id: String(item.id || item.topicId || ''),
        name: item.name?.startsWith('#') ? item.name : `#${item.name || item.topicName || ''}#`,
        heatDegree: item.heatDegree || item.heat || 0,
      }));

      logger.info(`获取到 ${topics.length} 个热门话题 (page=${page})`);
      return topics;
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        logger.error(`热门话题API请求超时: ${error.message}`);
      } else {
        logger.error(`热门话题API请求失败: ${error.message}`);
      }
      return [];
    }
  }

  /**
   * 上传图片到CDN
   * @param token 用户访问令牌
   * @param imagePaths 本地图片路径数组
   * @returns 成功上传的CDN URL列表和失败数量
   */
  async uploadImages(token: string, imagePaths: string[]): Promise<{ urls: string[]; failed: number }> {
    if (!imagePaths || imagePaths.length === 0) {
      return { urls: [], failed: 0 };
    }

    // 最多上传9张图片
    const limitedPaths = imagePaths.slice(0, 9);
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    // 过滤超过10MB的文件
    const validPaths: string[] = [];
    let skippedCount = 0;

    for (const filePath of limitedPaths) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.size > MAX_FILE_SIZE) {
          logger.warn(`图片文件超过10MB限制，跳过: ${filePath} (${(stat.size / 1024 / 1024).toFixed(2)}MB)`);
          skippedCount++;
        } else {
          validPaths.push(filePath);
        }
      } catch (error: any) {
        logger.warn(`无法读取图片文件，跳过: ${filePath} - ${error.message}`);
        skippedCount++;
      }
    }

    // 如果超过9张图片被提供但有些被过滤了，需要记录被截断的数量
    const truncatedCount = imagePaths.length > 9 ? imagePaths.length - 9 : 0;
    const totalFailed = skippedCount + truncatedCount;

    if (validPaths.length === 0) {
      logger.warn('没有有效的图片可上传');
      return { urls: [], failed: totalFailed || imagePaths.length };
    }

    try {
      const form = new FormData();
      form.append('componentName', 'userComplaint');
      form.append('fileType', 'img');
      form.append('privatePermanent', 'false');
      form.append('serviceName', 'user');
      form.append('publicRead', 'true');

      for (const filePath of validPaths) {
        const fileName = path.basename(filePath);
        form.append('files', fs.createReadStream(filePath), {
          filename: fileName,
          contentType: this.getMimeType(fileName),
        });
      }

      const headers = this.buildMapiHeaders(token, form.getHeaders()['content-type']);
      // Merge form-data headers (includes content-type with boundary)
      const mergedHeaders = { ...headers, ...form.getHeaders() };

      const response = await this.client.post('/mapi/attachment/v1/batch_upload', form, {
        headers: mergedHeaders,
        timeout: 60000, // 图片上传超时60秒
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      this.checkTokenRenewal(response, token);

      const data = response.data;
      if (data.code !== 0) {
        logger.error(`图片上传失败: code=${data.code} ${data.message || ''}`);
        return { urls: [], failed: imagePaths.length };
      }

      // 从响应中提取CDN URL列表
      const uploadResults: any[] = Array.isArray(data.data) ? data.data : [];
      const urls: string[] = [];
      let uploadFailed = 0;

      for (const item of uploadResults) {
        const url = item?.preSignedUrl || item?.url || item?.cdnUrl || item?.imageUrl || '';
        if (url) {
          urls.push(url);
        } else {
          uploadFailed++;
        }
      }

      // 部分上传失败的情况
      const failedInUpload = validPaths.length - urls.length;
      const finalFailed = totalFailed + (failedInUpload > 0 ? failedInUpload : 0);

      if (failedInUpload > 0) {
        logger.warn(`部分图片上传失败: 成功${urls.length}张，失败${failedInUpload}张`);
      } else {
        logger.info(`图片上传成功: ${urls.length}张`);
      }

      return { urls, failed: finalFailed };
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        logger.error(`图片上传超时: ${error.message}`);
      } else {
        logger.error(`图片上传请求失败: ${error.message}`);
      }
      return { urls: [], failed: imagePaths.length };
    }
  }

  /**
   * 根据文件扩展名获取MIME类型
   */
  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.heic': 'image/heic',
      '.heif': 'image/heif',
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  async getMemberInfo(accessToken: string): Promise<MemberInfoResponse> {
    const response = await this.client.get('/mapi/member/v1/member/info', {
      headers: this.buildMapiHeaders(accessToken, 'application/json'),
      timeout: 10000,
    });

    this.checkTokenRenewal(response, accessToken);

    const data = response.data;
    if (data.code !== 0) {
      throw new Error(`获取会员信息失败：code=${data.code} ${data.message || ''}`);
    }

    // 使用 console.log 避免 logger 格式化问题
    console.log('=== 会员信息完整响应原始数据 ===');
    console.log('完整响应:', JSON.stringify(response.data, null, 2));
    console.log('data.data 内容:', JSON.stringify((response.data as any).data, null, 2));
    console.log('data.data 类型:', typeof (response.data as any).data);
    console.log('data.data 是否为数组:', Array.isArray((response.data as any).data));
    
    const memberData = (response.data as any).data;
    // 成长值在嵌套的 memberGrowthInfoRespDto 对象中
    const growthInfo = memberData?.memberGrowthInfoRespDto;
    const growthValue = growthInfo?.growthValue ?? growthInfo?.growthScore ?? memberData?.growthValue ?? memberData?.growthScore ?? '-';

    return {
      memberLevel: memberData.memberLevel,
      memberScore: memberData.memberScore,
      growthScore: growthValue,
    };
  }

  /**
   * 发送短信验证码（腾讯滑块验证后调用）
   */
  async sendSmsCode(phone: string, captchaTicket: string): Promise<boolean> {
    logger.info(`发送短信验证码: ${phone}`);
    const response = await this.client.post('/mapi/user/v1/vrcode/send2', {
      describeCaptchaMiniResultReqDto: {
        captchaAppId: '198705236',
        ticket: captchaTicket,
      },
      sendVerificationCodeDto: {
        account: phone,
        verificationCodeTypeEnum: 'LOGIN_BY_VERIFICATION_CODE',
      },
    }, {
      headers: this.buildMapiHeaders(),
    });

    const data = response.data;
    if (data.code === 0) {
      logger.info('短信验证码发送成功');
      return true;
    } else {
      logger.error(`短信验证码发送失败: ${data.message || 'code=' + data.code}`);
      return false;
    }
  }

  // ========== 辅助方法 ==========

  private extractImages(obj: any): string[] {
    // 真实 API 中图片可能在多个字段
    if (obj.images && Array.isArray(obj.images)) {
      return obj.images.map((img: any) => typeof img === 'string' ? img : (img.url || img.imageUrl || ''));
    }
    if (obj.imageList && Array.isArray(obj.imageList)) {
      return obj.imageList.map((img: any) => typeof img === 'string' ? img : (img.url || img.imageUrl || ''));
    }
    // 从 coverImgUrls 提取
    if (obj.coverImgUrls && Array.isArray(obj.coverImgUrls)) {
      return obj.coverImgUrls.filter((u: any) => typeof u === 'string' && u.length > 0);
    }
    if (obj.coverImgUrl) {
      return [obj.coverImgUrl];
    }
    return [];
  }

  /**
   * 从 HTML 富文本中提取纯文字内容
   * INFORMATION 类帖子正文为 HTML（含 <img>/<video>/<p> 标签）
   */
  private extractTextContent(html: string): string {
    if (!html) return '';
    // 将 <br>, </p>, </div> 替换为换行再去除标签
    const withBreaks = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n');
    // 去除所有 HTML 标签
    const text = withBreaks.replace(/<[^>]+>/g, '').trim();
    // 合并多余空白
    return text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ');
  }
}
