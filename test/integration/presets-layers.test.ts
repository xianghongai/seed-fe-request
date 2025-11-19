import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllInstances, defineRequestConfig, defineSharedPreset, getRequestInstance } from '../../src/index';
import type { RequestHandler } from '../../src/types';
import { createMockResponse, mockAxiosInstance, resetAllMocks } from '../utils/mocks';

// Mock logger
vi.mock('@seed-fe/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('集成：共享预设应用于多个实例', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();
  });

  it('两个实例共享预设后同时发起请求，onRequest 手动链生效（示意）', async () => {
    const onRequest: RequestHandler = (cfg: any) => {
      cfg.headers = cfg.headers || {};
      (cfg.headers as any)['X-Demo'] = 'demo';
      return cfg;
    };
    defineSharedPreset({ onRequest: { handlers: [onRequest] }, onError: { handlers: [] } });

    defineRequestConfig({ instanceName: 'I1' });
    defineRequestConfig({ instanceName: 'I2' });

    // 默认启用共享预设，无需额外调用

    (mockAxiosInstance.request as any).mockResolvedValueOnce(createMockResponse({ ok: true }));
    (mockAxiosInstance.request as any).mockResolvedValueOnce(createMockResponse({ ok: true }));

    await Promise.all([getRequestInstance('I1')({ url: '/i1' }), getRequestInstance('I2')({ url: '/i2' })]);

    const calls = (mockAxiosInstance.request as any).mock.calls;
    expect(calls[0][0].headers['X-Demo']).toBe('demo');
    expect(calls[1][0].headers['X-Demo']).toBe('demo');
  });

  it('实例级覆盖禁用 onRequest 不影响其他实例', async () => {
    const onRequest: RequestHandler = (cfg: any) => {
      cfg.headers = cfg.headers || {};
      (cfg.headers as any)['X-Demo'] = 'demo';
      return cfg;
    };
    defineSharedPreset({ onRequest: { handlers: [onRequest] } });
    defineRequestConfig({ instanceName: 'A', presetOverrides: { onRequest: { enabled: false } } });
    defineRequestConfig({ instanceName: 'B' });

    (mockAxiosInstance.request as any).mockResolvedValueOnce(createMockResponse({ ok: true }));
    await getRequestInstance('A')({ url: '/a' });
    const callA = (mockAxiosInstance.request as any).mock.calls.slice(-1)[0][0];
    expect(callA.headers?.['X-Demo']).toBeUndefined();

    (mockAxiosInstance.request as any).mockResolvedValueOnce(createMockResponse({ ok: true }));
    await getRequestInstance('B')({ url: '/b' });
    const callB = (mockAxiosInstance.request as any).mock.calls.slice(-1)[0][0];
    expect(callB.headers['X-Demo']).toBe('demo');
  });
});
