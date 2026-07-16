import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestHandler, ResponseHandler } from '../src/types';
import { mockAxiosInstance, resetAllMocks } from './utils/mocks';

// Mock logger
vi.mock('@seed-fe/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { clearAllInstances, defineRequestConfig } from '../src/index';

describe('拦截器', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();
  });

  describe('请求拦截器', () => {
    describe('函数形式', () => {
      it('应该支持单个函数拦截器', () => {
        const requestHandler = vi.fn((config) => config) as RequestHandler;

        defineRequestConfig({
          interceptors: {
            request: [requestHandler],
          },
        });

        expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(requestHandler);
      });
    });

    describe('元组形式', () => {
      it('应该支持 [onFulfilled, onRejected] 元组', () => {
        const requestHandler = vi.fn((config) => config) as RequestHandler;
        const errorHandler = vi.fn((error) => Promise.reject(error)) as (error: unknown) => Promise<never>;

        defineRequestConfig({
          interceptors: {
            request: [requestHandler, errorHandler],
          },
        });

        expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledTimes(1);
        expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(requestHandler, errorHandler);
      });
    });

    describe('对象形式', () => {
      it('应该支持 { onConfig, onError } 对象', () => {
        const onConfig = vi.fn((config) => config) as RequestHandler;
        const onError = vi.fn((error) => Promise.reject(error)) as (error: unknown) => Promise<never>;

        defineRequestConfig({
          interceptors: {
            request: { onConfig, onError },
          },
        });

        expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(onConfig, onError);
      });

      it('应该为没有 onError 的对象提供默认错误处理', () => {
        const onConfig = vi.fn((config) => config) as RequestHandler;

        defineRequestConfig({
          interceptors: {
            request: { onConfig },
          },
        });

        expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(onConfig, expect.any(Function));
      });
    });

    describe('数组形式（多个拦截器）', () => {
      it('应该支持混合类型的多个拦截器', () => {
        const handler1 = vi.fn((config) => config) as RequestHandler;
        const handler2 = vi.fn((config) => config) as RequestHandler;
        const errorHandler = vi.fn((error) => Promise.reject(error)) as (error: unknown) => Promise<never>;

        defineRequestConfig({
          interceptors: {
            request: [handler1, [handler2, errorHandler], { onConfig: handler1 }],
          },
        });

        expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('响应拦截器', () => {
    describe('函数形式', () => {
      it('应该支持单个函数拦截器', () => {
        const responseHandler = vi.fn((response) => response) as ResponseHandler;

        defineRequestConfig({
          interceptors: {
            response: [responseHandler],
          },
        });

        // +1 是因为会自动添加默认响应拦截器处理 withFullResponse 逻辑
        expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(responseHandler);
      });
    });

    describe('元组形式', () => {
      it('应该支持 [onFulfilled, onRejected] 元组', () => {
        const responseHandler = vi.fn((response) => response) as ResponseHandler;
        const errorHandler = vi.fn((error) => Promise.reject(error)) as (error: unknown) => Promise<never>;

        defineRequestConfig({
          interceptors: {
            response: [responseHandler, errorHandler],
          },
        });

        // +1 是因为会自动添加默认响应拦截器
        expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledTimes(2);
        expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(responseHandler, errorHandler);
      });
    });

    describe('对象形式', () => {
      it('应该支持 { onConfig, onError } 对象', () => {
        const onConfig = vi.fn((response) => response) as ResponseHandler;
        const onError = vi.fn((error) => Promise.reject(error)) as (error: unknown) => Promise<never>;

        defineRequestConfig({
          interceptors: {
            response: { onConfig, onError },
          },
        });

        expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(onConfig, onError);
      });

      it('应该为没有 onError 的对象提供默认错误处理', () => {
        const onConfig = vi.fn((response) => response) as ResponseHandler;

        defineRequestConfig({
          interceptors: {
            response: { onConfig },
          },
        });

        expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(onConfig, expect.any(Function));
      });
    });

    describe('数组形式（多个拦截器）', () => {
      it('应该支持混合类型的多个拦截器', () => {
        const handler1 = vi.fn((response) => response) as ResponseHandler;
        const handler2 = vi.fn((response) => response) as ResponseHandler;
        const errorHandler = vi.fn((error) => Promise.reject(error)) as (error: unknown) => Promise<never>;

        defineRequestConfig({
          interceptors: {
            response: [handler1, [handler2, errorHandler], { onConfig: handler1 }],
          },
        });

        // +1 是因为会自动添加默认响应拦截器
        expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledTimes(4);
      });
    });
  });

  describe('混合拦截器配置', () => {
    it('应该同时支持请求和响应拦截器', () => {
      const requestHandler = vi.fn((config) => config) as RequestHandler;
      const responseHandler = vi.fn((response) => response) as ResponseHandler;

      defineRequestConfig({
        interceptors: {
          request: [requestHandler],
          response: [responseHandler],
        },
      });

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(requestHandler);
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(responseHandler);
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

    it('应该处理 null 拦截器配置', () => {
      expect(() => {
        defineRequestConfig({
          interceptors: {
            request: null as any,
            response: null as any,
          },
        });
      }).not.toThrow();
    });

    it('应该处理 undefined 拦截器配置', () => {
      expect(() => {
        defineRequestConfig({
          interceptors: {
            request: undefined,
            response: undefined,
          },
        });
      }).not.toThrow();
    });
  });
});
