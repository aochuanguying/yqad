import { BaseDAO } from './dao/base-dao';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

/**
 * 会员信息 MySQL 存储
 */

export interface Member {
  id: string;
  username: string;
  email?: string;
  password_hash: string;
  member_level: 'free' | 'basic' | 'premium' | 'vip';
  expires_at?: Date;
  post_count: number;
  comment_count: number;
  last_login_at?: Date;
  last_login_ip?: string;
  status: 'active' | 'disabled' | 'deleted';
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMemberInput {
  username: string;
  email?: string;
  password: string;
  member_level?: 'free' | 'basic' | 'premium' | 'vip';
}

export interface UpdateMemberInput {
  username?: string;
  email?: string;
  member_level?: 'free' | 'basic' | 'premium' | 'vip';
  expires_at?: Date;
}

export class MemberStorage extends BaseDAO {
  /**
   * 创建会员
   */
  async createMember(input: CreateMemberInput): Promise<Member> {
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(input.password, 10);
    
    const sql = `
      INSERT INTO members (id, username, email, password_hash, member_level)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await this.insert(sql, [
      id,
      input.username,
      input.email || null,
      passwordHash,
      input.member_level || 'free',
    ]);
    
    const member = await this.getMemberById(id);
    if (!member) {
      throw new Error('创建会员失败：无法查询到新创建的会员');
    }
    return member;
  }

  /**
   * 根据 ID 查询会员
   */
  async getMemberById(id: string): Promise<Member | null> {
    const sql = `SELECT * FROM members WHERE id = ? AND status != 'deleted'`;
    return await this.queryOne<Member>(sql, [id]);
  }

  /**
   * 根据用户名查询会员
   */
  async getMemberByUsername(username: string): Promise<Member | null> {
    const sql = `SELECT * FROM members WHERE username = ? AND status != 'deleted'`;
    return await this.queryOne<Member>(sql, [username]);
  }

  /**
   * 更新会员信息
   */
  async updateMember(id: string, input: UpdateMemberInput): Promise<Member | null> {
    const fields: string[] = [];
    const params: any[] = [];

    if (input.username) {
      fields.push('username = ?');
      params.push(input.username);
    }
    if (input.email) {
      fields.push('email = ?');
      params.push(input.email);
    }
    if (input.member_level) {
      fields.push('member_level = ?');
      params.push(input.member_level);
    }
    if (input.expires_at) {
      fields.push('expires_at = ?');
      params.push(input.expires_at);
    }

    if (fields.length === 0) {
      return await this.getMemberById(id);
    }

    params.push(id);
    const sql = `UPDATE members SET ${fields.join(', ')} WHERE id = ?`;
    await this.update(sql, params);
    
    return await this.getMemberById(id);
  }

  /**
   * 更新会员等级
   */
  async updateMemberLevel(
    id: string,
    level: 'free' | 'basic' | 'premium' | 'vip',
    expiresAt?: Date
  ): Promise<Member | null> {
    const sql = `
      UPDATE members 
      SET member_level = ?, expires_at = ? 
      WHERE id = ?
    `;
    await this.update(sql, [level, expiresAt || null, id]);
    return await this.getMemberById(id);
  }

  /**
   * 软删除会员
   */
  async deleteMember(id: string): Promise<boolean> {
    const sql = `
      UPDATE members 
      SET status = 'deleted', deleted_at = NOW() 
      WHERE id = ?
    `;
    const affected = await this.update(sql, [id]);
    return affected > 0;
  }

  /**
   * 分页查询会员列表
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
    let sql = `SELECT * FROM members WHERE status != 'deleted'`;
    const params: any[] = [];

    if (options?.memberLevel) {
      sql += ` AND member_level = ?`;
      params.push(options.memberLevel);
    }
    if (options?.status) {
      sql += ` AND status = ?`;
      params.push(options.status);
    }

    sql += ` ORDER BY created_at DESC`;

    return await this.queryPaginated<Member>(
      sql,
      params,
      options?.page || 1,
      options?.pageSize || 20
    );
  }

  /**
   * 登录验证
   */
  async authenticate(username: string, password: string): Promise<Member | null> {
    const member = await this.getMemberByUsername(username);
    
    if (!member) {
      return null;
    }

    if (member.status !== 'active') {
      throw new Error('账号已被禁用或删除');
    }

    const passwordMatch = await bcrypt.compare(password, member.password_hash);
    if (!passwordMatch) {
      return null;
    }

    // 更新最后登录时间
    await this.updateLastLogin(member.id);
    
    // 返回不包含密码的会员信息
    const { password_hash, ...memberWithoutPassword } = member;
    return memberWithoutPassword as any;
  }

  /**
   * 更新最后登录时间
   */
  async updateLastLogin(id: string, ip?: string): Promise<void> {
    const sql = `
      UPDATE members 
      SET last_login_at = NOW(), last_login_ip = ? 
      WHERE id = ?
    `;
    await this.update(sql, [ip || null, id]);
  }

  /**
   * 验证密码
   */
  async verifyPassword(memberId: string, password: string): Promise<boolean> {
    const sql = `SELECT password_hash FROM members WHERE id = ?`;
    const member = await this.queryOne<{ password_hash: string }>(sql, [memberId]);
    
    if (!member) {
      return false;
    }

    return await bcrypt.compare(password, member.password_hash);
  }

  /**
   * 更新密码
   */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const sql = `UPDATE members SET password_hash = ? WHERE id = ?`;
    await this.update(sql, [passwordHash, id]);
  }

  /**
   * 增加发帖计数
   */
  async incrementPostCount(id: string): Promise<void> {
    const sql = `UPDATE members SET post_count = post_count + 1 WHERE id = ?`;
    await this.update(sql, [id]);
  }

  /**
   * 减少发帖计数
   */
  async decrementPostCount(id: string): Promise<void> {
    const sql = `UPDATE members SET post_count = GREATEST(post_count - 1, 0) WHERE id = ?`;
    await this.update(sql, [id]);
  }

  /**
   * 增加评论计数
   */
  async incrementCommentCount(id: string): Promise<void> {
    const sql = `UPDATE members SET comment_count = comment_count + 1 WHERE id = ?`;
    await this.update(sql, [id]);
  }

  /**
   * 减少评论计数
   */
  async decrementCommentCount(id: string): Promise<void> {
    const sql = `UPDATE members SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?`;
    await this.update(sql, [id]);
  }
}

// 导出单例
let memberStorageInstance: MemberStorage | null = null;

export const getMemberStorage = (): MemberStorage => {
  if (!memberStorageInstance) {
    memberStorageInstance = new MemberStorage();
  }
  return memberStorageInstance;
};

export default MemberStorage;
