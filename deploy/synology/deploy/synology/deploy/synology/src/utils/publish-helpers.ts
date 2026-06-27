import * as crypto from 'crypto';

/**
 * 手动 Protobuf 编码辅助：写入 length-delimited string 字段
 * Wire type 2 (length-delimited): (fieldNumber << 3) | 2
 */
function encodeStringField(fieldNumber: number, value: string): Buffer {
  const tag = (fieldNumber << 3) | 2;
  const valueBytes = Buffer.from(value, 'utf-8');
  const lengthBytes = encodeVarint(valueBytes.length);
  const tagBytes = encodeVarint(tag);
  return Buffer.concat([tagBytes, lengthBytes, valueBytes]);
}

/**
 * 编码无符号整数为 Protobuf varint 格式
 */
function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return Buffer.from(bytes);
}

/**
 * 生成 vrfCode
 *
 * 使用手动 Protobuf 编码（无外部依赖）：
 * - 字段 1 (string): deviceId
 * - 字段 2 (string): 当前毫秒时间戳
 * - 字段 3 (string): 256 字节随机数据的 Base64 编码
 * - 字段 4 (string): 固定值 "1"
 *
 * 最终输出为 Base64 编码的 Protobuf 二进制数据
 */
export function generateVrfCode(deviceId: string): string {
  const timestamp = String(Date.now());
  const randomBytes = crypto.randomBytes(256);
  const randomBase64 = randomBytes.toString('base64');
  const field1 = encodeStringField(1, deviceId);
  const field2 = encodeStringField(2, timestamp);
  const field3 = encodeStringField(3, randomBase64);
  const field4 = encodeStringField(4, '1');
  const protobufData = Buffer.concat([field1, field2, field3, field4]);
  return protobufData.toString('base64');
}

/**
 * 构建 contentJson 字段
 *
 * 将帖子正文内容构建为结构化富文本 JSON 字符串：
 * [{content: "正文内容", inlineStyleEntities: [], blocktype: "block_normal_text"}]
 */
export function buildContentJson(content: string): string {
  const structure = [
    {
      content,
      inlineStyleEntities: [],
      blocktype: 'block_normal_text',
    },
  ];
  return JSON.stringify(structure);
}
