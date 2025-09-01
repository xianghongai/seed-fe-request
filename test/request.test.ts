import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestInterceptorObject, ResponseInterceptorObject } from '../src/types';
import { createMockResponse, mockAxiosInstance, resetAllMocks } from './utils/mocks';

// 辅助函数 - 直接在文件中定义
function createRequestInterceptor(): RequestInterceptorObject {
  const requestHandler = vi.fn((config) => config);
  return { onConfig: requestHandler };
}

function createResponseInterceptor(): ResponseInterceptorObject {
  const responseHandler = vi.fn((response) => response);
  return { onConfig: responseHandler };
}

// Mock logger
vi.mock('@seed-fe/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import httpRequest, { clearAllInstances, defineRequestConfig, request } from '../src/index';

describe('HTTP 方法', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();

    // 设置默认实例
    defineRequestConfig({
      baseURL: 'https://api.example.com',
    });
  });

  describe('request函数', () => {
    it('应该能够发送基本请求', async () => {
      const mockData = { message: 'success' };
      const mockResponse = createMockResponse(mockData);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await request({
        url: '/test',
        method: 'GET',
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/test',
          method: 'GET',
        })
      );
      expect(result).toEqual(mockData);
    });

    it('应该支持withFullResponse选项', async () => {
      const mockData = { message: 'success' };
      const mockResponse = createMockResponse(mockData);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await request({
        url: '/test',
        method: 'GET',
        withFullResponse: true,
      });

      expect(result).toEqual(mockResponse);
    });

    it('应该支持指定实例名', async () => {
      const instanceName = 'custom';
      defineRequestConfig({
        instanceName,
        baseURL: 'https://custom.example.com',
      });

      const mockData = { message: 'custom' };
      const mockResponse = createMockResponse(mockData);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await request({
        instanceName,
        url: '/test',
        method: 'GET',
      });

      expect(result).toEqual(mockData);
    });
  });

  describe('便捷方法', () => {
    beforeEach(() => {
      const mockData = { message: 'success' };
      const mockResponse = createMockResponse(mockData);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);
    });

    it('httpRequest.get应该发送GET请求', async () => {
      await httpRequest.get('/users');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/users',
        })
      );
    });

    it('httpRequest.get应该支持额外配置', async () => {
      await httpRequest.get('/users', {
        params: { page: 1 },
        timeout: 5000,
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/users',
          params: { page: 1 },
          timeout: 5000,
        })
      );
    });

    it('httpRequest.post应该发送POST请求', async () => {
      const data = { name: 'John' };
      await httpRequest.post('/users', data);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/users',
          data,
        })
      );
    });

    it('httpRequest.post应该支持额外配置', async () => {
      const data = { name: 'John' };
      await httpRequest.post('/users', data, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/users',
          data,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('httpRequest.put应该发送PUT请求', async () => {
      const data = { name: 'John Updated' };
      await httpRequest.put('/users/1', data);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: '/users/1',
          data,
        })
      );
    });

    it('httpRequest.delete应该发送DELETE请求', async () => {
      await httpRequest.delete('/users/1');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: '/users/1',
        })
      );
    });

    it('httpRequest.patch应该发送PATCH请求', async () => {
      const data = { name: 'John Patched' };
      await httpRequest.patch('/users/1', data);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          url: '/users/1',
          data,
        })
      );
    });

    it('httpRequest.head应该发送HEAD请求', async () => {
      await httpRequest.head('/users/1');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'HEAD',
          url: '/users/1',
        })
      );
    });

    it('httpRequest.options应该发送OPTIONS请求', async () => {
      await httpRequest.options('/users');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'OPTIONS',
          url: '/users',
        })
      );
    });
  });

  describe('一次性拦截器', () => {
    it('应该添加和移除一次性请求拦截器', async () => {
      // 创建一个符合类型的拦截器对象
      const requestInterceptor = createRequestInterceptor();
      const interceptorId = 123;

      mockAxiosInstance.interceptors.request.use.mockReturnValue(interceptorId);

      const mockData = { message: 'success' };
      const mockResponse = createMockResponse(mockData);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      await request({
        url: '/test',
        interceptors: {
          request: requestInterceptor,
        },
      });

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(
        expect.any(Function), // onConfig
        expect.any(Function) // onError
      );
      expect(mockAxiosInstance.interceptors.request.eject).toHaveBeenCalledWith(interceptorId);
    });

    it('应该添加和移除一次性响应拦截器', async () => {
      // 创建一个符合类型的拦截器对象
      const responseInterceptor = createResponseInterceptor();
      const interceptorId = 456;

      mockAxiosInstance.interceptors.response.use.mockReturnValue(interceptorId);

      const mockData = { message: 'success' };
      const mockResponse = createMockResponse(mockData);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      await request({
        url: '/test',
        interceptors: {
          response: responseInterceptor,
        },
      });

      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(
        expect.any(Function), // onConfig
        expect.any(Function) // onError
      );
      expect(mockAxiosInstance.interceptors.response.eject).toHaveBeenCalledWith(interceptorId);
    });

    it('即使请求失败也应该移除一次性拦截器', async () => {
      // 创建符合类型的拦截器对象
      const requestInterceptor = createRequestInterceptor();
      const responseInterceptor = createResponseInterceptor();
      const requestId = 123;
      const responseId = 456;

      mockAxiosInstance.interceptors.request.use.mockReturnValue(requestId);
      mockAxiosInstance.interceptors.response.use.mockReturnValue(responseId);

      const error = new Error('Request failed');
      mockAxiosInstance.request.mockRejectedValue(error);

      try {
        await request({
          url: '/test',
          interceptors: {
            request: requestInterceptor,
            response: responseInterceptor,
          },
          skipErrorHandler: true,
        });
      } catch {
        // 忽略错误
      }

      expect(mockAxiosInstance.interceptors.request.eject).toHaveBeenCalledWith(requestId);
      expect(mockAxiosInstance.interceptors.response.eject).toHaveBeenCalledWith(responseId);
    });
  });

  describe('类型推断', () => {
    it('应该正确推断返回类型', async () => {
      interface User {
        id: number;
        name: string;
      }

      const mockUser: User = { id: 1, name: 'John' };
      const mockResponse = createMockResponse(mockUser);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const user = await httpRequest.get<User>('/user/1');

      // TypeScript应该推断user的类型为User
      expect(user.id).toBe(1);
      expect(user.name).toBe('John');
    });

    it('便捷方法应该正确推断返回类型', async () => {
      interface CreateUserResponse {
        success: boolean;
        userId: number;
      }

      const mockResponse: CreateUserResponse = { success: true, userId: 123 };
      const mockAxiosResponse = createMockResponse(mockResponse);
      mockAxiosInstance.request.mockResolvedValue(mockAxiosResponse);

      const result = await httpRequest.post<CreateUserResponse>('/users', { name: 'John' });

      expect(result.success).toBe(true);
      expect(result.userId).toBe(123);
    });
  });
});
