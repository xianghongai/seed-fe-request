import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllInstances,
  defineRequestConfig,
  defineSharedPreset,
  getRequestInstance,
  getSharedPreset,
  updateSharedContext,
} from '../../src/index';
import type { RequestHandler } from '../../src/types';
// 确保 axios 在导入库代码前被 mock
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

describe('共享预设（US1）', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();
  });

  it('多实例应用同一预设：请求阶段钩子均生效（手动链，不注册到 axios）', async () => {
    // 定义共享预设：在请求阶段注入头部
    const onRequest: RequestHandler = (cfg: any) => {
      cfg.headers = cfg.headers || {};
      (cfg.headers as any)['X-Shared'] = 'yes';
      return cfg;
    };
    defineSharedPreset({ onRequest: { handlers: [onRequest] } });

    // 定义两个实例
    defineRequestConfig({ instanceName: 'A' });
    defineRequestConfig({ instanceName: 'B' });

    // 请求返回模拟
    (mockAxiosInstance.request as any).mockResolvedValueOnce(createMockResponse({ ok: true }));
    (mockAxiosInstance.request as any).mockResolvedValueOnce(createMockResponse({ ok: true }));

    await getRequestInstance('A')({ url: '/a' });
    await getRequestInstance('B')({ url: '/b' });
    const calls = (mockAxiosInstance.request as any).mock.calls;
    expect(calls[0][0].headers['X-Shared']).toBe('yes');
    expect(calls[1][0].headers['X-Shared']).toBe('yes');
  });

  it('默认实例级启用：未调用 applyPresetToInstance 也应生效，可通过 useSharedPreset 显式关闭', async () => {
    // 定义共享预设：请求阶段注入头部
    const onRequest: RequestHandler = (cfg: any) => {
      cfg.headers = cfg.headers || {};
      (cfg.headers as any)['X-Default'] = 'on';
      return cfg;
    };
    defineSharedPreset({ onRequest: { handlers: [onRequest] } });

    // A 不关闭（默认启用），B 显式关闭
    defineRequestConfig({ instanceName: 'A1' });
    defineRequestConfig({ instanceName: 'B1', useSharedPreset: false });

    (mockAxiosInstance.request as any).mockResolvedValueOnce(createMockResponse({ ok: true }));
    await getRequestInstance('A1')({ url: '/a1' });
    let call = (mockAxiosInstance.request as any).mock.calls.slice(-1)[0][0];
    expect(call.headers['X-Default']).toBe('on');

    (mockAxiosInstance.request as any).mockResolvedValueOnce(createMockResponse({ ok: true }));
    await getRequestInstance('B1')({ url: '/b1' });
    call = (mockAxiosInstance.request as any).mock.calls.slice(-1)[0][0];
    expect(call.headers?.['X-Default']).toBeUndefined();
  });

  it('错误阶段默认以 Promise.reject(Error) 形式标准化（通过响应 onRejected 注入）', async () => {
    // 定义共享预设，仅启用 onError（默认注入 normalize onRejected）
    defineSharedPreset({ onError: { handlers: [] } });
    defineRequestConfig({ instanceName: 'C' });

    // 模拟请求抛错
    const boom = new Error('boom');
    (mockAxiosInstance.request as any).mockRejectedValueOnce(boom);

    try {
      await getRequestInstance('C')({ url: '/c' });
      throw new Error('should not reach');
    } catch (e: any) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it('运行期更新共享上下文：后续请求的 onRequest 可读取最新值（按请求快照）', async () => {
    const onRequest: RequestHandler = (cfg: any) => {
      const lang = (getSharedPreset()?.context as Record<string, unknown> | undefined)?.lang as string | undefined;
      cfg.headers = cfg.headers || {};
      if (lang) (cfg.headers as any)['X-Lang'] = lang;
      return cfg;
    };

    defineSharedPreset({ onRequest: { handlers: [onRequest] } });
    defineRequestConfig({ instanceName: 'CTX' });

    // 1st request with zh-CN（立即验证）
    updateSharedContext({ lang: 'zh-CN' });
    (mockAxiosInstance.request as any).mockResolvedValueOnce(createMockResponse({ ok: 1 }));
    await getRequestInstance('CTX')({ url: '/ctx1' });
    const cfg1 = (mockAxiosInstance.request as any).mock.calls.slice(-1)[0][0];

    // 2nd request with en-US（立即验证）
    updateSharedContext({ lang: 'en-US' });
    (mockAxiosInstance.request as any).mockResolvedValueOnce(createMockResponse({ ok: 2 }));
    await getRequestInstance('CTX')({ url: '/ctx2' });
    const cfg2 = (mockAxiosInstance.request as any).mock.calls.slice(-1)[0][0];
    expect((cfg1.headers as any)['X-Lang']).toBe('zh-CN');
    expect((cfg2.headers as any)['X-Lang']).toBe('en-US');
  });

  it('请求级覆盖禁用 onError 阶段：不影响 axios 拦截器注册（手动链内部执行）', async () => {
    defineSharedPreset({ onError: { handlers: [] } });
    defineRequestConfig({ instanceName: 'U3' });

    const base = mockAxiosInstance.interceptors.response.use.mock.calls.length;

    (mockAxiosInstance.request as any).mockRejectedValueOnce(new Error('x'));
    await expect(
      getRequestInstance('U3')({ url: '/u3', presetOverrides: { onError: { enabled: false } } })
    ).rejects.toThrow();
    expect(mockAxiosInstance.interceptors.response.use.mock.calls.length).toBe(base);

    (mockAxiosInstance.request as any).mockRejectedValueOnce(new Error('y'));
    await expect(getRequestInstance('U3')({ url: '/u3' })).rejects.toThrow();
    expect(mockAxiosInstance.interceptors.response.use.mock.calls.length).toBe(base);
  });
});
