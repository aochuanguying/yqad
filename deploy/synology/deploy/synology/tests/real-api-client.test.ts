/**
 * RealAudiApi 单元测试
 * 测试 Feed 响应映射逻辑（INFORMATION/DYNAMIC/ARTICLE/NOTES/ACTIVITY）
 */
import axios from 'axios';
import { RealAudiApi } from '../src/api/real-client';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock config
jest.mock('../src/utils/config', () => ({
  loadConfig: () => ({
    api: {
      mode: 'real',
      baseUrl: 'https://audi2c.faw-vw.com',
      timeout: 10000,
      deviceId: 'TEST_DEVICE_ID',
      nickName: '测试用户',
      ipRegion: '北京市',
    },
    auth: { username: '', password: '', tokenStorePath: './data/token.json' },
  }),
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('RealAudiApi', () => {
  let api: RealAudiApi;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    api = new RealAudiApi();
  });

  describe('getPosts - Feed 映射', () => {
    const mockFeedResponse = (records: any[]) => ({
      data: { code: 0, data: { records } },
      headers: {},
    });

    it('正确映射 INFORMATION 类型帖子', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockFeedResponse([
        {
          contentType: 'INFORMATION',
          information: {
            id: '2062818271588560898',
            title: '新车资讯标题',
            content: '<p>内容正文</p>',
            commentCount: 42,
            likeCount: 100,
            nickName: '官方账号',
            createTime: '2026-06-01T10:00:00Z',
          },
          subject: null,
          activity: null,
          nous: null,
        },
      ]));

      const result = await api.getPosts('test-token', 1, 20);

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0]).toMatchObject({
        id: '2062818271588560898',
        title: '新车资讯标题',
        content: '内容正文',
        contentType: 'INFORMATION',
        commentCount: 42,
        likeCount: 100,
        author: '官方账号',
      });
    });

    it('正确映射 DYNAMIC 类型帖子', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockFeedResponse([
        {
          contentType: 'DYNAMIC',
          information: null,
          subject: {
            id: '123456789',
            title: '',
            content: '动态内容文本',
            commentCount: 10,
            praiseCount: 25,
            nickName: '用户A',
            createTime: '2026-06-02T12:00:00Z',
          },
          activity: null,
          nous: null,
        },
      ]));

      const result = await api.getPosts('test-token', 1, 20);

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0]).toMatchObject({
        id: '123456789',
        contentType: 'DYNAMIC',
        content: '动态内容文本',
        likeCount: 25,
      });
    });

    it('正确映射 ARTICLE 类型帖子', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockFeedResponse([
        {
          contentType: 'ARTICLE',
          information: null,
          subject: {
            id: '987654321',
            title: '文章标题',
            content: '文章正文',
            commentCount: 5,
            likeCount: 50,
            nickName: '作者B',
          },
          activity: null,
          nous: null,
        },
      ]));

      const result = await api.getPosts('test-token', 1, 20);

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].contentType).toBe('ARTICLE');
      expect(result.posts[0].title).toBe('文章标题');
    });

    it('正确映射 NOTES 类型帖子', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockFeedResponse([
        {
          contentType: 'NOTES',
          information: null,
          subject: null,
          activity: null,
          nous: {
            id: '555555',
            content: '笔记内容',
            commentCount: 2,
            likeCount: 8,
            nickName: '笔记用户',
          },
        },
      ]));

      const result = await api.getPosts('test-token', 1, 20);

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].contentType).toBe('NOTES');
      expect(result.posts[0].id).toBe('555555');
    });

    it('跳过 ACTIVITY 类型（不可评论）', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockFeedResponse([
        {
          contentType: 'ACTIVITY',
          information: null,
          subject: null,
          activity: { id: '111', title: '活动' },
          nous: null,
        },
      ]));

      const result = await api.getPosts('test-token', 1, 20);

      expect(result.posts).toHaveLength(0);
    });

    it('跳过未知 contentType', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockFeedResponse([
        {
          contentType: 'UNKNOWN_TYPE',
          information: null,
          subject: null,
          activity: null,
          nous: null,
        },
      ]));

      const result = await api.getPosts('test-token', 1, 20);

      expect(result.posts).toHaveLength(0);
    });

    it('混合多种类型正确映射', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockFeedResponse([
        { contentType: 'INFORMATION', information: { id: '1', title: 'Info', content: '', commentCount: 1, likeCount: 1, nickName: 'A' }, subject: null, activity: null, nous: null },
        { contentType: 'DYNAMIC', information: null, subject: { id: '2', title: '', content: 'Dyn', commentCount: 2, praiseCount: 2, nickName: 'B' }, activity: null, nous: null },
        { contentType: 'ACTIVITY', information: null, subject: null, activity: { id: '3', title: 'Act' }, nous: null },
        { contentType: 'NOTES', information: null, subject: null, activity: null, nous: { id: '4', content: 'Note', commentCount: 0, likeCount: 0, nickName: 'D' } },
      ]));

      const result = await api.getPosts('test-token', 1, 20);

      expect(result.posts).toHaveLength(3); // ACTIVITY 被跳过
      expect(result.posts.map(p => p.contentType)).toEqual(['INFORMATION', 'DYNAMIC', 'NOTES']);
    });

    it('HTML 标签从 title/content 中被清除', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockFeedResponse([
        {
          contentType: 'INFORMATION',
          information: {
            id: '999',
            title: '<b>加粗标题</b>',
            content: '<p>段落<br/>换行</p>',
            commentCount: 0,
            likeCount: 0,
            nickName: 'X',
          },
          subject: null, activity: null, nous: null,
        },
      ]));

      const result = await api.getPosts('test-token', 1, 20);

      expect(result.posts[0].title).toBe('加粗标题');
      expect(result.posts[0].content).toBe('段落\n换行');
    });
  });

  describe('publishComment', () => {
    it('成功发布评论', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { code: 0, data: true },
        headers: {},
      });

      const result = await api.publishComment('token', 'post-123', '好内容', 'INFORMATION');

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.stringContaining('/cnapi/v1/comment_center/comment/save'),
        expect.objectContaining({
          content: '好内容',
          subjectId: 'post-123',
          subjectContentTypeEnum: 'INFORMATION',
          nickName: '测试用户',
          ipRegion: '北京市',
        }),
        expect.any(Object),
      );
    });

    it('评论失败返回 success=false', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { code: 400, message: '参数错误' },
        headers: {},
      });

      const result = await api.publishComment('token', '', '内容', 'DYNAMIC');

      expect(result.success).toBe(false);
    });
  });

  describe('signin', () => {
    it('返回不可用状态', async () => {
      const result = await api.signin('any-token');

      expect(result.success).toBe(false);
      expect(result.message).toContain('暂不可用');
    });
  });

  describe('getComments', () => {
    it('返回空数组', async () => {
      const result = await api.getComments('token', 'post-id');

      expect(result.comments).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('uploadImages', () => {
    const mockFsStatSync = jest.fn();
    const mockFsCreateReadStream = jest.fn();
    const mockFormAppend = jest.fn();

    beforeEach(() => {
      jest.spyOn(require('fs'), 'statSync').mockImplementation(mockFsStatSync);
      jest.spyOn(require('fs'), 'createReadStream').mockImplementation(mockFsCreateReadStream);
      mockFsCreateReadStream.mockReturnValue('mock-stream');
      jest.spyOn(require('form-data').prototype, 'append').mockImplementation(mockFormAppend);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('空数组返回空结果', async () => {
      const result = await api.uploadImages('token', []);
      expect(result.urls).toEqual([]);
      expect(result.failed).toBe(0);
    });

    it('成功上传图片并返回CDN URL', async () => {
      mockFsStatSync.mockReturnValue({ size: 1024 * 1024 }); // 1MB
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          code: 0,
          data: [
            { url: 'https://cdn.example.com/img1.jpg' },
            { url: 'https://cdn.example.com/img2.jpg' },
          ],
        },
        headers: {},
      });

      const result = await api.uploadImages('token', ['/path/img1.jpg', '/path/img2.png']);

      expect(result.urls).toHaveLength(2);
      expect(result.urls[0]).toBe('https://cdn.example.com/img1.jpg');
      expect(result.urls[1]).toBe('https://cdn.example.com/img2.jpg');
      expect(result.failed).toBe(0);
      expect(mockFormAppend).toHaveBeenCalledWith('componentName', 'userComplaint');
      expect(mockFormAppend).toHaveBeenCalledWith('fileType', 'img');
      expect(mockFormAppend).toHaveBeenCalledWith('privatePermanent', 'false');
      expect(mockFormAppend).toHaveBeenCalledWith('serviceName', 'user');
      expect(mockFormAppend).toHaveBeenCalledWith('publicRead', 'true');
    });

    it('支持解析上传接口返回的 preSignedUrl', async () => {
      mockFsStatSync.mockReturnValue({ size: 1024 * 1024 });
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          code: 0,
          data: [
            { preSignedUrl: 'https://faw-audi-public-prod.example.com/user/userComplaint/img.jpg' },
          ],
        },
        headers: {},
      });

      const result = await api.uploadImages('token', ['/path/img.jpg']);

      expect(result.urls).toEqual(['https://faw-audi-public-prod.example.com/user/userComplaint/img.jpg']);
      expect(result.failed).toBe(0);
    });

    it('跳过超过10MB的文件', async () => {
      mockFsStatSync.mockImplementation((filePath: string) => {
        if (filePath.includes('big')) {
          return { size: 11 * 1024 * 1024 }; // 11MB
        }
        return { size: 1024 * 1024 }; // 1MB
      });
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          code: 0,
          data: [{ url: 'https://cdn.example.com/small.jpg' }],
        },
        headers: {},
      });

      const result = await api.uploadImages('token', ['/path/big.jpg', '/path/small.jpg']);

      expect(result.urls).toHaveLength(1);
      expect(result.failed).toBe(1); // big.jpg was skipped
    });

    it('最多上传9张图片', async () => {
      mockFsStatSync.mockReturnValue({ size: 1024 }); // small files
      const paths = Array.from({ length: 12 }, (_, i) => `/path/img${i}.jpg`);
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          code: 0,
          data: Array.from({ length: 9 }, (_, i) => ({ url: `https://cdn.example.com/img${i}.jpg` })),
        },
        headers: {},
      });

      const result = await api.uploadImages('token', paths);

      expect(result.urls).toHaveLength(9);
      expect(result.failed).toBe(3); // 3 truncated
    });

    it('上传API返回非零code时返回失败', async () => {
      mockFsStatSync.mockReturnValue({ size: 1024 });
      mockAxiosInstance.post.mockResolvedValue({
        data: { code: 500, message: '服务器错误' },
        headers: {},
      });

      const result = await api.uploadImages('token', ['/path/img.jpg']);

      expect(result.urls).toEqual([]);
      expect(result.failed).toBe(1);
    });

    it('网络请求失败时返回全部失败', async () => {
      mockFsStatSync.mockReturnValue({ size: 1024 });
      mockAxiosInstance.post.mockRejectedValue(new Error('Network Error'));

      const result = await api.uploadImages('token', ['/path/img1.jpg', '/path/img2.jpg']);

      expect(result.urls).toEqual([]);
      expect(result.failed).toBe(2);
    });

    it('检测Token续期', async () => {
      mockFsStatSync.mockReturnValue({ size: 1024 });
      const mockCallback = jest.fn();
      api.setTokenRenewalCallback(mockCallback);

      mockAxiosInstance.post.mockResolvedValue({
        data: {
          code: 0,
          data: [{ url: 'https://cdn.example.com/img.jpg' }],
        },
        headers: { 'x-access-token': 'eyJuZXdUb2tlbg==' },
      });

      await api.uploadImages('old-token', ['/path/img.jpg']);

      expect(mockCallback).toHaveBeenCalledWith('eyJuZXdUb2tlbg==');
    });

    it('所有文件不可读时返回全部失败', async () => {
      mockFsStatSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });

      const result = await api.uploadImages('token', ['/path/missing.jpg']);

      expect(result.urls).toEqual([]);
      expect(result.failed).toBe(1);
    });
  });
});
