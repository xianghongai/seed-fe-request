import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { ERROR_MESSAGES } from '../constant/messages';
import type {
  AnyRequestInterceptor,
  AnyResponseInterceptor,
  RequestInterceptorObject,
  ResponseInterceptorObject,
} from '../types';
import { isInterceptorObject } from '../utils/validators';

/**
 * 创建默认错误处理器
 */
function createDefaultErrorHandler() {
  return (error: unknown) => Promise.reject(error);
}

/**
 * 解析请求拦截器，统一为标准格式
 */
export function parseRequestInterceptor(
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
export function parseResponseInterceptor(
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
