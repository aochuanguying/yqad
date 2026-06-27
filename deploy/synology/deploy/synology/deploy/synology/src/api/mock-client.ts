import {
  IAudiApi,
  LoginResponse,
  PostListResponse,
  CommentListResponse,
  PublishCommentResponse,
  PublishPostResponse,
  MemberInfoResponse,
  Post,
  Comment,
} from './types';
import { PublishOptions } from '../types/posting-optimization';

// Mock数据：模拟社区帖子
const MOCK_POSTS: Post[] = [
  {
    // 类型1：纯文字帖子
    id: 'post-001',
    title: '新款Q5L提车作业，分享一下用车感受',
    content: '上个月提的Q5L 45TFSI，目前开了1500公里，整体感受非常满意。动力充沛，底盘质感出色，quattro四驱在雨天给人很强的信心。内饰做工精致，虚拟座舱科技感十足。油耗目前在9L左右，对于这个级别的SUV来说表现不错。',
    images: [],
    author: '奥迪车主小王',
    publishTime: '2024-01-15T10:30:00Z',
    likeCount: 128,
    commentCount: 45,
  },
  {
    // 类型1：纯文字帖子
    id: 'post-002',
    title: 'A4L 2024款有哪些升级？值得等吗？',
    content: '听说2024款A4L要上新了，有了解的朋友吗？主要想知道动力系统有没有变化，还有内饰是不是用了新一代MMI。目前开的19款A4L，考虑要不要置换。',
    images: [],
    author: '等等党',
    publishTime: '2024-01-14T15:20:00Z',
    likeCount: 89,
    commentCount: 67,
  },
  {
    // 类型2：长图文帖子（正文为空，内容全在图片里）
    id: 'post-003',
    title: '冬季保养小贴士，这几点要注意',
    content: '',
    images: ['https://mock.example.com/post-003-longtext.jpg'],
    author: '老司机分享',
    publishTime: '2024-01-13T09:00:00Z',
    likeCount: 256,
    commentCount: 89,
  },
  {
    // 类型3：文字+图片的常规图文帖
    id: 'post-004',
    title: '奥迪e-tron GT实拍，这设计真的绝了',
    content: '周末去4S店看了实车，e-tron GT的设计真的惊艳。',
    images: [
      'https://mock.example.com/etron-gt-front.jpg',
      'https://mock.example.com/etron-gt-interior.jpg',
    ],
    author: '设计控',
    publishTime: '2024-01-12T14:45:00Z',
    likeCount: 345,
    commentCount: 112,
  },
  {
    // 类型3：文字+图片的常规图文帖
    id: 'post-005',
    title: '关于一汽奥迪售后服务的一些建议',
    content: '最近去做了一次大保养，整体体验还可以，但是有几点建议。',
    images: ['https://mock.example.com/maintenance-receipt.jpg'],
    author: '用心体验',
    publishTime: '2024-01-11T11:30:00Z',
    likeCount: 178,
    commentCount: 93,
  },
];

// Mock评论数据
const MOCK_COMMENTS: Record<string, Comment[]> = {
  'post-001': [
    { id: 'c-001', postId: 'post-001', content: '恭喜提车！Q5L确实是同级别里综合实力很强的选择', author: '路人A', createTime: '2024-01-15T11:00:00Z' },
    { id: 'c-002', postId: 'post-001', content: '45TFSI动力真的够用，城市高速都游刃有余', author: '同款车主', createTime: '2024-01-15T12:30:00Z' },
    { id: 'c-003', postId: 'post-001', content: '请问落地多少？有什么优惠吗', author: '准备入手', createTime: '2024-01-15T14:00:00Z' },
  ],
  'post-002': [
    { id: 'c-004', postId: 'post-002', content: '据说会换EA888 evo4发动机，动力和油耗都有提升', author: '消息灵通', createTime: '2024-01-14T16:00:00Z' },
    { id: 'c-005', postId: 'post-002', content: '19款到现在也5年了，差不多可以考虑换了', author: '过来人', createTime: '2024-01-14T17:20:00Z' },
  ],
  'post-003': [
    { id: 'c-006', postId: 'post-003', content: '感谢分享，正好准备去做冬季保养', author: '新手小白', createTime: '2024-01-13T10:00:00Z' },
    { id: 'c-007', postId: 'post-003', content: '电瓶确实要注意，我去年冬天趴窝了一次', author: '有经验', createTime: '2024-01-13T11:30:00Z' },
  ],
  'post-004': [
    { id: 'c-008', postId: 'post-004', content: 'e-tron GT确实帅，就是价格有点高', author: '颜值党', createTime: '2024-01-12T15:30:00Z' },
  ],
  'post-005': [
    { id: 'c-009', postId: 'post-005', content: '同意，预约系统确实需要优化', author: '深有同感', createTime: '2024-01-11T12:00:00Z' },
  ],
};

let commentIdCounter = 100;
let postIdCounter = 100;

export class MockAudiApi implements IAudiApi {
  async login(username: string, password: string): Promise<LoginResponse> {
    // 模拟网络延时
    await this.delay(100);
    return {
      access_token: `mock_access_token_${Date.now()}`,
      refresh_token: `mock_refresh_token_${Date.now()}`,
      expires_in: 7200, // 2小时过期
    };
  }

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    await this.delay(100);
    return {
      access_token: `mock_access_token_refreshed_${Date.now()}`,
      refresh_token: `mock_refresh_token_refreshed_${Date.now()}`,
      expires_in: 7200,
    };
  }

  async getPosts(accessToken: string, page: number, pageSize: number): Promise<PostListResponse> {
    await this.delay(150);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedPosts = MOCK_POSTS.slice(start, end);
    return {
      posts: paginatedPosts,
      total: MOCK_POSTS.length,
      page,
      pageSize,
    };
  }

  async getComments(accessToken: string, postId: string): Promise<CommentListResponse> {
    await this.delay(100);
    const comments = MOCK_COMMENTS[postId] || [];
    return {
      comments,
      total: comments.length,
    };
  }

  async publishComment(accessToken: string, postId: string, content: string, contentType?: string): Promise<PublishCommentResponse> {
    await this.delay(200);
    commentIdCounter++;
    return {
      success: true,
      commentId: `c-${commentIdCounter}`,
    };
  }

  async publishPost(accessToken: string, title: string, content: string, options?: PublishOptions): Promise<PublishPostResponse> {
    await this.delay(200);
    postIdCounter++;
    return {
      success: true,
      postId: `post-${postIdCounter}`,
    };
  }

  async uploadImages(accessToken: string, imagePaths: string[]): Promise<{ urls: string[]; failed: number }> {
    await this.delay(300);
    const urls = imagePaths.map((_, i) => `https://mock-cdn.example.com/image-${Date.now()}-${i}.jpg`);
    return { urls, failed: 0 };
  }

  async getMemberInfo(accessToken: string): Promise<MemberInfoResponse> {
    await this.delay(100);
    return {
      memberLevel: '金卡会员',
      memberScore: '436',
      growthScore: '6651',
    };
  }

  async sendSmsCode(phone: string, captchaTicket: string): Promise<boolean> {
    await this.delay(100);
    // Mock 实现：总是返回成功
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
