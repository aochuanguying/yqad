import { PublishOptions } from '../types/posting-optimization';

// API响应类型定义

export interface MemberInfoResponse {
  memberLevel: string;   // e.g. "金卡会员"
  memberScore: string;   // e.g. "436"
  growthScore: string;   // e.g. "6651"
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // 秒
}

export interface Post {
  id: string;
  title: string;
  content: string;
  images: string[];      // 图片URL列表
  author: string;
  publishTime: string;
  likeCount: number;
  commentCount: number;
  contentType?: string;  // 真实API的帖子类型（INFORMATION/DYNAMIC/ARTICLE/NOTES）
}

export interface PostListResponse {
  posts: Post[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Comment {
  id: string;
  postId: string;
  content: string;
  author: string;
  createTime: string;
}

export interface CommentListResponse {
  comments: Comment[];
  total: number;
}

export interface PublishCommentResponse {
  success: boolean;
  commentId: string;
}

// 统一 API 接口
export interface IAudiApi {
  /** 登录获取 token */
  login(username: string, password: string): Promise<LoginResponse>;

  /** 使用 refresh_token 刷新 access_token */
  refreshToken(refreshToken: string): Promise<LoginResponse>;

  /** 获取帖子列表 */
  getPosts(accessToken: string, page: number, pageSize: number): Promise<PostListResponse>;

  /** 获取帖子评论 */
  getComments(accessToken: string, postId: string): Promise<CommentListResponse>;

  /** 发布评论 */
  publishComment(accessToken: string, postId: string, content: string, contentType?: string): Promise<PublishCommentResponse>;

  // 注意：publishPost 方法已移除，现在发帖通过 AutoJS 远程执行脚本实现
  // publishPost(accessToken: string, title: string, content: string, options?: PublishOptions): Promise<PublishPostResponse>;

  /** 上传图片到 CDN */
  uploadImages(accessToken: string, imagePaths: string[]): Promise<{ urls: string[]; failed: number }>;

  /** 获取会员信息 */
  getMemberInfo(accessToken: string): Promise<MemberInfoResponse>;

  /** 发送短信验证码（手机号登录） */
  sendSmsCode(phone: string, captchaTicket: string): Promise<boolean>;
}
