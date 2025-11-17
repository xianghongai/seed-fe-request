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

  it('两个实例共享预设后同时发起请求，onRequest/onError 钩子均触发（示意）', async () => {
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

    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
  });

  it('US3：实例级覆盖禁用 onError 不影响其他实例', async () => {
    defineSharedPreset({ onError: { handlers: [] } });
    defineRequestConfig({ instanceName: 'A', presetOverrides: { onError: { enabled: false } } });
    defineRequestConfig({ instanceName: 'B' });

    const base = mockAxiosInstance.interceptors.response.use.mock.calls.length;

    (mockAxiosInstance.request as any).mockRejectedValueOnce(new Error('a'));
    await expect(getRequestInstance('A')({ url: '/a' })).rejects.toThrow();
    const afterA = mockAxiosInstance.interceptors.response.use.mock.calls.length;
    expect(afterA).toBe(base);

    (mockAxiosInstance.request as any).mockRejectedValueOnce(new Error('b'));
    await expect(getRequestInstance('B')({ url: '/b' })).rejects.toThrow();
    const afterB = mockAxiosInstance.interceptors.response.use.mock.calls.length;
    expect(afterB).toBe(base + 1);
  });
});
