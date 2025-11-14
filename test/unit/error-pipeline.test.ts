import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllInstances,
  clearGlobalErrorPipeline,
  defineRequestConfig,
  request,
  setGlobalErrorPipeline,
} from '../../src/index';
// 确保 axios 在导入库代码前被 mock
import { createMockError, mockAxiosInstance, resetAllMocks } from '../utils/mocks';

describe('错误管线（Middleware/next）- 单元', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();
    clearGlobalErrorPipeline();
    vi.clearAllMocks();
  });

  it('实例级命中特有错误应终止传播，不进入共享', async () => {
    const instanceMw = vi.fn(async (ctx) => {
      // 命中 409 则不调用 next，终止在实例级
      if ((ctx as any).response?.status === 409) return;
    });
    const globalMw = vi.fn(async () => {});

    defineRequestConfig({
      instanceName: 'A',
      baseURL: 'https://api.example.com/a',
      errorPipeline: [instanceMw],
    });
    setGlobalErrorPipeline([globalMw]);

    mockAxiosInstance.request.mockRejectedValueOnce(createMockError('A-Conflict', 409));

    await expect(request({ instanceName: 'A', url: '/conflict' })).rejects.toThrow('A-Conflict');

    expect(instanceMw).toHaveBeenCalledTimes(1);
    expect(globalMw).not.toHaveBeenCalled();
  });

  it('实例级未命中特有错误应 next 到共享', async () => {
    const instanceMw = vi.fn(async (_ctx, next) => {
      await next();
    });
    const globalMw = vi.fn(async () => {});

    defineRequestConfig({
      instanceName: 'A',
      baseURL: 'https://api.example.com/a',
      errorPipeline: [instanceMw],
    });
    setGlobalErrorPipeline([globalMw]);

    mockAxiosInstance.request.mockRejectedValueOnce(createMockError('A-Server', 500));

    await expect(request({ instanceName: 'A', url: '/server' })).rejects.toThrow('A-Server');

    expect(instanceMw).toHaveBeenCalledTimes(1);
    expect(globalMw).toHaveBeenCalledTimes(1);
  });

  it('请求级应先执行并可 next 到实例/共享', async () => {
    const reqMw = vi.fn(async (_ctx, next) => {
      await next();
    });
    const instMw = vi.fn(async (_ctx, next) => {
      await next();
    });
    const globalMw = vi.fn(async () => {});

    defineRequestConfig({ instanceName: 'B', baseURL: 'https://api.example.com/b', errorPipeline: [instMw] });
    setGlobalErrorPipeline([globalMw]);

    mockAxiosInstance.request.mockRejectedValueOnce(createMockError('B-Server', 500));

    await expect(request({ instanceName: 'B', url: '/err', errorPipeline: [reqMw] })).rejects.toThrow('B-Server');

    expect(reqMw).toHaveBeenCalledTimes(1);
    expect(instMw).toHaveBeenCalledTimes(1);
    expect(globalMw).toHaveBeenCalledTimes(1);
  });

  it('请求级未调用 next 时，应终止在请求级', async () => {
    const reqMw = vi.fn(async (_ctx) => {
      // 不调用 next
    });
    const instMw = vi.fn(async () => {});
    const globalMw = vi.fn(async () => {});

    defineRequestConfig({ instanceName: 'C', baseURL: 'https://api.example.com/c', errorPipeline: [instMw] });
    setGlobalErrorPipeline([globalMw]);

    mockAxiosInstance.request.mockRejectedValueOnce(createMockError('C-Server', 500));

    await expect(request({ instanceName: 'C', url: '/err', errorPipeline: [reqMw] })).rejects.toThrow('C-Server');

    expect(reqMw).toHaveBeenCalledTimes(1);
    expect(instMw).not.toHaveBeenCalled();
    expect(globalMw).not.toHaveBeenCalled();
  });

  it('skipErrorPipeline: true 时不执行任何中间件', async () => {
    const reqMw = vi.fn(async () => {});
    const instMw = vi.fn(async () => {});
    const globMw = vi.fn(async () => {});

    defineRequestConfig({ instanceName: 'D', baseURL: 'https://api.example.com/d', errorPipeline: [instMw] });
    setGlobalErrorPipeline([globMw]);

    mockAxiosInstance.request.mockRejectedValueOnce(createMockError('D-Server', 500));

    await expect(
      request({ instanceName: 'D', url: '/err', errorPipeline: [reqMw], skipErrorPipeline: true })
    ).rejects.toThrow('D-Server');

    expect(reqMw).not.toHaveBeenCalled();
    expect(instMw).not.toHaveBeenCalled();
    expect(globMw).not.toHaveBeenCalled();
  });

  it('异步中间件顺序应正确（前后阶段）', async () => {
    const order: string[] = [];
    const reqMw = vi.fn(async (_ctx, next) => {
      order.push('req:before');
      await next();
      order.push('req:after');
    });
    const instMw = vi.fn(async (_ctx, next) => {
      order.push('inst:before');
      await next();
      order.push('inst:after');
    });
    const globMw = vi.fn(async () => {
      order.push('glob');
    });

    defineRequestConfig({ instanceName: 'E', baseURL: '/e', errorPipeline: [instMw] });
    setGlobalErrorPipeline([globMw]);

    mockAxiosInstance.request.mockRejectedValueOnce(createMockError('E-Server', 500));

    await expect(request({ instanceName: 'E', url: '/err', errorPipeline: [reqMw] })).rejects.toThrow('E-Server');

    expect(order).toEqual(['req:before', 'inst:before', 'glob', 'inst:after', 'req:after']);
  });
});
