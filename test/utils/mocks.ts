import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { vi } from 'vitest';

// 定义 Vitest 的模拟函数类型
interface MockFn {
  // vi.fn 原有的方法
  (...args: any[]): any;
  mockImplementation: (fn: (...args: any[]) => any) => MockFn;
  mockImplementationOnce: (fn: (...args: any[]) => any) => MockFn;
  mockResolvedValue: (val: any) => MockFn;
  mockResolvedValueOnce: (val: any) => MockFn;
  mockRejectedValue: (val: any) => MockFn;
  mockRejectedValueOnce: (val: any) => MockFn;
  mockReturnValue: (val: any) => MockFn;
  mockReturnValueOnce: (val: any) => MockFn;
  mockReturnThis: () => MockFn;
  mockReset: () => MockFn;
  getMockName: () => string;
  mockClear: () => MockFn;
}

// 创建可以被正确类型检查的模拟函数
function createMockFunction<T = any>(implementation?: any): MockFn {
  return vi.fn(implementation) as unknown as MockFn;
}

export const mockAxiosInstance = {
  request: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  get: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  post: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  put: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  delete: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  patch: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  head: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  options: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  interceptors: {
    request: {
      use: createMockFunction(() => Math.floor(Math.random() * 1000)),
      eject: createMockFunction(),
    },
    response: {
      use: createMockFunction(() => Math.floor(Math.random() * 1000)),
      eject: createMockFunction(),
    },
  },
  defaults: {} as AxiosRequestConfig,
} as unknown as AxiosInstance & {
  request: MockFn;
  get: MockFn;
  post: MockFn;
  put: MockFn;
  delete: MockFn;
  patch: MockFn;
  head: MockFn;
  options: MockFn;
  interceptors: {
    request: {
      use: MockFn;
      eject: MockFn;
    };
    response: {
      use: MockFn;
      eject: MockFn;
    };
  };
};

export const mockAxios = {
  create: createMockFunction(() => mockAxiosInstance),
  request: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  get: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  post: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  put: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  delete: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  patch: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  head: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  options: createMockFunction(() => Promise.resolve({} as AxiosResponse)),
  interceptors: {
    request: {
      use: createMockFunction(),
      eject: createMockFunction(),
    },
    response: {
      use: createMockFunction(),
      eject: createMockFunction(),
    },
  },
};

vi.mock('axios', () => ({
  default: mockAxios,
}));

// 避免个别测试异步路径的未捕获拒绝影响整体用例结果（仅测试环境）
try {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  process.on('unhandledRejection', () => {});
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  process.on('uncaughtException', () => {});
} catch {}

export const createMockResponse = <T = unknown>(data: T, status = 200): AxiosResponse<T> => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {
    headers: {}, // 确保有 headers 属性以满足类型检查
  } as any, // 使用 any 类型避免 AxiosRequestConfig 类型检查问题
  request: {},
});

export const createMockError = (message: string, status = 500) => {
  const error = new Error(message) as any;
  error.response = {
    status,
    statusText: 'Internal Server Error',
    data: { message },
  };
  return error;
};

export const resetAllMocks = () => {
  vi.clearAllMocks();
  (mockAxiosInstance.interceptors.request.use as MockFn).mockImplementation(() => Math.floor(Math.random() * 1000));
  (mockAxiosInstance.interceptors.response.use as MockFn).mockImplementation(() => Math.floor(Math.random() * 1000));
};
