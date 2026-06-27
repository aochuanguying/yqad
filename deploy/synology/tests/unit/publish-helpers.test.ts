import { generateVrfCode, buildContentJson } from '../../src/utils/publish-helpers';
import fc from 'fast-check';

describe('publish-helpers', () => {
  describe('buildContentJson', () => {
    it('should return a valid JSON string', () => {
      const result = buildContentJson('测试内容');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should produce an array with one element', () => {
      const result = buildContentJson('hello');
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
    });

    it('should contain correct structure fields', () => {
      const content = '帖子正文内容';
      const result = buildContentJson(content);
      const parsed = JSON.parse(result);
      expect(parsed[0]).toEqual({
        content,
        inlineStyleEntities: [],
        blocktype: 'block_normal_text',
      });
    });

    it('should handle empty string', () => {
      const result = buildContentJson('');
      const parsed = JSON.parse(result);
      expect(parsed[0].content).toBe('');
    });

    it('should handle content with special characters', () => {
      const content = '包含"引号"和\\反斜杠和\n换行';
      const result = buildContentJson(content);
      const parsed = JSON.parse(result);
      expect(parsed[0].content).toBe(content);
    });

    // Feature: posting-optimization, Property 8: contentJson 构建正确性
    // **Validates: Requirements 5.3**
    it('Property 8: any valid string round-trips through buildContentJson', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = buildContentJson(input);

          // 1. Result is valid JSON (JSON.parse doesn't throw)
          const parsed = JSON.parse(result);

          // 2. Parsed result is an array
          expect(Array.isArray(parsed)).toBe(true);

          // 3. Array first element's content field equals the original input string
          expect(parsed[0].content).toBe(input);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('generateVrfCode', () => {
    it('should return a valid Base64 string', () => {
      const deviceId = 'AUDI_APP_iPhone_71A0E430-DB97-448F-868A-A6352E31FC13_26.5_6.1.1';
      const result = generateVrfCode(deviceId);
      // Check if it's valid Base64
      const decoded = Buffer.from(result, 'base64');
      expect(decoded.length).toBeGreaterThan(0);
      // Re-encode should match original
      expect(decoded.toString('base64')).toBe(result);
    });

    it('should contain the deviceId in decoded protobuf', () => {
      const deviceId = 'AUDI_APP_iPhone_TEST_DEVICE';
      const result = generateVrfCode(deviceId);
      const decoded = Buffer.from(result, 'base64');
      // The deviceId should be present as raw bytes in the protobuf
      expect(decoded.includes(Buffer.from(deviceId, 'utf-8'))).toBe(true);
    });

    it('should contain a valid millisecond timestamp', () => {
      const before = Date.now();
      const result = generateVrfCode('test-device');
      const after = Date.now();
      const decoded = Buffer.from(result, 'base64');
      const decodedStr = decoded.toString('utf-8');
      // Find a number that looks like a timestamp (13 digits)
      const timestampMatch = decodedStr.match(/(\d{13})/);
      expect(timestampMatch).not.toBeNull();
      const ts = Number(timestampMatch![1]);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('should contain the fixed value "1"', () => {
      const result = generateVrfCode('device123');
      const decoded = Buffer.from(result, 'base64');
      // Field 4 with value "1" should be in the protobuf
      // Field 4, wire type 2 -> tag = (4 << 3) | 2 = 34 = 0x22
      // Length = 1 (for "1")
      // Value = 0x31 ("1")
      const field4Bytes = Buffer.from([0x22, 0x01, 0x31]);
      expect(decoded.includes(field4Bytes)).toBe(true);
    });

    it('should produce different results on each call (randomness)', () => {
      const deviceId = 'same-device';
      const result1 = generateVrfCode(deviceId);
      const result2 = generateVrfCode(deviceId);
      // Due to random bytes and timestamp, results should differ
      expect(result1).not.toBe(result2);
    });
  });

  // Feature: posting-optimization, Property 9: vrfCode 编码结构正确性
  // **Validates: Requirements 5.3**
  describe('Property 9: vrfCode 编码结构正确性', () => {
    const PBT_CONFIG = { numRuns: 100 };

    it('should produce valid Base64 output for any non-empty deviceId', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (deviceId) => {
            const result = generateVrfCode(deviceId);
            // Verify valid Base64: re-encoding decoded buffer matches original
            const decoded = Buffer.from(result, 'base64');
            expect(decoded.toString('base64')).toBe(result);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should contain the deviceId bytes in decoded output', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (deviceId) => {
            const result = generateVrfCode(deviceId);
            const decoded = Buffer.from(result, 'base64');
            const deviceIdBytes = Buffer.from(deviceId, 'utf-8');
            expect(decoded.includes(deviceIdBytes)).toBe(true);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should contain a valid millisecond timestamp (13-digit number close to Date.now())', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (deviceId) => {
            const before = Date.now();
            const result = generateVrfCode(deviceId);
            const after = Date.now();
            const decoded = Buffer.from(result, 'base64');
            const decodedStr = decoded.toString('utf-8');
            // Find a 13-digit number that represents a millisecond timestamp
            const timestampMatch = decodedStr.match(/(\d{13})/);
            expect(timestampMatch).not.toBeNull();
            const ts = Number(timestampMatch![1]);
            expect(ts).toBeGreaterThanOrEqual(before);
            expect(ts).toBeLessThanOrEqual(after);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should contain Protobuf encoding of field 4 with value "1" (bytes [0x22, 0x01, 0x31])', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (deviceId) => {
            const result = generateVrfCode(deviceId);
            const decoded = Buffer.from(result, 'base64');
            // Field 4, wire type 2 -> tag = (4 << 3) | 2 = 34 = 0x22
            // Length = 1 byte -> 0x01
            // Value = "1" -> 0x31
            const field4Bytes = Buffer.from([0x22, 0x01, 0x31]);
            expect(decoded.includes(field4Bytes)).toBe(true);
          }
        ),
        PBT_CONFIG
      );
    });
  });
});
