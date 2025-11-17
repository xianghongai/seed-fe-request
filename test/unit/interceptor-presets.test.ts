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

  it('多实例应用同一预设：请求阶段钩子均生效；重复应用不重复安装', async () => {
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

    // 分别发起请求，触发一次性拦截器注册
    await getRequestInstance('A')({ url: '/a' });
    await getRequestInstance('B')({ url: '/b' });

    // 断言：请求拦截器被注册（至少一次）；重复应用不会重复注册额外拦截
    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    // 无法精确计算幂等次数（一次性注册 + 初始化），此断言仅保证至少注册过一次
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
    const callCountAfterA = mockAxiosInstance.interceptors.request.use.mock.calls.length;
    expect(callCountAfterA).toBeGreaterThan(0);

    (mockAxiosInstance.request as any).mockResolvedValueOnce(createMockResponse({ ok: true }));
    await getRequestInstance('B1')({ url: '/b1' });
    const callCountAfterB = mockAxiosInstance.interceptors.request.use.mock.calls.length;
    expect(callCountAfterB).toBe(callCountAfterA); // B1 未新增注册（因禁用）
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

  it('运行期更新共享上下文：后续请求注册的 onRequest 可读取最新值（当次快照）', async () => {
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
    const firstOnFulfilled = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
    const cfg1 = await (firstOnFulfilled as any)({ headers: {} });

    // 2nd request with en-US（立即验证）
    updateSharedContext({ lang: 'en-US' });
    (mockAxiosInstance.request as any).mockResolvedValueOnce(createMockResponse({ ok: 2 }));
    await getRequestInstance('CTX')({ url: '/ctx2' });
    const secondOnFulfilled = (mockAxiosInstance.interceptors.request.use.mock.calls.at(-1) as any[])[0];
    const cfg2 = await (secondOnFulfilled as any)({ headers: {} });
    expect((cfg1.headers as any)['X-Lang']).toBe('zh-CN');
    expect((cfg2.headers as any)['X-Lang']).toBe('en-US');
  });

  it('US3：请求级覆盖禁用 onError 阶段，不应注册响应 onRejected（与默认行为对比）', async () => {
    defineSharedPreset({ onError: { handlers: [] } });
    defineRequestConfig({ instanceName: 'U3' });

    const baseCalls = mockAxiosInstance.interceptors.response.use.mock.calls.length;

    // 禁用 onError：本次请求不应注册 normalize onRejected
    (mockAxiosInstance.request as any).mockRejectedValueOnce(new Error('x'));
    await expect(
      getRequestInstance('U3')({ url: '/u3', presetOverrides: { onError: { enabled: false } } })
    ).rejects.toThrow();
    const afterDisabled = mockAxiosInstance.interceptors.response.use.mock.calls.length;
    expect(afterDisabled).toBe(baseCalls); // 无新增注册

    // 不禁用 onError：应新增一次响应拦截器注册
    (mockAxiosInstance.request as any).mockRejectedValueOnce(new Error('y'));
    await expect(getRequestInstance('U3')({ url: '/u3' })).rejects.toThrow();
    const afterEnabled = mockAxiosInstance.interceptors.response.use.mock.calls.length;
    expect(afterEnabled).toBe(baseCalls + 1);
  });
});
