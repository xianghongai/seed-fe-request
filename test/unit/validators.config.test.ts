import { describe, expect, it } from 'vitest';
import type { CustomRequestConfig } from '../../src/types';
import { validateRequestConfig } from '../../src/utils/validators';

describe('validateRequestConfig', () => {
  it('接受最小合法配置', () => {
    const cfg = { url: '/ok' } as CustomRequestConfig;
    expect(() => validateRequestConfig(cfg)).not.toThrow();
  });

  it('baseURL 非字符串应抛错', () => {
    const cfg = { url: '/x', baseURL: 123 as unknown as string } as CustomRequestConfig;
    expect(() => validateRequestConfig(cfg)).toThrow('baseURL must be a string');
  });

  it('baseURL 非 http/https 应抛错', () => {
    const cfg = { url: '/x', baseURL: 'ftp://example.com' } as CustomRequestConfig;
    expect(() => validateRequestConfig(cfg)).toThrow('Invalid baseURL');
  });

  it('timeout 负数应抛错', () => {
    const cfg = { url: '/x', timeout: -1 } as CustomRequestConfig;
    expect(() => validateRequestConfig(cfg)).toThrow('Invalid timeout');
  });

  it('拦截器形状非法应抛错', () => {
    const cfg = { url: '/x', interceptors: { request: 123 as unknown as any } } as CustomRequestConfig;
    expect(() => validateRequestConfig(cfg)).toThrow('Invalid request interceptor type');
  });
});
