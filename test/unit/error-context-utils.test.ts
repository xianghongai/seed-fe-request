import { describe, expect, it } from 'vitest';
import { getResponseStatus, hasResponseStatus } from '../../src/index';
import type { ErrorContext } from '../../src/types';

describe('ErrorContext helpers', () => {
  it('hasResponseStatus should narrow objects with numeric status', () => {
    expect(hasResponseStatus({ status: 401 })).toBe(true);
    expect(hasResponseStatus({ status: '401' })).toBe(false);
    expect(hasResponseStatus(null)).toBe(false);
    expect(hasResponseStatus({})).toBe(false);
  });

  it('getResponseStatus should read status from ctx.response when present', () => {
    const ctx = {
      error: new Error('x'),
      normalized: new Error('x'),
      config: { url: '/x' } as any,
      state: Object.create(null),
      response: { status: 401 },
    } as unknown as ErrorContext;
    expect(getResponseStatus(ctx)).toBe(401);

    const ctxNoResp = {
      error: new Error('x'),
      normalized: new Error('x'),
      config: { url: '/x' } as any,
      state: Object.create(null),
    } as unknown as ErrorContext;
    expect(getResponseStatus(ctxNoResp)).toBeUndefined();
  });
});
