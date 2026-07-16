import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  RequestHandler,
  RequestInterceptor,
  RequestInterceptorObject,
  ResponseHandler,
  ResponseInterceptorObject,
} from '../src/types';
import { createMockError, createMockResponse, mockAxiosInstance, resetAllMocks } from './utils/mocks';

// 辅助函数 - 直接在文件中定义
function createRequestInterceptor(): RequestInterceptorObject {
  const requestHandler = vi.fn((config) => config) as RequestHandler;
  return { onConfig: requestHandler };
}

function createResponseInterceptor(): ResponseInterceptorObject {
  const responseHandler = vi.fn((response) => response) as ResponseHandler;
  return { onConfig: responseHandler };
}

function createRequestHandler(): RequestHandler {
  return vi.fn((config) => config) as RequestHandler;
}

function createResponseHandler(): ResponseHandler {
  return vi.fn((response) => response) as ResponseHandler;
}

// Mock logger - 必须在最顶部
vi.mock('@seed-fe/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { clearAllInstances, defineRequestConfig, request } from '../src/index';

describe('错误处理', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();
    vi.clearAllMocks();
  });

  describe('错误处理', () => {
    it('应该支持skipErrorPipeline跳过错误处理', async () => {
      defineRequestConfig({ baseURL: 'https://api.example.com' });

      const error = createMockError('Request failed', 500);
      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(
        request({
          url: '/test',
          skipErrorPipeline: true,
        })
      ).rejects.toThrow('Request failed');
    });

    it('应该调用请求级别的errorPipeline（单中间件）', async () => {
      defineRequestConfig({ baseURL: 'https://api.example.com' });

      const error = createMockError('Request failed', 500);
      const errorHandler = vi.fn(async () => {});
      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(
        request({
          url: '/test',
          errorPipeline: [errorHandler],
        })
      ).rejects.toThrow('Request failed');

      // 新签名：(ctx, next)
      const [ctxArg] = errorHandler.mock.calls[0];
      expect(ctxArg).toMatchObject({
        config: expect.objectContaining({ url: '/test' }),
      });
      expect(ctxArg.normalized).toBeInstanceOf(Error);
    });

    it('应该调用实例级别的errorPipeline（单中间件）', async () => {
      const error = createMockError('Request failed', 500);
      const instanceErrorHandler = vi.fn(async () => {});

      // 重新定义实例以包含错误处理器
      defineRequestConfig({
        instanceName: 'withErrorHandler',
        baseURL: 'https://api.example.com',
        errorPipeline: [instanceErrorHandler],
      });

      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(
        request({
          instanceName: 'withErrorHandler',
          url: '/test',
        })
      ).rejects.toThrow('Request failed');

      const [ctxArg2] = instanceErrorHandler.mock.calls[0];
      expect(ctxArg2).toMatchObject({
        config: expect.objectContaining({ url: '/test', instanceName: 'withErrorHandler' }),
        instanceName: 'withErrorHandler',
      });
      expect(ctxArg2.normalized).toBeInstanceOf(Error);
    });

    it('请求级别的errorPipeline应该优先于实例级别', async () => {
      const error = createMockError('Request failed', 500);
      const requestErrorHandler = vi.fn(async () => {});
      const instanceErrorHandler = vi.fn(async () => {});

      defineRequestConfig({
        instanceName: 'priority',
        baseURL: 'https://api.example.com',
        errorPipeline: [instanceErrorHandler],
      });

      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(
        request({
          instanceName: 'priority',
          url: '/test',
          errorPipeline: [requestErrorHandler],
        })
      ).rejects.toThrow('Request failed');

      expect(requestErrorHandler).toHaveBeenCalled();
      expect(instanceErrorHandler).not.toHaveBeenCalled();
    });
  });

  describe('配置合并', () => {
    it('应该正确合并withFullResponse配置', async () => {
      defineRequestConfig({
        instanceName: 'fullResponse',
        baseURL: 'https://api.example.com',
        withFullResponse: true,
      });

      const mockData = { message: 'success' };
      const mockResponse = createMockResponse(mockData);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      // 实例级别设置了withFullResponse: true，请求应返回完整响应
      const result = await request({
        instanceName: 'fullResponse',
        url: '/test',
      });

      expect(result).toEqual(mockResponse);
    });

    it('请求级别的withFullResponse应该覆盖实例级别', async () => {
      defineRequestConfig({
        instanceName: 'override',
        baseURL: 'https://api.example.com',
        withFullResponse: true,
      });

      const mockData = { message: 'success' };
      const mockResponse = createMockResponse(mockData);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      // 请求级别覆盖为false，应返回data
      const result = await request({
        instanceName: 'override',
        url: '/test',
        withFullResponse: false,
      });

      expect(result).toEqual(mockData);
    });
  });

  describe('边界情况', () => {
    it('应该处理空的拦截器数组', () => {
      expect(() => {
        defineRequestConfig({
          interceptors: {
            request: [],
            response: [],
          },
        });
      }).not.toThrow();
    });

    it('应该处理无效的拦截器ID', async () => {
      defineRequestConfig({ baseURL: 'https://api.example.com' });

      // 模拟拦截器添加失败的情况
      mockAxiosInstance.interceptors.request.use.mockReturnValue(-1);
      mockAxiosInstance.interceptors.response.use.mockReturnValue(-1);

      const mockData = { message: 'success' };
      const mockResponse = createMockResponse(mockData);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      await expect(
        request({
          url: '/test',
          interceptors: {
            request: createRequestInterceptor(),
            response: createResponseInterceptor(),
          },
        })
      ).resolves.toEqual(mockData);

      // 不应该尝试移除无效的拦截器
      expect(mockAxiosInstance.interceptors.request.eject).not.toHaveBeenCalledWith(-1);
      expect(mockAxiosInstance.interceptors.response.eject).not.toHaveBeenCalledWith(-1);
    });

    it('应该处理单元素数组的拦截器', () => {
      const handler = vi.fn((config) => config);

      defineRequestConfig({
        interceptors: {
          request: [handler],
        },
      });

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(handler);
    });

    it('应该处理没有第二个参数的元组拦截器', () => {
      const handler = vi.fn((config) => config) as RequestHandler;

      defineRequestConfig({
        interceptors: {
          request: [[handler] as unknown as RequestInterceptor],
        },
      });

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(handler);
    });

    it('应该处理undefined的实例名', async () => {
      defineRequestConfig({ baseURL: 'https://api.example.com' });

      const mockData = { message: 'success' };
      const mockResponse = createMockResponse(mockData);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await request({
        instanceName: undefined,
        url: '/test',
      });

      expect(result).toEqual(mockData);
    });

    it('应该处理null的配置参数', () => {
      expect(() => {
        defineRequestConfig({
          interceptors: {
            request: null as any,
            response: null as any,
          },
        });
      }).not.toThrow();
    });
  });

  describe('类型边界情况', () => {
    it('应该处理空字符串实例名', () => {
      expect(() => {
        defineRequestConfig({
          instanceName: '',
          baseURL: 'https://api.example.com',
        });
      }).not.toThrow();
    });

    it('应该处理数字作为实例名（通过转换为字符串）', () => {
      expect(() => {
        defineRequestConfig({
          instanceName: 123 as any,
          baseURL: 'https://api.example.com',
        });
      }).not.toThrow();
    });

    it('应该处理复杂的Symbol实例名', () => {
      const complexSymbol = Symbol.for('complex.instance.name');

      expect(() => {
        defineRequestConfig({
          instanceName: complexSymbol,
          baseURL: 'https://api.example.com',
        });
      }).not.toThrow();
    });
  });

  describe('内存管理', () => {
    it('异常情况下也不应注册/弹出一次性拦截器（改为手动链执行）', async () => {
      defineRequestConfig({ baseURL: 'https://api.example.com' });

      const baseReq = mockAxiosInstance.interceptors.request.use.mock.calls.length;
      const baseRes = mockAxiosInstance.interceptors.response.use.mock.calls.length;

      mockAxiosInstance.request.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await expect(
        request({
          url: '/test',
          interceptors: {
            request: createRequestInterceptor(),
            response: createResponseInterceptor(),
          },
          skipErrorPipeline: true,
        })
      ).rejects.toThrow('Unexpected error');

      expect(mockAxiosInstance.interceptors.request.use.mock.calls.length).toBe(baseReq);
      expect(mockAxiosInstance.interceptors.response.use.mock.calls.length).toBe(baseRes);
      expect(mockAxiosInstance.interceptors.request.eject).not.toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.eject).not.toHaveBeenCalled();
    });
  });
});
