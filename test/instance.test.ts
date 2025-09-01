import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAxios, mockAxiosInstance, resetAllMocks } from './utils/mocks';

// Mock logger
vi.mock('@seed-fe/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { clearAllInstances, DEFAULT_INSTANCE_NAME, defineRequestConfig, getRequestInstance } from '../src/index';

describe('实例管理', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();
  });

  describe('默认实例', () => {
    it('应该能够创建默认实例', () => {
      defineRequestConfig({
        baseURL: 'https://api.example.com',
      });

      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com',
      });
    });

    it('应该能够获取默认实例', () => {
      defineRequestConfig({
        baseURL: 'https://api.example.com',
      });

      const instance = getRequestInstance();
      expect(typeof instance).toBe('function');
      expect(typeof instance.get).toBe('function');
      expect(typeof instance.post).toBe('function');
    });

    it('应该能够通过DEFAULT_INSTANCE_NAME获取默认实例', () => {
      defineRequestConfig({
        baseURL: 'https://api.example.com',
      });

      const instance = getRequestInstance(DEFAULT_INSTANCE_NAME);
      expect(typeof instance).toBe('function');
      expect(typeof instance.get).toBe('function');
      expect(typeof instance.post).toBe('function');
    });

    it('获取不存在的默认实例应该抛出错误', () => {
      expect(() => {
        getRequestInstance();
      }).toThrow('[@seed-fe/request] Axios instance not found for instanceName');
    });
  });

  describe('命名实例', () => {
    it('应该能够创建命名实例', () => {
      const instanceName = 'api';

      defineRequestConfig({
        instanceName,
        baseURL: 'https://api.example.com',
      });

      expect(mockAxios.create).toHaveBeenCalledWith({
        instanceName,
        baseURL: 'https://api.example.com',
      });
    });

    it('应该能够获取命名实例', () => {
      const instanceName = 'api';

      defineRequestConfig({
        instanceName,
        baseURL: 'https://api.example.com',
      });

      const instance = getRequestInstance(instanceName);
      expect(typeof instance).toBe('function');
      expect(typeof instance.get).toBe('function');
      expect(typeof instance.post).toBe('function');
    });

    it('应该能够创建多个不同的命名实例', () => {
      const apiInstance = 'api';
      const userInstance = 'user';

      // 为不同实例创建不同的mock
      const mockApiInstance = { ...mockAxiosInstance };
      const mockUserInstance = { ...mockAxiosInstance };

      mockAxios.create.mockReturnValueOnce(mockApiInstance).mockReturnValueOnce(mockUserInstance);

      defineRequestConfig([
        {
          instanceName: apiInstance,
          baseURL: 'https://api.example.com',
        },
        {
          instanceName: userInstance,
          baseURL: 'https://user.example.com',
        },
      ]);

      expect(mockAxios.create).toHaveBeenCalledTimes(2);
      expect(mockAxios.create).toHaveBeenNthCalledWith(1, {
        instanceName: apiInstance,
        baseURL: 'https://api.example.com',
      });
      expect(mockAxios.create).toHaveBeenNthCalledWith(2, {
        instanceName: userInstance,
        baseURL: 'https://user.example.com',
      });
    });

    it('获取不存在的命名实例应该抛出错误', () => {
      expect(() => {
        getRequestInstance('nonexistent');
      }).toThrow('[@seed-fe/request] Axios instance not found for instanceName: nonexistent');
    });
  });

  describe('Symbol实例名', () => {
    it('应该能够使用Symbol作为实例名', () => {
      const instanceName = Symbol('test');

      defineRequestConfig({
        instanceName,
        baseURL: 'https://api.example.com',
      });

      const instance = getRequestInstance(instanceName);
      expect(typeof instance).toBe('function');
      expect(typeof instance.get).toBe('function');
      expect(typeof instance.post).toBe('function');
    });

    it('不同的Symbol应该创建不同的实例', () => {
      const symbol1 = Symbol('test1');
      const symbol2 = Symbol('test2');

      defineRequestConfig([
        { instanceName: symbol1, baseURL: 'https://test1.com' },
        { instanceName: symbol2, baseURL: 'https://test2.com' },
      ]);

      const instance1 = getRequestInstance(symbol1);
      const instance2 = getRequestInstance(symbol2);

      expect(typeof instance1).toBe('function');
      expect(typeof instance2).toBe('function');
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('重复定义检查', () => {
    it('应该阻止重复定义相同的命名实例', () => {
      const instanceName = 'api';

      defineRequestConfig({
        instanceName,
        baseURL: 'https://api.example.com',
      });

      expect(() => {
        defineRequestConfig({
          instanceName,
          baseURL: 'https://api2.example.com',
        });
      }).toThrow('[@seed-fe/request] Instance api already exists, cannot be defined again');
    });

    it('应该阻止重复定义相同的Symbol实例', () => {
      const instanceName = Symbol.for('test');

      defineRequestConfig({
        instanceName,
        baseURL: 'https://api.example.com',
      });

      expect(() => {
        defineRequestConfig({
          instanceName,
          baseURL: 'https://api2.example.com',
        });
      }).toThrow(`[@seed-fe/request] Instance ${String(instanceName)} already exists, cannot be defined again`);
    });

    it('当默认实例已存在时，应该阻止创建新的无名实例', () => {
      defineRequestConfig({
        baseURL: 'https://api.example.com',
      });

      expect(() => {
        defineRequestConfig({
          baseURL: 'https://api2.example.com',
        });
      }).toThrow('[@seed-fe/request] Instance Symbol(default) already exists, cannot be defined again');
    });
  });

  describe('数组配置', () => {
    it('应该支持数组形式的配置', () => {
      const configs = [
        {
          instanceName: 'api',
          baseURL: 'https://api.example.com',
        },
        {
          instanceName: 'user',
          baseURL: 'https://user.example.com',
        },
      ];

      defineRequestConfig(configs);

      expect(mockAxios.create).toHaveBeenCalledTimes(2);
    });

    it('应该支持单个配置对象', () => {
      const config = {
        instanceName: 'api',
        baseURL: 'https://api.example.com',
      };

      defineRequestConfig(config);

      expect(mockAxios.create).toHaveBeenCalledTimes(1);
      expect(mockAxios.create).toHaveBeenCalledWith(config);
    });
  });
});
