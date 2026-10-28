import { describe, expect, it } from 'vitest';
import { assertLocalUsageTarget } from './local-usage-target.js';

describe('assertLocalUsageTarget', () => {
  it('allows localhost and 127.0.0.1', () => {
    expect(
      assertLocalUsageTarget('http://127.0.0.1:8080', false).hostname,
    ).toBe('127.0.0.1');
    expect(
      assertLocalUsageTarget('http://localhost:8080', false).hostname,
    ).toBe('localhost');
    expect(assertLocalUsageTarget('http://[::1]:8080', false).hostname).toBe(
      '[::1]',
    );
  });

  it('refuses a remote host unless --allow-remote is set', () => {
    expect(() => assertLocalUsageTarget('https://example.com', false)).toThrow(
      /--allow-remote/,
    );
    expect(
      assertLocalUsageTarget('https://example.com/v1/usage', true).hostname,
    ).toBe('example.com');
  });

  it('rejects an invalid URL', () => {
    expect(() => assertLocalUsageTarget('not a url', false)).toThrow(
      /Invalid URL/,
    );
    expect(() => assertLocalUsageTarget('ftp://127.0.0.1', false)).toThrow(
      /Invalid URL/,
    );
  });
});
