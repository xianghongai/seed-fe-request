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

describe('共享错误处理（全局）', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();
    clearGlobalErrorPipeline();
    vi.clearAllMocks();
  });

  it('在未配置请求/实例级处理时，失败应触发全局错误处理一次，并最终以错误形式返回', async () => {
    // 定义最小实例
    defineRequestConfig({ baseURL: 'https://api.example.com' });

    // 设置全局处理器
    const globalHandler = vi.fn(async () => {});
    setGlobalErrorPipeline([globalHandler]);

    // 触发失败
    const error = createMockError('Request failed', 500);
    mockAxiosInstance.request.mockRejectedValue(error);

    await expect(request({ url: '/users' })).rejects.toThrow('Request failed');

    // 仅调用一次全局处理器
    expect(globalHandler).toHaveBeenCalledTimes(1);
    // 第一个参数为上下文，包含归一化后的 Error 与 config
    const [ctxArg] = globalHandler.mock.calls[0];
    expect(ctxArg.normalized).toBeInstanceOf(Error);
    expect(ctxArg).toMatchObject({ config: expect.any(Object) });
  });

  it('后设置的共享处理器应覆盖先前设置（最后设置生效）', async () => {
    defineRequestConfig({ baseURL: 'https://api.example.com' });

    const first = vi.fn();
    const second = vi.fn();
    setGlobalErrorPipeline([first]);
    setGlobalErrorPipeline([second]);

    const error = createMockError('boom', 500);
    mockAxiosInstance.request.mockRejectedValue(error);

    await expect(request({ url: '/boom' })).rejects.toThrow('boom');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('请求级处理器应覆盖实例级与共享级，仅请求级执行', async () => {
    // 实例级处理器
    const instanceHandler = vi.fn();
    defineRequestConfig({
      instanceName: 'svc',
      baseURL: 'https://api.example.com',
      errorConfig: { errorHandler: instanceHandler },
    });

    // 共享级处理器
    const globalHandler = vi.fn(async () => {});
    setGlobalErrorPipeline([globalHandler]);

    // 失败 + 请求级处理器
    const requestHandler = vi.fn();
    mockAxiosInstance.request.mockRejectedValueOnce(createMockError('R failed', 500));
    await expect(
      request({ instanceName: 'svc', url: '/r', errorConfig: { errorHandler: requestHandler } })
    ).rejects.toThrow();

    expect(requestHandler).toHaveBeenCalledTimes(1);
    expect(instanceHandler).not.toHaveBeenCalled();
    expect(globalHandler).not.toHaveBeenCalled();
  });

  it('skipErrorHandler: true 时，三层处理器均不执行', async () => {
    const instanceHandler = vi.fn();
    defineRequestConfig({
      instanceName: 'svc2',
      baseURL: 'https://api.example.com',
      errorConfig: { errorHandler: instanceHandler },
    });

    const globalHandler = vi.fn(async () => {});
    setGlobalErrorPipeline([globalHandler]);

    mockAxiosInstance.request.mockRejectedValueOnce(createMockError('skip failed', 500));
    await expect(request({ instanceName: 'svc2', url: '/skip', skipErrorPipeline: true })).rejects.toThrow();

    expect(instanceHandler).not.toHaveBeenCalled();
    expect(globalHandler).not.toHaveBeenCalled();
  });

  it('处理器内部抛错时，最终仍以失败返回且不中断库的抛错路径', async () => {
    defineRequestConfig({ baseURL: 'https://api.example.com' });
    const throwingHandler = vi.fn(() => {
      throw new Error('handler boom');
    });
    setGlobalErrorPipeline([throwingHandler]);

    mockAxiosInstance.request.mockRejectedValueOnce(createMockError('net fail', 500));
    await expect(request({ url: '/boom' })).rejects.toThrow();

    expect(throwingHandler).toHaveBeenCalledTimes(1);
  });
});
