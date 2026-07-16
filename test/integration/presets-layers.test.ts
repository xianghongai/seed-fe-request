import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllInstances,
  defineRequestConfig,
  defineSharedPreset,
  getRequestInstance,
  readPresetContext,
} from '../../src/index';
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

  it('请求级上下文覆盖进入当前请求快照', async () => {
    const scopes: unknown[] = [];
    defineSharedPreset({
      context: { scope: 'shared' },
      onRequest: {
        handlers: [
          (config) => {
            scopes.push(readPresetContext(config).scope);
            return config;
          },
        ],
      },
    });
    defineRequestConfig({ instanceName: 'context', presetOverrides: { context: { scope: 'instance' } } });
    mockAxiosInstance.request.mockResolvedValue(createMockResponse({ ok: true }));

    await getRequestInstance('context')({
      url: '/context',
      presetOverrides: { context: { scope: 'request' } },
    });

    expect(scopes).toEqual(['request']);
  });

  it('相同描述的 Symbol 实例保持各自的预设缓存', async () => {
    const calls: string[] = [];
    const first = Symbol('same');
    const second = Symbol('same');
    defineSharedPreset({ context: {} });
    defineRequestConfig([
      {
        instanceName: first,
        presetOverrides: {
          onRequest: {
            handlers: [
              (config) => {
                calls.push('first');
                return config;
              },
            ],
          },
        },
      },
      {
        instanceName: second,
        presetOverrides: {
          onRequest: {
            handlers: [
              (config) => {
                calls.push('second');
                return config;
              },
            ],
          },
        },
      },
    ]);
    mockAxiosInstance.request.mockResolvedValue(createMockResponse({ ok: true }));

    await getRequestInstance(first)({ url: '/first' });
    await getRequestInstance(second)({ url: '/second' });

    expect(calls).toEqual(['first', 'second']);
  });
});
