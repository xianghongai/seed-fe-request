import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockResponse, mockAxiosInstance, resetAllMocks } from './utils/mocks';

// 辅助函数 - 直接在文件中定义

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

  describe('请求级拦截器（手动链）', () => {
    it('请求级请求拦截器通过手动链生效（不注册到 axios）', async () => {
      const mockData = { message: 'success' };
      const mockResponse = createMockResponse(mockData);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      await request({
        url: '/test',
        interceptors: {
          request: (cfg) => {
            cfg.headers = cfg.headers || {};
            (cfg.headers as any)['X-Req'] = '1';
            return cfg;
          },
        },
      });

      // 不会向 axios 注册一次性拦截器
      expect(mockAxiosInstance.interceptors.request.use).not.toHaveBeenCalled();
      // 但最终请求配置应包含拦截器效果
      const call = (mockAxiosInstance.request as any).mock.calls[0][0];
      expect(call.headers['X-Req']).toBe('1');
    });

    it('请求级响应拦截器通过手动链生效（不注册到 axios）', async () => {
      const mockData = { message: 'success' };
      const mockResponse = createMockResponse(mockData);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const base = mockAxiosInstance.interceptors.response.use.mock.calls.length;

      const result = await request({
        url: '/test',
        interceptors: {
          response: (resp) => {
            (resp.data as any).message = 'patched';
            return resp;
          },
        },
      });

      expect(mockAxiosInstance.interceptors.response.use.mock.calls.length).toBe(base);
      expect(result).toEqual({ message: 'patched' });
    });

    it('响应 onRejected 可恢复', async () => {
      const mockData = { message: 'x' };
      const mockResponse = createMockResponse(mockData);
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await request({
        url: '/test',
        interceptors: {
          response: [
            () => {
              throw new Error('broken');
            },
            // 恢复为一个可用响应
            (_err) => mockResponse,
          ],
        },
      });

      expect(result).toEqual({ message: 'x' });
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
