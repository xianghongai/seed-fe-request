import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorHandler, type RequestHandler, type ResponseHandler } from '../src/types';
import { createMockResponse, mockAxios, mockAxiosInstance, resetAllMocks } from './mocks';

// Mock logger
vi.mock('@seed-fe/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  __clearInstancesForTesting__,
  DEFAULT_INSTANCE_NAME,
  defineRequestConfig,
  getRequestInstance,
  request,
} from '../src/index';

describe('拦截器管理', () => {
  beforeEach(() => {
    resetAllMocks();
    __clearInstancesForTesting__();
  });

  describe('请求拦截器', () => {
    it('应该支持函数形式的请求拦截器', () => {
      const requestHandler = vi.fn((config) => config) as RequestHandler;

      defineRequestConfig({
        interceptors: {
          request: [requestHandler],
        },
      });

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(requestHandler);
    });

    it('应该支持元组形式的请求拦截器', () => {
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

    it('应该支持对象形式的请求拦截器', () => {
      const onConfig = vi.fn((config) => config) as RequestHandler;
      const onError = vi.fn((error) => Promise.reject(error)) as (error: unknown) => Promise<never>;

      defineRequestConfig({
        interceptors: {
          request: { onConfig, onError },
        },
      });

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(onConfig, onError);
    });

    it('应该支持数组形式的多个请求拦截器', () => {
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

    it('应该支持兼容的requestInterceptors配置', () => {
      const handler1 = vi.fn((config) => config) as RequestHandler;
      const handler2 = vi.fn((config) => config) as RequestHandler;
      const errorHandler = vi.fn((error) => Promise.reject(error)) as (error: unknown) => Promise<never>;

      defineRequestConfig({
        requestInterceptors: [handler1, [handler2, errorHandler]],
      });

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(handler1);
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(handler2, errorHandler);
    });
  });

  describe('响应拦截器', () => {
    it('应该支持函数形式的响应拦截器', () => {
      const responseHandler = vi.fn((response) => response) as ResponseHandler;

      defineRequestConfig({
        interceptors: {
          response: [responseHandler],
        },
      });

      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(responseHandler);
    });

    it('应该支持元组形式的响应拦截器', () => {
      const responseHandler = vi.fn((response) => response) as ResponseHandler;
      const errorHandler = vi.fn((error) => Promise.reject(error)) as (error: unknown) => Promise<never>;

      defineRequestConfig({
        interceptors: {
          response: [responseHandler, errorHandler],
        },
      });

      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledTimes(1);
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(responseHandler, errorHandler);
    });

    it('应该支持对象形式的响应拦截器', () => {
      const onConfig = vi.fn((response) => response) as ResponseHandler;
      const onError = vi.fn((error) => Promise.reject(error)) as (error: unknown) => Promise<never>;

      defineRequestConfig({
        interceptors: {
          response: { onConfig, onError },
        },
      });

      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(onConfig, onError);
    });

    it('应该支持数组形式的多个响应拦截器', () => {
      const handler1 = vi.fn((response) => response) as ResponseHandler;
      const handler2 = vi.fn((response) => response) as ResponseHandler;
      const errorHandler = vi.fn((error) => Promise.reject(error)) as (error: unknown) => Promise<never>;

      defineRequestConfig({
        interceptors: {
          response: [handler1, [handler2, errorHandler], { onConfig: handler1 }],
        },
      });

      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledTimes(3);
    });

    it('应该支持兼容的responseInterceptors配置', () => {
      const handler1 = vi.fn((response) => response) as ResponseHandler;
      const handler2 = vi.fn((response) => response) as ResponseHandler;
      const errorHandler = vi.fn((error) => Promise.reject(error)) as (error: unknown) => Promise<never>;

      defineRequestConfig({
        responseInterceptors: [handler1, [handler2, errorHandler]],
      });

      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(handler1);
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(handler2, errorHandler);
    });
  });

  describe('对象形式拦截器边界情况', () => {
    it('应该为没有onError的请求拦截器对象提供默认错误处理', () => {
      const onConfig = vi.fn((config) => config) as RequestHandler;

      defineRequestConfig({
        interceptors: {
          request: { onConfig },
        },
      });

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(onConfig, expect.any(Function));
    });

    it('应该为没有onError的响应拦截器对象提供默认错误处理', () => {
      const onConfig = vi.fn((response) => response) as ResponseHandler;

      defineRequestConfig({
        interceptors: {
          response: { onConfig },
        },
      });

      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(onConfig, expect.any(Function));
    });
  });

  describe('默认响应数据返回逻辑', () => {
    beforeEach(() => {
      resetAllMocks();
      __clearInstancesForTesting__();

      defineRequestConfig({
        baseURL: 'https://api.example.com',
      });
    });

    it('默认情况下应该只返回response.data', async () => {
      const responseData = { message: 'success', code: 200 };
      const fullResponse = createMockResponse(responseData, 200);
      mockAxiosInstance.request.mockResolvedValue(fullResponse);

      const result = await request({
        url: '/test',
      });

      // 默认应该返回 response.data，而不是完整的 response
      expect(result).toEqual(responseData);
      expect(result).not.toEqual(fullResponse);
    });

    it('通过withFullResponse=true应该返回完整response', async () => {
      const responseData = { message: 'success', code: 200 };
      const fullResponse = createMockResponse(responseData, 200);
      mockAxiosInstance.request.mockResolvedValue(fullResponse);

      const result = await request({
        url: '/test',
        withFullResponse: true,
      });

      // 开启withFullResponse后应该返回完整的response
      expect(result).toEqual(fullResponse);
      expect(result).not.toEqual(responseData);
    });

    it('通过withFullResponse=false应该只返回response.data', async () => {
      const responseData = { message: 'success', code: 200 };
      const fullResponse = createMockResponse(responseData, 200);
      mockAxiosInstance.request.mockResolvedValue(fullResponse);

      const result = await request({
        url: '/test',
        withFullResponse: false,
      });

      // 显式设置为false应该返回data
      expect(result).toEqual(responseData);
      expect(result).not.toEqual(fullResponse);
    });

    it('实例级别的withFullResponse配置应该生效', async () => {
      defineRequestConfig({
        instanceName: 'fullResponseInstance',
        baseURL: 'https://api.example.com',
        withFullResponse: true,
      });

      const responseData = { message: 'success', code: 200 };
      const fullResponse = createMockResponse(responseData, 200);
      mockAxiosInstance.request.mockResolvedValue(fullResponse);

      const result = await request({
        instanceName: 'fullResponseInstance',
        url: '/test',
      });

      // 实例级别配置应该生效
      expect(result).toEqual(fullResponse);
    });

    it('请求级别的withFullResponse应该覆盖实例级别配置', async () => {
      defineRequestConfig({
        instanceName: 'fullResponseInstance',
        baseURL: 'https://api.example.com',
        withFullResponse: true, // 实例级别设为true
      });

      const responseData = { message: 'success', code: 200 };
      const fullResponse = createMockResponse(responseData, 200);
      mockAxiosInstance.request.mockResolvedValue(fullResponse);

      const result = await request({
        instanceName: 'fullResponseInstance',
        url: '/test',
        withFullResponse: false, // 请求级别覆盖为false
      });

      // 请求级别应该覆盖实例级别
      expect(result).toEqual(responseData);
      expect(result).not.toEqual(fullResponse);
    });

    describe('便捷方法的响应数据返回', () => {
      beforeEach(() => {
        const responseData = { message: 'success', users: [] };
        const fullResponse = createMockResponse(responseData, 200);
        mockAxiosInstance.request.mockResolvedValue(fullResponse);
      });

      it('GET方法默认应该返回response.data', async () => {
        const httpRequest = (await import('../src/index')).default;

        const result = await httpRequest.get('/users');

        expect(result).toEqual({ message: 'success', users: [] });
      });

      it('POST方法通过withFullResponse可以返回完整response', async () => {
        const httpRequest = (await import('../src/index')).default;

        const result = await httpRequest.post(
          '/users',
          { name: 'John' },
          {
            withFullResponse: true,
          }
        );

        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('status', 200);
        expect(result).toHaveProperty('headers');
      });
    });

    it('不同数据类型都应该正确返回', async () => {
      // 测试字符串响应
      const stringResponse = createMockResponse('Hello World', 200);
      mockAxiosInstance.request.mockResolvedValue(stringResponse);

      const stringResult = await request({ url: '/string' });
      expect(stringResult).toBe('Hello World');

      // 测试数组响应
      const arrayResponse = createMockResponse([1, 2, 3], 200);
      mockAxiosInstance.request.mockResolvedValue(arrayResponse);

      const arrayResult = await request({ url: '/array' });
      expect(arrayResult).toEqual([1, 2, 3]);

      // 测试null响应
      const nullResponse = createMockResponse(null, 200);
      mockAxiosInstance.request.mockResolvedValue(nullResponse);

      const nullResult = await request({ url: '/null' });
      expect(nullResult).toBe(null);
    });
  });
});
