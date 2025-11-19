import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllInstances, defineRequestConfig, request } from '../../src/index';
// 确保 axios 在导入库代码前被 mock
import { createMockResponse, mockAxiosInstance, resetAllMocks } from '../utils/mocks';

describe('集成：实例级拦截器（由 Axios 管理）', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();
    vi.clearAllMocks();
  });

  it('仅在初始化时注册；多次请求不重复注册', async () => {
    // 定义实例，注册实例级拦截器
    const instReq = (cfg: any) => cfg;
    const instRes = (resp: any) => resp;
    defineRequestConfig({
      baseURL: 'https://api.example.com',
      interceptors: {
        request: { onConfig: instReq },
        response: { onConfig: instRes },
      },
    });

    const baseReq = mockAxiosInstance.interceptors.request.use.mock.calls.length;
    const baseRes = mockAxiosInstance.interceptors.response.use.mock.calls.length;
    expect(baseReq).toBeGreaterThanOrEqual(1);
    expect(baseRes).toBeGreaterThanOrEqual(1);

    // 多次请求
    (mockAxiosInstance.request as any).mockResolvedValue(createMockResponse({ ok: true }));
    await request({ url: '/a' });
    (mockAxiosInstance.request as any).mockResolvedValue(createMockResponse({ ok: true }));
    await request({ url: '/b' });

    // 不会重复注册
    expect(mockAxiosInstance.interceptors.request.use.mock.calls.length).toBe(baseReq);
    expect(mockAxiosInstance.interceptors.response.use.mock.calls.length).toBe(baseRes);
  });

  it('实例级与请求级共存：请求级不注册到 axios，且手动链生效', async () => {
    // 实例级注册（由 axios 管理）
    defineRequestConfig({
      baseURL: 'https://api.example.com',
      interceptors: {
        request: { onConfig: (cfg: any) => cfg },
      },
    });
    const baseReq = mockAxiosInstance.interceptors.request.use.mock.calls.length;

    // 请求级通过手动链修改配置
    (mockAxiosInstance.request as any).mockResolvedValue(createMockResponse({ ok: true }));
    await request({
      url: '/x',
      interceptors: {
        request: (cfg) => {
          cfg.headers = cfg.headers || {};
          (cfg.headers as any)['X-Req'] = '1';
          return cfg;
        },
      },
    });

    // 不新增 axios 注册（请求级手动链执行）
    expect(mockAxiosInstance.interceptors.request.use.mock.calls.length).toBe(baseReq);
    // 手动链效果生效（最终传给 axios 的配置包含请求级修改）
    const call = (mockAxiosInstance.request as any).mock.calls.slice(-1)[0][0];
    expect(call.headers['X-Req']).toBe('1');
  });
});
