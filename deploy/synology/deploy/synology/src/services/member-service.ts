import { getLogger } from '../utils/logger';
import { MemberStorage, getMemberStorage, type Member, type CreateMemberInput, type UpdateMemberInput } from '../storage/mysql';

const logger = getLogger('member-service');

/**
 * 会员服务
 * 
 * 负责管理本地会员信息，使用 MySQL 存储
 */
export class MemberService {
  private storage: MemberStorage;

  constructor() {
    this.storage = getMemberStorage();
  }

  /**
   * 创建会员
   */
  async createMember(input: CreateMemberInput): Promise<Member> {
    logger.info(`创建会员：${input.username}`);
    return await this.storage.createMember(input);
  }

  /**
   * 根据 ID 查询会员
   */
  async getMemberById(id: string): Promise<Member | null> {
    return await this.storage.getMemberById(id);
  }

  /**
   * 根据用户名查询会员
   */
  async getMemberByUsername(username: string): Promise<Member | null> {
    return await this.storage.getMemberByUsername(username);
  }

  /**
   * 更新会员信息
   */
  async updateMember(id: string, input: UpdateMemberInput): Promise<Member | null> {
    logger.info(`更新会员：${id}`);
    return await this.storage.updateMember(id, input);
  }

  /**
   * 更新会员等级
   */
  async updateMemberLevel(
    id: string,
    level: 'free' | 'basic' | 'premium' | 'vip',
    expiresAt?: Date
  ): Promise<Member | null> {
    logger.info(`更新会员等级：${id} -> ${level}`);
    return await this.storage.updateMemberLevel(id, level, expiresAt);
  }

  /**
   * 删除会员
   */
  async deleteMember(id: string): Promise<boolean> {
    logger.info(`删除会员：${id}`);
    return await this.storage.deleteMember(id);
  }

  /**
   * 查询会员列表
   */
  async queryMembers(options?: {
    page?: number;
    pageSize?: number;
    memberLevel?: string;
    status?: string;
  }): Promise<{
    data: Member[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    return await this.storage.queryMembers(options);
  }

  /**
   * 登录验证
   */
  async authenticate(username: string, password: string, ip?: string): Promise<Member | null> {
    logger.info(`会员登录：${username}`);
    const member = await this.storage.authenticate(username, password);
    
    if (member) {
      await this.storage.updateLastLogin(member.id, ip);
      logger.info(`会员登录成功：${username}`);
    } else {
      logger.warn(`会员登录失败：${username}`);
    }
    
    return member;
  }

  /**
   * 验证密码
   */
  async verifyPassword(memberId: string, password: string): Promise<boolean> {
    return await this.storage.verifyPassword(memberId, password);
  }
}

// 单例模式
let instance: MemberService | null = null;

export const getMemberService = (): MemberService => {
  if (!instance) {
    instance = new MemberService();
  }
  return instance;
};

export const memberService = getMemberService();
