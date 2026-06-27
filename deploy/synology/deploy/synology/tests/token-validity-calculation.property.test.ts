/**
 * Property 3: Token validity calculation
 *
 * For any (currentTime, expiresAt) timestamps, validity SHALL equal
 * `currentTime < expiresAt - 300000`, remainingHours SHALL equal
 * `max(0, round((expiresAt - currentTime) / 3600000, 1))`
 *
 * **Validates: Requirements 2.2, 2.3, 2.5**
 */
import * as fc from 'fast-check';
import { computeTokenStatus } from '../src/services/auth';

describe('Feature: member-info-and-token-verification, Property 3: Token validity calculation', () => {
  it('valid === (currentTime < expiresAt - 300000) and remainingHours matches spec', () => {
    fc.assert(
      fc.property(
        fc.nat().map(n => n + 1), // currentTime: positive integer
        fc.nat().map(n => n + 1), // expiresAt: positive integer
        (currentTime, expiresAt) => {
          const result = computeTokenStatus(currentTime, expiresAt);

          // Property: valid === (currentTime < expiresAt - 300000)
          const expectedValid = currentTime < expiresAt - 300000;
          expect(result.valid).toBe(expectedValid);

          // Property: expiresAt is passed through
          expect(result.expiresAt).toBe(expiresAt);

          if (expectedValid) {
            // When valid: remainingHours === max(0, round((expiresAt - currentTime) / 3600000, 1))
            const expectedRemainingHours = Math.max(
              0,
              Math.round(((expiresAt - currentTime) / 3600000) * 10) / 10
            );
            expect(result.remainingHours).toBe(expectedRemainingHours);
          } else {
            // When invalid: remainingHours === 0
            expect(result.remainingHours).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
