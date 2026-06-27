import { computeTokenStatus } from '../src/services/auth';

describe('computeTokenStatus', () => {
  it('returns valid=true with correct remainingHours when token has > 5 minutes remaining', () => {
    const now = 1000000000000;
    const expiresAt = now + 3600000 * 24; // 24 hours from now
    const result = computeTokenStatus(now, expiresAt);

    expect(result.valid).toBe(true);
    expect(result.expiresAt).toBe(expiresAt);
    expect(result.remainingHours).toBe(24);
  });

  it('returns valid=false and remainingHours=0 when remaining ≤ 5 minutes', () => {
    const now = 1000000000000;
    const expiresAt = now + 300000; // exactly 5 minutes from now
    const result = computeTokenStatus(now, expiresAt);

    expect(result.valid).toBe(false);
    expect(result.expiresAt).toBe(expiresAt);
    expect(result.remainingHours).toBe(0);
  });

  it('returns valid=false and remainingHours=0 when token is already expired', () => {
    const now = 1000000000000;
    const expiresAt = now - 3600000; // 1 hour in the past
    const result = computeTokenStatus(now, expiresAt);

    expect(result.valid).toBe(false);
    expect(result.expiresAt).toBe(expiresAt);
    expect(result.remainingHours).toBe(0);
  });

  it('returns valid=true when remaining is just over 5 minutes', () => {
    const now = 1000000000000;
    const expiresAt = now + 300001; // 5 min + 1ms
    const result = computeTokenStatus(now, expiresAt);

    expect(result.valid).toBe(true);
    expect(result.expiresAt).toBe(expiresAt);
    // (300001 / 3600000) ≈ 0.0833 → rounds to 0.1
    expect(result.remainingHours).toBe(0.1);
  });

  it('rounds remainingHours to one decimal place', () => {
    const now = 1000000000000;
    // 7.55 hours remaining → (7.55 * 3600000) = 27180000
    const expiresAt = now + 27180000;
    const result = computeTokenStatus(now, expiresAt);

    expect(result.valid).toBe(true);
    expect(result.remainingHours).toBe(7.6); // 7.55 rounds to 7.6
  });
});
