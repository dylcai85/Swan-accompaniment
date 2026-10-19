import { describe, expect, it } from 'vitest';
import { formatBuildStamp } from '../../src/buildInfo';

describe('formatBuildStamp', () => {
  it('formats id and UTC time to the minute', () => {
    expect(formatBuildStamp('abc1234', '2026-10-19T01:40:59.123Z')).toBe('build abc1234 · 2026-10-19 01:40 UTC');
  });

  it('falls back to the id alone for an invalid time', () => {
    expect(formatBuildStamp('dev', 'not a date')).toBe('build dev');
  });
});
