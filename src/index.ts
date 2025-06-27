import axios, { type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type {
  AnyRequestInterceptor,
  AnyResponseInterceptor,
  CustomRequestConfig,
  HttpRequest,
  InstanceName,
  InterceptorId,
  RequestInterceptorObject,
  ResponseInterceptorObject,
} from './types';

/**
 * 表示拦截器添加失败的常量
 */
const INVALID_INTERCEPTOR_ID = -1;

/**
 * 实例映射，用于存储定义的实例
 */
const instanceMap: Map<InstanceName, AxiosInstance> = new Map();

/**
 * 默认实例名称
 * 使用 Symbol.for 注册，确保唯一性
 */
export const DEFAULT_INSTANCE_NAME: InstanceName = Symbol.for('default');

/**
 * 处理单个请求拦截器
 * @returns 返回拦截器的唯一标识，如果添加失败则返回 INVALID_INTERCEPTOR_ID
 */
function handleRequestInterceptor(instance: AxiosInstance, interceptor: AnyRequestInterceptor): InterceptorId {
  // 处理对象形式的拦截器 { onConfig, onError }
  if (!Array.isArray(interceptor) && typeof interceptor === 'object' && 'onConfig' in interceptor) {
    const { onConfig, onError } = interceptor as RequestInterceptorObject;
    return onConfig
      ? instance.interceptors.request.use(onConfig, onError ?? ((error) => Promise.reject(error)))
      : INVALID_INTERCEPTOR_ID;
  }

  // 处理元组形式的拦截器 [onFulfilled, onRejected]
  if (Array.isArray(interceptor)) {
    return interceptor.length === 2
      ? instance.interceptors.request.use(interceptor[0], interceptor[1])
      : instance.interceptors.request.use(interceptor[0]);
  }

  // 处理函数形式的拦截器
  return instance.interceptors.request.use(
    interceptor as (
      config: InternalAxiosRequestConfig,
    ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>,
  );
}

/**
 * 处理单个响应拦截器
 * @returns 返回拦截器的唯一标识，如果添加失败则返回 INVALID_INTERCEPTOR_ID
 */
function handleResponseInterceptor(instance: AxiosInstance, interceptor: AnyResponseInterceptor): InterceptorId {
  // 处理对象形式的拦截器 { onConfig, onError }
  if (!Array.isArray(interceptor) && typeof interceptor === 'object' && 'onConfig' in interceptor) {
    const { onConfig, onError } = interceptor as ResponseInterceptorObject;
    return onConfig
      ? instance.interceptors.response.use(onConfig, onError ?? ((error) => Promise.reject(error)))
      : INVALID_INTERCEPTOR_ID;
  }

  // 处理元组形式的拦截器 [onFulfilled, onRejected]
  if (Array.isArray(interceptor)) {
    return interceptor.length === 2
      ? instance.interceptors.response.use(interceptor[0], interceptor[1])
      : instance.interceptors.response.use(interceptor[0]);
  }

  // 处理函数形式的拦截器
  return instance.interceptors.response.use(
    interceptor as (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>,
  );
}

/**
 * 添加拦截器到实例
 */
function addInterceptorsToInstance(
  instance: AxiosInstance,
  config: CustomRequestConfig,
  isOneTime = false,
): { requestIds: number[]; responseIds: number[] } {
  const requestIds: number[] = [];
  const responseIds: number[] = [];

  // 处理新风格的拦截器配置
  if (config.interceptors) {
    // 处理请求拦截器
    if (config.interceptors.request) {
      const interceptors = Array.isArray(config.interceptors.request)
        ? config.interceptors.request
        : [config.interceptors.request];

      interceptors.forEach((interceptor) => {
        const id = handleRequestInterceptor(instance, interceptor);
        if (id !== INVALID_INTERCEPTOR_ID && isOneTime) requestIds.push(id);
      });
    }

    // 处理响应拦截器
    if (config.interceptors.response) {
      const interceptors = Array.isArray(config.interceptors.response)
        ? config.interceptors.response
        : [config.interceptors.response];

      interceptors.forEach((interceptor) => {
        const id = handleResponseInterceptor(instance, interceptor);
        if (id !== INVALID_INTERCEPTOR_ID && isOneTime) responseIds.push(id);
      });
    }
  }

  // 处理原始风格的拦截器配置
  if (config.requestInterceptors) {
    config.requestInterceptors.forEach((interceptor) => {
      const id = handleRequestInterceptor(instance, interceptor);
      if (id !== INVALID_INTERCEPTOR_ID && isOneTime) requestIds.push(id);
    });
  }

  if (config.responseInterceptors) {
    config.responseInterceptors.forEach((interceptor) => {
      const id = handleResponseInterceptor(instance, interceptor);
      if (id !== INVALID_INTERCEPTOR_ID && isOneTime) responseIds.push(id);
    });
  }

  return { requestIds, responseIds };
}

/**
 * 注册多个实例，可以是单个配置对象或配置数组
 */
export function defineRequestConfig(configs: CustomRequestConfig | CustomRequestConfig[]): void {
  // 转换为数组统一处理
  const configsArray = Array.isArray(configs) ? configs : [configs];

  configsArray.forEach((config) => {
    const instanceName = config.instanceName ?? DEFAULT_INSTANCE_NAME;

    // 检查是否已存在同名实例（除非是默认实例且尚未定义）
    if (instanceMap.has(instanceName)) {
      if (instanceName === DEFAULT_INSTANCE_NAME && instanceMap.size === 0) {
        // 允许重复定义默认实例，但只有首次生效，提示"默认实例已定义，忽略此次定义"
        console.warn('Default instance already defined, ignoring this definition');
        return;
      }
      // 提示"实例已存在，不能重复定义"
      throw new Error(`Instance ${String(instanceName)} already exists, cannot be defined again`);
    }

    // 如果无实例名且已存在默认实例，抛出异常
    if (!config.instanceName && instanceMap.has(DEFAULT_INSTANCE_NAME)) {
      // 提示"默认实例已存在，必须为新实例指定 instanceName"
      throw new Error('Default instance already exists, must specify instanceName for new instance');
    }

    const instance = axios.create(config);

    // 添加拦截器
    addInterceptorsToInstance(instance, config);

    // 保存实例
    instanceMap.set(instanceName, instance);
    // 提示"成功定义请求实例"
    console.log(`Successfully defined request instance: ${String(instanceName)}`);
  });
}

// 获取实例
export function getRequestInstance(instanceName?: InstanceName): AxiosInstance {
  const instance = instanceMap.get(instanceName ?? DEFAULT_INSTANCE_NAME);
  if (!instance) {
    throw new Error(`Axios instance not found for instanceName: ${String(instanceName ?? DEFAULT_INSTANCE_NAME)}`);
  }
  return instance as AxiosInstance;
}

// 全局 request 便捷方法
export async function request<T = unknown>(config: CustomRequestConfig): Promise<T> {
  try {
    const instanceName = config.instanceName ?? DEFAULT_INSTANCE_NAME;
    const instance = getRequestInstance(instanceName);

    // 获取实例默认配置
    const instanceConfig = [...instanceMap.entries()].find(([name]) => name === instanceName)?.[1]?.defaults as
      | CustomRequestConfig
      | undefined;

    // 合并请求配置和实例配置
    const mergedConfig = {
      ...config,
      withFullResponse:
        config.withFullResponse !== undefined ? config.withFullResponse : instanceConfig?.withFullResponse,
    };

    // 添加一次性拦截器
    const { requestIds, responseIds } = addInterceptorsToInstance(instance, mergedConfig, true);

    try {
      // 发送请求
      const response = await instance.request(mergedConfig);
      return mergedConfig.withFullResponse ? (response as unknown as T) : (response.data as T);
    } finally {
      // 移除一次性拦截器
      requestIds.forEach((id) => instance.interceptors.request.eject(id));
      responseIds.forEach((id) => instance.interceptors.response.eject(id));
    }
  } catch (error) {
    // 如果设置了跳过错误处理，则直接抛出错误
    if (config.skipErrorHandler) {
      throw error;
    }

    // 获取实例默认配置
    const instanceConfig = [...instanceMap.entries()].find(
      ([name]) => name === (config.instanceName ?? DEFAULT_INSTANCE_NAME),
    )?.[1]?.defaults as CustomRequestConfig | undefined;

    // 合并请求配置和实例配置
    const mergedConfig = {
      ...config,
      withFullResponse:
        config.withFullResponse !== undefined ? config.withFullResponse : instanceConfig?.withFullResponse,
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
}

// 全局 request 便捷方法
const httpRequest = request as HttpRequest;
httpRequest.get = <T = unknown>(url: string, config?: CustomRequestConfig) =>
  request<T>({ ...config, method: 'GET', url });
httpRequest.post = <T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig) =>
  request<T>({ ...config, method: 'POST', url, data });
httpRequest.put = <T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig) =>
  request<T>({ ...config, method: 'PUT', url, data });
httpRequest.delete = <T = unknown>(url: string, config?: CustomRequestConfig) =>
  request<T>({ ...config, method: 'DELETE', url });
httpRequest.patch = <T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig) =>
  request<T>({ ...config, method: 'PATCH', url, data });
httpRequest.head = <T = unknown>(url: string, config?: CustomRequestConfig) =>
  request<T>({ ...config, method: 'HEAD', url });
httpRequest.options = <T = unknown>(url: string, config?: CustomRequestConfig) =>
  request<T>({ ...config, method: 'OPTIONS', url });

export default httpRequest;
