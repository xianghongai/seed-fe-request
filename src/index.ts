import logger from '@seed-fe/logger';
import axios, { type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type {
  AnyRequestInterceptor,
  AnyResponseInterceptor,
  CustomRequestConfig,
  HttpRequest,
  InstanceName,
  InterceptorId,
  RequestInstance,
  RequestInterceptorObject,
  ResponseInterceptorObject,
} from './types';

// 导出所有类型
export * from './types';

// ====================================
// 常量和全局变量
// ====================================

/**
 * 默认实例名称
 * 使用 Symbol.for 注册，确保唯一性
 */
export const DEFAULT_INSTANCE_NAME: InstanceName = Symbol.for('default');

/**
 * 表示拦截器添加失败的常量
 */
const INVALID_INTERCEPTOR_ID: InterceptorId = -1;

/**
 * 错误消息常量
 */
const ERROR_MESSAGES = {
  INVALID_REQUEST_INTERCEPTOR: '[@seed-fe/request] Invalid request interceptor: onConfig is required',
  INVALID_RESPONSE_INTERCEPTOR: '[@seed-fe/request] Invalid response interceptor: onConfig is required',
  INSTANCE_ALREADY_EXISTS: (name: string) =>
    `[@seed-fe/request] Instance ${name} already exists, cannot be defined again`,
  DEFAULT_INSTANCE_EXISTS:
    '[@seed-fe/request] Default instance already exists, must specify instanceName for new instance',
  DEFAULT_INSTANCE_REDEFINED: '[@seed-fe/request] Default instance already defined, ignoring this definition',
  INSTANCE_NOT_FOUND: (name: string) => `[@seed-fe/request] Axios instance not found for instanceName: ${name}`,
} as const;

/**
 * 实例映射，用于存储定义的增强实例
 */
const instanceMap: Map<InstanceName, RequestInstance> = new Map();

/**
 * 实例配置映射，用于存储实例的原始配置（包含错误处理器等）
 */
const instanceConfigMap: Map<InstanceName, CustomRequestConfig> = new Map();

/**
 * 清理所有实例映射（仅用于测试）
 * @internal
 */
export function __clearInstancesForTesting__(): void {
  instanceMap.clear();
  instanceConfigMap.clear();
}

// ====================================
// 拦截器处理
// ====================================

/**
 * 检查是否为拦截器对象格式
 */
function isInterceptorObject(interceptor: unknown): interceptor is { onConfig: unknown; onError?: unknown } {
  return (
    !Array.isArray(interceptor) && typeof interceptor === 'object' && interceptor !== null && 'onConfig' in interceptor
  );
}

/**
 * 检查是否为元组拦截器格式
 */
function isTupleInterceptor(interceptors: unknown): interceptors is [Function, Function] {
  return (
    Array.isArray(interceptors) &&
    interceptors.length === 2 &&
    typeof interceptors[0] === 'function' &&
    typeof interceptors[1] === 'function'
  );
}

/**
 * 创建默认错误处理器
 */
function createDefaultErrorHandler() {
  return (error: unknown) => Promise.reject(error);
}

/**
 * 解析请求拦截器，统一为标准格式
 */
function parseRequestInterceptor(
  interceptor: AnyRequestInterceptor
): [
  (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>,
  ((error: unknown) => unknown) | undefined,
] {
  // 对象形式 { onConfig, onError }
  if (isInterceptorObject(interceptor)) {
    const { onConfig, onError } = interceptor as RequestInterceptorObject;
    if (!onConfig) {
      throw new Error(ERROR_MESSAGES.INVALID_REQUEST_INTERCEPTOR);
    }
    return [onConfig, onError ?? createDefaultErrorHandler()];
  }

  // 元组形式 [onFulfilled, onRejected]
  if (Array.isArray(interceptor)) {
    return interceptor.length === 2 ? [interceptor[0], interceptor[1]] : [interceptor[0], undefined];
  }

  // 函数形式
  return [
    interceptor as (
      config: InternalAxiosRequestConfig
    ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>,
    undefined,
  ];
}

/**
 * 解析响应拦截器，统一为标准格式
 */
function parseResponseInterceptor(
  interceptor: AnyResponseInterceptor
): [(response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>, ((error: unknown) => unknown) | undefined] {
  // 对象形式 { onConfig, onError }
  if (isInterceptorObject(interceptor)) {
    const { onConfig, onError } = interceptor as ResponseInterceptorObject;
    if (!onConfig) {
      throw new Error(ERROR_MESSAGES.INVALID_RESPONSE_INTERCEPTOR);
    }
    return [onConfig, onError ?? createDefaultErrorHandler()];
  }

  // 元组形式 [onFulfilled, onRejected]
  if (Array.isArray(interceptor)) {
    return interceptor.length === 2 ? [interceptor[0], interceptor[1]] : [interceptor[0], undefined];
  }

  // 函数形式
  return [interceptor as (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>, undefined];
}

/**
 * 注册单组拦截器到实例
 */
function registerSingleInterceptorGroup<T extends AnyRequestInterceptor | AnyResponseInterceptor>(
  interceptors: T | T[] | null | undefined,
  parser: (interceptor: T) => [unknown, unknown | undefined],
  registerFn: (onFulfilled: unknown, onRejected?: unknown) => number,
  collectIds?: number[]
): number[] {
  if (!interceptors) return [];

  const ids: number[] = [];

  // 如果传入的是元组拦截器，直接处理
  if (isTupleInterceptor(interceptors)) {
    const [onFulfilled, onRejected] = parser(interceptors as unknown as T);
    const id = registerFn(onFulfilled, onRejected);
    if (id !== INVALID_INTERCEPTOR_ID) ids.push(id);
    return ids;
  }

  // 否则按数组处理
  const interceptorsArray = Array.isArray(interceptors) ? interceptors : [interceptors];

  interceptorsArray.forEach((interceptor) => {
    const [onFulfilled, onRejected] = parser(interceptor);
    const id = registerFn(onFulfilled, onRejected);
    if (id !== INVALID_INTERCEPTOR_ID) ids.push(id);
  });

  if (collectIds) collectIds.push(...ids);
  return ids;
}

/**
 * 创建拦截器注册函数
 */
function createInterceptorRegistrar(instance: AxiosInstance, type: 'request' | 'response') {
  return (onFulfilled: unknown, onRejected?: unknown) => {
    return onRejected !== undefined
      ? instance.interceptors[type].use(onFulfilled as any, onRejected as any)
      : instance.interceptors[type].use(onFulfilled as any);
  };
}

/**
 * 设置实例拦截器
 */
function setupInstanceInterceptors(
  instance: AxiosInstance,
  config: CustomRequestConfig,
  isOneTime = false
): { requestIds: number[]; responseIds: number[] } {
  const requestIds: number[] = [];
  const responseIds: number[] = [];

  // 创建注册函数
  const registerRequestInterceptor = createInterceptorRegistrar(instance, 'request');
  const registerResponseInterceptor = createInterceptorRegistrar(instance, 'response');

  if (config.interceptors) {
    // 处理新格式请求拦截器
    if (config.interceptors.request && config.interceptors.request !== null) {
      registerSingleInterceptorGroup(
        config.interceptors.request,
        parseRequestInterceptor,
        registerRequestInterceptor,
        isOneTime ? requestIds : undefined
      );
    }

    // 处理新格式响应拦截器
    if (config.interceptors.response && config.interceptors.response !== null) {
      registerSingleInterceptorGroup(
        config.interceptors.response,
        parseResponseInterceptor,
        registerResponseInterceptor,
        isOneTime ? responseIds : undefined
      );
    }
  }

  // 处理兼容格式的拦截器配置
  if (config.requestInterceptors) {
    registerSingleInterceptorGroup(
      config.requestInterceptors,
      parseRequestInterceptor,
      registerRequestInterceptor,
      isOneTime ? requestIds : undefined
    );
  }

  if (config.responseInterceptors) {
    registerSingleInterceptorGroup(
      config.responseInterceptors,
      parseResponseInterceptor,
      registerResponseInterceptor,
      isOneTime ? responseIds : undefined
    );
  }

  return { requestIds, responseIds };
}

// ====================================
// 实例管理
// ====================================

/**
 * 验证实例名称，检查是否已存在并处理异常情况
 */
function validateInstanceName(instanceName: InstanceName): boolean {
  if (instanceMap.has(instanceName)) {
    if (instanceName === DEFAULT_INSTANCE_NAME && instanceMap.size === 0) {
      logger.warn(ERROR_MESSAGES.DEFAULT_INSTANCE_REDEFINED);
      return true;
    }
    throw new Error(ERROR_MESSAGES.INSTANCE_ALREADY_EXISTS(String(instanceName)));
  }

  // 如果无实例名且已存在默认实例，抛出异常
  if (instanceName === DEFAULT_INSTANCE_NAME && instanceMap.has(DEFAULT_INSTANCE_NAME)) {
    throw new Error(ERROR_MESSAGES.DEFAULT_INSTANCE_EXISTS);
  }

  return false;
}

/**
 * 创建增强的请求实例，支持便捷方法和 withFullResponse 逻辑
 * @param axiosInstance 原始 Axios 实例
 * @param instanceName 实例名称
 * @returns 增强的请求实例
 */
function createEnhancedInstance(axiosInstance: AxiosInstance, instanceName: InstanceName): RequestInstance {
  const instanceConfig = instanceConfigMap.get(instanceName);

  const enhancedRequest = async <T = unknown>(config: CustomRequestConfig): Promise<T> => {
    const { mergedConfig, finalWithFullResponse } = mergeConfigs(instanceConfig, config);

    // 如果单次请求的 withFullResponse 与实例配置不同，添加一次性的响应拦截器处理
    let responseInterceptorId: number | undefined;
    if (config.withFullResponse !== undefined && config.withFullResponse !== instanceConfig?.withFullResponse) {
      responseInterceptorId = axiosInstance.interceptors.response.use((response) => response);
    }

    // 添加一次性拦截器
    const { requestIds, responseIds } = setupInstanceInterceptors(
      axiosInstance,
      { ...config, withFullResponse: finalWithFullResponse },
      true
    );

    try {
      // 发送请求
      const response = await axiosInstance.request(mergedConfig);

      // 根据最终的 withFullResponse 决定返回内容
      return finalWithFullResponse ? (response as unknown as T) : (response.data as T);
    } finally {
      // 移除一次性拦截器
      if (responseInterceptorId !== undefined) {
        axiosInstance.interceptors.response.eject(responseInterceptorId);
      }
      requestIds.forEach((id: number) => axiosInstance.interceptors.request.eject(id));
      responseIds.forEach((id: number) => axiosInstance.interceptors.response.eject(id));
    }
  };

  // 添加便捷方法
  return addHttpMethodShortcuts(enhancedRequest) as RequestInstance;
}

/**
 * 初始化并存储实例
 */
function initializeInstance(instanceName: InstanceName, config: CustomRequestConfig): void {
  const axiosInstance = axios.create(config);

  // 添加默认响应拦截器（直接传递响应）
  axiosInstance.interceptors.response.use((response) => response);

  // 添加用户配置的拦截器
  setupInstanceInterceptors(axiosInstance, config);

  // 保存配置和实例
  instanceConfigMap.set(instanceName, config);
  instanceMap.set(instanceName, createEnhancedInstance(axiosInstance, instanceName));
}

// ====================================
// 公共 API
// ====================================

/**
 * 注册多个实例，可以是单个配置对象或配置数组
 */
export function defineRequestConfig(configs: CustomRequestConfig | CustomRequestConfig[]): void {
  // 转换为数组统一处理
  const configsArray = Array.isArray(configs) ? configs : [configs];

  configsArray.forEach((config) => {
    const instanceName = config.instanceName ?? DEFAULT_INSTANCE_NAME;

    // 检查实例是否已存在，并处理异常情况
    if (validateInstanceName(instanceName)) return;

    // 创建并存储实例
    initializeInstance(instanceName, config);
  });
}

// 获取增强的请求实例
export function getRequestInstance(instanceName?: InstanceName): RequestInstance {
  const instance = instanceMap.get(instanceName ?? DEFAULT_INSTANCE_NAME);
  if (!instance) {
    const name = String(instanceName ?? DEFAULT_INSTANCE_NAME);
    throw new Error(ERROR_MESSAGES.INSTANCE_NOT_FOUND(name));
  }
  return instance;
}

// 全局 request 便捷方法
export async function request<T = unknown>(config: CustomRequestConfig): Promise<T> {
  try {
    const instanceName = config.instanceName ?? DEFAULT_INSTANCE_NAME;
    const enhancedInstance = getRequestInstance(instanceName);

    // 直接使用增强实例调用
    return await enhancedInstance<T>(config);
  } catch (error) {
    return handleRequestError(error, config);
  }
}

// 全局 request 便捷方法
const httpRequest = addHttpMethodShortcuts(request) as HttpRequest;

export default httpRequest;

// ====================================
// 工具函数
// ====================================

/**
 * 解析 withFullResponse 配置的最终值
 */
function resolveWithFullResponse(
  requestConfig: CustomRequestConfig,
  instanceConfig: CustomRequestConfig | undefined
): boolean {
  return requestConfig.withFullResponse !== undefined
    ? requestConfig.withFullResponse
    : (instanceConfig?.withFullResponse ?? false);
}

/**
 * 清理自定义配置字段，返回纯 Axios 配置
 */
function sanitizeAxiosConfig(config: CustomRequestConfig): CustomRequestConfig {
  const { withFullResponse: _, ...axiosConfig } = config;
  return axiosConfig;
}

/**
 * 合并请求配置，处理 withFullResponse 等特殊字段
 */
function mergeConfigs(
  instanceConfig: CustomRequestConfig | undefined,
  requestConfig: CustomRequestConfig
): {
  mergedConfig: CustomRequestConfig;
  finalWithFullResponse: boolean;
} {
  // 确定最终的 withFullResponse 值
  const finalWithFullResponse = resolveWithFullResponse(requestConfig, instanceConfig);

  // 移除 withFullResponse，因为 axios 不识别这个属性
  const axiosConfig = sanitizeAxiosConfig(requestConfig);

  // 创建合并后的配置
  const mergedConfig = {
    ...axiosConfig,
    withFullResponse: finalWithFullResponse,
  };

  return { mergedConfig, finalWithFullResponse };
}

/**
 * 为基础请求函数添加 HTTP 方法快捷方式
 */
function addHttpMethodShortcuts<T extends (config: CustomRequestConfig) => Promise<any>>(
  baseRequest: T
): T & Omit<HttpRequest, 'default'> {
  const enhanced = baseRequest as T & Omit<HttpRequest, 'default'>;

  enhanced.get = <R = unknown>(url: string, config?: CustomRequestConfig) =>
    baseRequest({ ...config, method: 'GET', url });

  enhanced.post = <R = unknown>(url: string, data?: unknown, config?: CustomRequestConfig) =>
    baseRequest({ ...config, method: 'POST', url, data });

  enhanced.put = <R = unknown>(url: string, data?: unknown, config?: CustomRequestConfig) =>
    baseRequest({ ...config, method: 'PUT', url, data });

  enhanced.delete = <R = unknown>(url: string, config?: CustomRequestConfig) =>
    baseRequest({ ...config, method: 'DELETE', url });

  enhanced.patch = <R = unknown>(url: string, data?: unknown, config?: CustomRequestConfig) =>
    baseRequest({ ...config, method: 'PATCH', url, data });

  enhanced.head = <R = unknown>(url: string, config?: CustomRequestConfig) =>
    baseRequest({ ...config, method: 'HEAD', url });

  enhanced.options = <R = unknown>(url: string, config?: CustomRequestConfig) =>
    baseRequest({ ...config, method: 'OPTIONS', url });

  return enhanced;
}

/**
 * 处理请求错误
 */
function handleRequestError(error: unknown, config: CustomRequestConfig): never {
  // 如果设置了跳过错误处理，则直接抛出错误
  if (config.skipErrorHandler) {
    throw error;
  }

  // 获取实例默认配置
  const instanceConfig = instanceConfigMap.get(config.instanceName ?? DEFAULT_INSTANCE_NAME);

  // 确定最终的 withFullResponse 值
  const finalWithFullResponse = resolveWithFullResponse(config, instanceConfig);

  // 合并请求配置和实例配置
  const mergedConfig = {
    ...config,
    withFullResponse: finalWithFullResponse,
  };

  // 优先使用请求级别的 errorHandler
  if (config.errorConfig?.errorHandler) {
    config.errorConfig.errorHandler(error, { config: mergedConfig });
  } else if (instanceConfig?.errorConfig?.errorHandler) {
    // 其次使用实例级别的 errorHandler
    instanceConfig.errorConfig.errorHandler(error, { config: mergedConfig });
  }

  throw error;
}
