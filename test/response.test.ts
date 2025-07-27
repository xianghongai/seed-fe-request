import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockResponse, mockAxiosInstance, resetAllMocks } from './utils/mocks';

// Mock logger
vi.mock('@seed-fe/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { __clearInstancesForTesting__, defineRequestConfig, getRequestInstance, request } from '../src/index';

describe('响应数据处理', () => {
  beforeEach(() => {
    resetAllMocks();
    __clearInstancesForTesting__();
  });

  describe('全局 request 函数', () => {
    beforeEach(() => {
      defineRequestConfig({
        baseURL: 'https://api.example.com',
      });
    });

    describe('默认行为', () => {
      it('默认应该只返回 response.data', async () => {
        const responseData = { message: 'success', code: 200 };
        const fullResponse = createMockResponse(responseData, 200);
        mockAxiosInstance.request.mockResolvedValue(fullResponse);

        const result = await request({ url: '/test' });

        expect(result).toEqual(responseData);
        expect(result).not.toEqual(fullResponse);
      });

      it('不同数据类型都应该正确返回', async () => {
        // 字符串响应
        const stringResponse = createMockResponse('Hello World', 200);
        mockAxiosInstance.request.mockResolvedValue(stringResponse);
        const stringResult = await request({ url: '/string' });
        expect(stringResult).toBe('Hello World');

        // 数组响应
        const arrayResponse = createMockResponse([1, 2, 3], 200);
        mockAxiosInstance.request.mockResolvedValue(arrayResponse);
        const arrayResult = await request({ url: '/array' });
        expect(arrayResult).toEqual([1, 2, 3]);

        // null 响应
        const nullResponse = createMockResponse(null, 200);
        mockAxiosInstance.request.mockResolvedValue(nullResponse);
        const nullResult = await request({ url: '/null' });
        expect(nullResult).toBe(null);

        // 数字响应
        const numberResponse = createMockResponse(42, 200);
        mockAxiosInstance.request.mockResolvedValue(numberResponse);
        const numberResult = await request({ url: '/number' });
        expect(numberResult).toBe(42);

        // 布尔响应
        const booleanResponse = createMockResponse(true, 200);
        mockAxiosInstance.request.mockResolvedValue(booleanResponse);
        const booleanResult = await request({ url: '/boolean' });
        expect(booleanResult).toBe(true);
      });
    });

    describe('withFullResponse 参数', () => {
      it('通过 withFullResponse=true 应该返回完整 response', async () => {
        const responseData = { message: 'success', code: 200 };
        const fullResponse = createMockResponse(responseData, 200);
        mockAxiosInstance.request.mockResolvedValue(fullResponse);

        const result = await request({
          url: '/test',
          withFullResponse: true,
        });

        expect(result).toEqual(fullResponse);
        expect(result).not.toEqual(responseData);
      });

      it('通过 withFullResponse=false 应该只返回 response.data', async () => {
        const responseData = { message: 'success', code: 200 };
        const fullResponse = createMockResponse(responseData, 200);
        mockAxiosInstance.request.mockResolvedValue(fullResponse);

        const result = await request({
          url: '/test',
          withFullResponse: false,
        });

        expect(result).toEqual(responseData);
        expect(result).not.toEqual(fullResponse);
      });
    });

    describe('实例级别配置', () => {
      it('实例级别的 withFullResponse 配置应该生效', async () => {
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

        expect(result).toEqual(fullResponse);
      });

      it('请求级别的 withFullResponse 应该覆盖实例级别配置', async () => {
        defineRequestConfig({
          instanceName: 'fullResponseInstance',
          baseURL: 'https://api.example.com',
          withFullResponse: true, // 实例级别设为 true
        });

        const responseData = { message: 'success', code: 200 };
        const fullResponse = createMockResponse(responseData, 200);
        mockAxiosInstance.request.mockResolvedValue(fullResponse);

        const result = await request({
          instanceName: 'fullResponseInstance',
          url: '/test',
          withFullResponse: false, // 请求级别覆盖为 false
        });

        expect(result).toEqual(responseData);
        expect(result).not.toEqual(fullResponse);
      });
    });
  });

  describe('getRequestInstance 获取增强实例', () => {
    it('默认应该只返回response.data', async () => {
      defineRequestConfig({
        instanceName: 'testInstance',
        baseURL: 'https://api.example.com',
      });

      const responseData = { message: 'success', code: 200 };
      const fullResponse = createMockResponse(responseData, 200);
      mockAxiosInstance.request.mockResolvedValue(fullResponse);

      const requestInstance = getRequestInstance('testInstance');
      const result = await requestInstance({ url: '/test' });

      expect(result).toEqual(responseData);
      expect(result).not.toEqual(fullResponse);
    });

    it('通过withFullResponse=true应该返回完整response', async () => {
      defineRequestConfig({
        instanceName: 'testInstance',
        baseURL: 'https://api.example.com',
      });

      const responseData = { message: 'success', code: 200 };
      const fullResponse = createMockResponse(responseData, 200);
      mockAxiosInstance.request.mockResolvedValue(fullResponse);

      const requestInstance = getRequestInstance('testInstance');
      const result = await requestInstance({
        url: '/test',
        withFullResponse: true,
      });

      expect(result).toEqual(fullResponse);
      expect(result).not.toEqual(responseData);
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

      const requestInstance = getRequestInstance('fullResponseInstance');
      const result = await requestInstance({ url: '/test' });

      expect(result).toEqual(fullResponse);
    });

    it('请求级别的withFullResponse应该覆盖实例级别配置', async () => {
      defineRequestConfig({
        instanceName: 'fullResponseInstance',
        baseURL: 'https://api.example.com',
        withFullResponse: true,
      });

      const responseData = { message: 'success', code: 200 };
      const fullResponse = createMockResponse(responseData, 200);
      mockAxiosInstance.request.mockResolvedValue(fullResponse);

      const requestInstance = getRequestInstance('fullResponseInstance');
      const result = await requestInstance({
        url: '/test',
        withFullResponse: false,
      });

      expect(result).toEqual(responseData);
      expect(result).not.toEqual(fullResponse);
    });
  });

  describe('便捷方法', () => {
    let httpRequest: any;

    beforeEach(async () => {
      defineRequestConfig({
        baseURL: 'https://api.example.com',
      });

      const responseData = { message: 'success', users: [] };
      const fullResponse = createMockResponse(responseData, 200);
      mockAxiosInstance.request.mockResolvedValue(fullResponse);

      httpRequest = (await import('../src/index')).default;
    });

    it('GET 方法默认应该返回 response.data', async () => {
      const result = await httpRequest.get('/users');
      expect(result).toEqual({ message: 'success', users: [] });
    });

    it('POST 方法默认应该返回 response.data', async () => {
      const result = await httpRequest.post('/users', { name: 'John' });
      expect(result).toEqual({ message: 'success', users: [] });
    });

    it('PUT 方法默认应该返回 response.data', async () => {
      const result = await httpRequest.put('/users/1', { name: 'Jane' });
      expect(result).toEqual({ message: 'success', users: [] });
    });

    it('DELETE 方法默认应该返回 response.data', async () => {
      const result = await httpRequest.delete('/users/1');
      expect(result).toEqual({ message: 'success', users: [] });
    });

    it('PATCH 方法默认应该返回 response.data', async () => {
      const result = await httpRequest.patch('/users/1', { name: 'Bob' });
      expect(result).toEqual({ message: 'success', users: [] });
    });

    it('HEAD 方法默认应该返回 response.data', async () => {
      const result = await httpRequest.head('/users');
      expect(result).toEqual({ message: 'success', users: [] });
    });

    it('OPTIONS 方法默认应该返回 response.data', async () => {
      const result = await httpRequest.options('/users');
      expect(result).toEqual({ message: 'success', users: [] });
    });

    it('POST 方法通过 withFullResponse 可以返回完整 response', async () => {
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

  describe('getRequestInstance 便捷方法', () => {
    beforeEach(() => {
      defineRequestConfig({
        instanceName: 'httpInstance',
        baseURL: 'https://api.example.com',
      });

      const responseData = { message: 'success', users: [] };
      const fullResponse = createMockResponse(responseData, 200);
      mockAxiosInstance.request.mockResolvedValue(fullResponse);
    });

    it('GET方法默认应该返回response.data', async () => {
      const requestInstance = getRequestInstance('httpInstance');
      const result = await requestInstance.get('/users');

      expect(result).toEqual({ message: 'success', users: [] });
    });

    it('POST方法通过withFullResponse可以返回完整response', async () => {
      const requestInstance = getRequestInstance('httpInstance');
      const result = await requestInstance.post(
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

    it('PUT方法默认应该返回response.data', async () => {
      const requestInstance = getRequestInstance('httpInstance');
      const result = await requestInstance.put('/users/1', { name: 'Jane' });

      expect(result).toEqual({ message: 'success', users: [] });
    });

    it('DELETE方法默认应该返回response.data', async () => {
      const requestInstance = getRequestInstance('httpInstance');
      const result = await requestInstance.delete('/users/1');

      expect(result).toEqual({ message: 'success', users: [] });
    });
  });

  describe('配置优先级', () => {
    it('配置优先级：请求级别 > 实例级别 > 默认行为', async () => {
      // 创建一个默认返回完整响应的实例
      defineRequestConfig({
        instanceName: 'priorityTest',
        baseURL: 'https://api.example.com',
        withFullResponse: true, // 实例级别：返回完整响应
      });

      const responseData = { data: 'test' };
      const fullResponse = createMockResponse(responseData, 200);
      mockAxiosInstance.request.mockResolvedValue(fullResponse);

      // 1. 没有请求级别配置，使用实例级别配置
      const result1 = await request({
        instanceName: 'priorityTest',
        url: '/test1',
        // 没有 withFullResponse，应该使用实例级别的 true
      });
      expect(result1).toEqual(fullResponse);

      // 2. 请求级别配置覆盖实例级别配置
      const result2 = await request({
        instanceName: 'priorityTest',
        url: '/test2',
        withFullResponse: false, // 请求级别：只返回数据
      });
      expect(result2).toEqual(responseData);

      // 3. 请求级别显式设置为 true
      const result3 = await request({
        instanceName: 'priorityTest',
        url: '/test3',
        withFullResponse: true, // 请求级别：返回完整响应
      });
      expect(result3).toEqual(fullResponse);
    });

    it('默认实例未配置 withFullResponse 时应该返回 response.data', async () => {
      defineRequestConfig({
        baseURL: 'https://api.example.com',
        // 没有设置 withFullResponse
      });

      const responseData = { data: 'test' };
      const fullResponse = createMockResponse(responseData, 200);
      mockAxiosInstance.request.mockResolvedValue(fullResponse);

      const result = await request({ url: '/test' });
      expect(result).toEqual(responseData); // 默认行为：返回 response.data
    });
  });
});
