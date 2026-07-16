import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllInstances,
  clearGlobalErrorPipeline,
  defineRequestConfig,
  request,
  setGlobalErrorPipeline,
} from '../../src/index';
// 确保 axios 在导入库代码前被 mock
import { createMockError, createMockResponse, mockAxiosInstance, resetAllMocks } from '../utils/mocks';

describe('多实例下的共享/实例级错误处理协同', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();
    clearGlobalErrorPipeline();
    vi.clearAllMocks();
  });

  it('当某实例配置实例级处理时，仅该实例执行实例级，其他实例回落到共享', async () => {
    // A 实例：配置实例级处理
    const aInstanceHandler = vi.fn(async () => {});
    defineRequestConfig({
      instanceName: 'A',
      baseURL: 'https://api.example.com/a',
      errorPipeline: [aInstanceHandler],
    });

    // B 实例：无实例级处理
    defineRequestConfig({
      instanceName: 'B',
      baseURL: 'https://api.example.com/b',
    });

    // 共享处理
    const globalHandler = vi.fn(async () => {});
    setGlobalErrorPipeline([globalHandler]);

    // A 请求失败 → 实例级生效
    const errorA = createMockError('A failed', 500);
    mockAxiosInstance.request.mockRejectedValueOnce(errorA);
    await expect(request({ instanceName: 'A', url: '/test' })).rejects.toThrow('A failed');
    expect(aInstanceHandler).toHaveBeenCalledTimes(1);
    expect(globalHandler).not.toHaveBeenCalled();

    // B 请求失败 → 回落共享
    const errorB = createMockError('B failed', 500);
    mockAxiosInstance.request.mockRejectedValueOnce(errorB);
    await expect(request({ instanceName: 'B', url: '/test' })).rejects.toThrow('B failed');
    expect(globalHandler).toHaveBeenCalledTimes(1);
  });

  it('成功请求不触发任何错误处理器', async () => {
    defineRequestConfig({ baseURL: 'https://api.example.com' });
    const globalHandler = vi.fn(async () => {});
    setGlobalErrorPipeline([globalHandler]);

    const resp = createMockResponse({ ok: true });
    mockAxiosInstance.request.mockResolvedValue(resp);

    await expect(request({ url: '/ok' })).resolves.toEqual({ ok: true });

    expect(globalHandler).not.toHaveBeenCalled();
  });
});
