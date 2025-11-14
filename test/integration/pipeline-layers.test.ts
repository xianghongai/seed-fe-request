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

describe('错误管线（Middleware/next）- 层级顺序（请求→实例→共享）', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();
    clearGlobalErrorPipeline();
    vi.clearAllMocks();
  });

  it('A 实例命中特有错误只执行实例级；B 实例无实例级则回落到共享', async () => {
    const aInstanceMw = vi.fn(async (ctx) => {
      if ((ctx as any).response?.status === 409) return; // 终止在实例级
    });
    defineRequestConfig({ instanceName: 'A', baseURL: '/a', errorPipeline: [aInstanceMw] });

    defineRequestConfig({ instanceName: 'B', baseURL: '/b' });

    const globalMw = vi.fn(async () => {});
    setGlobalErrorPipeline([globalMw]);

    // A: 409 → 仅实例级
    mockAxiosInstance.request.mockRejectedValueOnce(createMockError('A-Conflict', 409));
    await expect(request({ instanceName: 'A', url: '/x' })).rejects.toThrow('A-Conflict');
    expect(aInstanceMw).toHaveBeenCalledTimes(1);
    expect(globalMw).not.toHaveBeenCalled();

    // B: 500 → 共享
    mockAxiosInstance.request.mockRejectedValueOnce(createMockError('B-Server', 500));
    await expect(request({ instanceName: 'B', url: '/y' })).rejects.toThrow('B-Server');
    expect(globalMw).toHaveBeenCalledTimes(1);
  });
});
