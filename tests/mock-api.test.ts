import { MockAudiApi } from '../src/api/mock-client';
import { IAudiApi } from '../src/api/types';

describe('MockAudiApi', () => {
  let api: IAudiApi;

  beforeEach(() => {
    api = new MockAudiApi();
  });

  describe('login', () => {
    it('should return access_token and refresh_token', async () => {
      const result = await api.login('testuser', 'testpass');
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('expires_in');
      expect(typeof result.access_token).toBe('string');
      expect(typeof result.refresh_token).toBe('string');
      expect(result.expires_in).toBeGreaterThan(0);
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens', async () => {
      const result = await api.refreshToken('old_refresh_token');
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.access_token).toContain('refreshed');
    });
  });

  describe('signin', () => {
    it('should return success status and points', async () => {
      const result = await api.signin('mock_token');
      expect(result.success).toBe(true);
      expect(result.points).toBeGreaterThan(0);
      expect(typeof result.message).toBe('string');
    });
  });

  describe('getPosts', () => {
    it('should return posts array with required fields', async () => {
      const result = await api.getPosts('mock_token', 1, 10);
      expect(result.posts).toBeInstanceOf(Array);
      expect(result.posts.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);

      const post = result.posts[0];
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('content');
      expect(post).toHaveProperty('author');
      expect(post).toHaveProperty('publishTime');
    });

    it('should support pagination', async () => {
      const result = await api.getPosts('mock_token', 1, 2);
      expect(result.posts.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getComments', () => {
    it('should return comments for a post', async () => {
      const result = await api.getComments('mock_token', 'post-001');
      expect(result.comments).toBeInstanceOf(Array);
      expect(result.comments.length).toBeGreaterThan(0);

      const comment = result.comments[0];
      expect(comment).toHaveProperty('id');
      expect(comment).toHaveProperty('postId');
      expect(comment).toHaveProperty('content');
      expect(comment).toHaveProperty('author');
      expect(comment).toHaveProperty('createTime');
    });

    it('should return empty array for unknown post', async () => {
      const result = await api.getComments('mock_token', 'unknown-post');
      expect(result.comments).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('publishComment', () => {
    it('should return success and commentId', async () => {
      const result = await api.publishComment('mock_token', 'post-001', '测试评论');
      expect(result.success).toBe(true);
      expect(typeof result.commentId).toBe('string');
      expect(result.commentId.length).toBeGreaterThan(0);
    });
  });

  describe('publishPost', () => {
    it('should return success and postId', async () => {
      const result = await api.publishPost('mock_token', '测试标题', '测试正文内容');
      expect(result.success).toBe(true);
      expect(typeof result.postId).toBe('string');
      expect(result.postId.length).toBeGreaterThan(0);
    });
  });
});
