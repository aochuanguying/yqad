/**
 * Property 6: Token status color indicator determination
 *
 * For any valid token with remainingHours > 0, the frontend color indicator SHALL be
 * green when remainingHours > 24, yellow when 6 ≤ remainingHours < 24, and red when
 * remainingHours < 6. These three ranges are exhaustive and mutually exclusive for all
 * positive remainingHours values.
 *
 * **Validates: Requirements 5.2, 5.3, 5.4**
 */
import * as fc from 'fast-check';

/**
 * Extracted from src/web/public/index.html - getTokenColorConfig function.
 * Determines the color configuration for the token status display.
 */
function getTokenColorConfig(tokenStatus: { valid: boolean; remainingHours?: number } | null) {
  if (!tokenStatus || !tokenStatus.valid) {
    return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', subtext: 'text-red-600', indicator: 'bg-red-500', icon: '❌' };
  }
  const hours = tokenStatus.remainingHours || 0;
  if (hours > 24) {
    return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', subtext: 'text-green-600', indicator: 'bg-green-500', icon: '✅' };
  }
  if (hours >= 6) {
    return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', subtext: 'text-yellow-600', indicator: 'bg-yellow-500', icon: '⚠️' };
  }
  return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', subtext: 'text-red-600', indicator: 'bg-red-500', icon: '🔴' };
}

/** Helper to determine the color category from the config */
function getColorCategory(config: ReturnType<typeof getTokenColorConfig>): 'green' | 'yellow' | 'red' {
  if (config.indicator === 'bg-green-500') return 'green';
  if (config.indicator === 'bg-yellow-500') return 'yellow';
  return 'red';
}

describe('Feature: member-info-and-token-verification, Property 6: Token status color indicator determination', () => {
  it('assigns green when remainingHours > 24', () => {
    fc.assert(
      fc.property(
        // Generate remainingHours > 24 (up to 100)
        fc.double({ min: 24.001, max: 100, noNaN: true }),
        (remainingHours) => {
          const config = getTokenColorConfig({ valid: true, remainingHours });
          expect(getColorCategory(config)).toBe('green');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('assigns yellow when 6 ≤ remainingHours < 24', () => {
    fc.assert(
      fc.property(
        // Generate remainingHours in [6, 24) range
        fc.double({ min: 6, max: 23.999, noNaN: true }),
        (remainingHours) => {
          const config = getTokenColorConfig({ valid: true, remainingHours });
          expect(getColorCategory(config)).toBe('yellow');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('assigns red when remainingHours < 6', () => {
    fc.assert(
      fc.property(
        // Generate remainingHours in (0, 6) range
        fc.double({ min: 0.001, max: 5.999, noNaN: true }),
        (remainingHours) => {
          const config = getTokenColorConfig({ valid: true, remainingHours });
          expect(getColorCategory(config)).toBe('red');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('assigns red when token is invalid', () => {
    fc.assert(
      fc.property(
        // Any positive remainingHours should still be red if valid=false
        fc.double({ min: 0.001, max: 100, noNaN: true }),
        (remainingHours) => {
          const config = getTokenColorConfig({ valid: false, remainingHours });
          expect(getColorCategory(config)).toBe('red');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ranges are exhaustive and mutually exclusive for all positive remainingHours', () => {
    fc.assert(
      fc.property(
        // Generate any positive remainingHours in (0, 100)
        fc.double({ min: 0.001, max: 100, noNaN: true }),
        (remainingHours) => {
          const config = getTokenColorConfig({ valid: true, remainingHours });
          const color = getColorCategory(config);

          // Verify exhaustive: every positive value maps to exactly one color
          expect(['green', 'yellow', 'red']).toContain(color);

          // Verify mutually exclusive: the color matches exactly one range condition
          if (remainingHours > 24) {
            expect(color).toBe('green');
          } else if (remainingHours >= 6) {
            expect(color).toBe('yellow');
          } else {
            expect(color).toBe('red');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
