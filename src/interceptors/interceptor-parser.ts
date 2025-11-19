/**
 * 拦截器解析模块
 *
 * 职责:
 * 1. 解析多种格式的拦截器 (函数/对象/元组)
 * 2. 统一转换为标准格式 [onFulfilled, onRejected]
 * 3. 提供默认错误处理器
 *
 * 支持的拦截器格式:
 * - 函数形式: (config) => config
 * - 对象形式: { onConfig, onError }
 * - 元组形式: [onFulfilled, onRejected]
 *
 * 设计理念:
 * - 灵活性: 支持多种用户习惯的格式
 * - 一致性: 统一转换为标准格式供责任链使用
 * - 类型安全: 严格的类型检查和转换
 *
 * @example
 * // 解析请求拦截器
 * const [onFulfilled, onRejected] = parseRequestInterceptor(interceptor);
 *
 * // 解析响应拦截器
 * const [onFulfilled, onRejected] = parseResponseInterceptor(interceptor);
 */
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
 *
 * 默认行为: 直接拒绝，将错误传递给下一级
 *
 * @returns 默认错误处理函数
 */
function createDefaultErrorHandler() {
  return (error: unknown) => Promise.reject(error);
}

/**
 * 解析请求拦截器
 *
 * 统一转换为标准格式: [onFulfilled, onRejected]
 *
 * 支持的格式:
 * 1. 对象形式: { onConfig, onError }
 * 2. 元组形式: [onFulfilled, onRejected]
 * 3. 函数形式: (config) => config
 *
 * @param interceptor - 任意格式的请求拦截器
 * @returns 标准格式: [onFulfilled, onRejected]
 * @throws 如果对象形式缺少 onConfig 字段
 *
 * @example
 * // 对象形式
 * const [onFulfilled, onRejected] = parseRequestInterceptor({
 *   onConfig: (config) => {
 *     config.headers.Token = getToken();
 *     return config;
 *   },
 *   onError: (error) => {
 *     console.error('Config error:', error);
 *     return Promise.reject(error);
 *   }
 * });
 *
 * @example
 * // 元组形式 (Axios 原生风格)
 * const [onFulfilled, onRejected] = parseRequestInterceptor([
 *   (config) => config,
 *   (error) => Promise.reject(error)
 * ]);
 *
 * @example
 * // 函数形式 (简洁)
 * const [onFulfilled, onRejected] = parseRequestInterceptor(
 *   (config) => {
 *     config.headers.Token = getToken();
 *     return config;
 *   }
 * );
 * // onRejected 为 undefined
 */
export function parseRequestInterceptor(
  interceptor: AnyRequestInterceptor
): [
  (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>,
  ((error: unknown) => unknown) | undefined,
] {
  // 1. 对象形式 { onConfig, onError }
  if (isInterceptorObject(interceptor)) {
    const { onConfig, onError } = interceptor as RequestInterceptorObject;
    if (!onConfig) {
      throw new Error(ERROR_MESSAGES.INVALID_REQUEST_INTERCEPTOR);
    }
    return [onConfig, onError ?? createDefaultErrorHandler()];
  }

  // 2. 元组形式 [onFulfilled, onRejected]
  if (Array.isArray(interceptor)) {
    return interceptor.length === 2 ? [interceptor[0], interceptor[1]] : [interceptor[0], undefined];
  }

  // 3. 函数形式
  return [
    interceptor as (
      config: InternalAxiosRequestConfig
    ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>,
    undefined,
  ];
}

/**
 * 解析响应拦截器
 *
 * 统一转换为标准格式: [onFulfilled, onRejected]
 *
 * 支持的格式:
 * 1. 对象形式: { onConfig, onError }
 * 2. 元组形式: [onFulfilled, onRejected]
 * 3. 函数形式: (response) => response
 *
 * @param interceptor - 任意格式的响应拦截器
 * @returns 标准格式: [onFulfilled, onRejected]
 * @throws 如果对象形式缺少 onConfig 字段
 *
 * @example
 * // 对象形式
 * const [onFulfilled, onRejected] = parseResponseInterceptor({
 *   onConfig: (response) => {
 *     // 解包数据
 *     if (response.data?.data) {
 *       response.data = response.data.data;
 *     }
 *     return response;
 *   },
 *   onError: (error) => {
 *     console.error('Response error:', error);
 *     return Promise.reject(error);
 *   }
 * });
 *
 * @example
 * // 元组形式 (Axios 原生风格)
 * const [onFulfilled, onRejected] = parseResponseInterceptor([
 *   (response) => response,
 *   (error) => Promise.reject(error)
 * ]);
 *
 * @example
 * // 函数形式 (简洁)
 * const [onFulfilled, onRejected] = parseResponseInterceptor(
 *   (response) => {
 *     console.log('Response:', response.status);
 *     return response;
 *   }
 * );
 * // onRejected 为 undefined
 */
export function parseResponseInterceptor(
  interceptor: AnyResponseInterceptor
): [(response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>, ((error: unknown) => unknown) | undefined] {
  // 1. 对象形式 { onConfig, onError }
  if (isInterceptorObject(interceptor)) {
    const { onConfig, onError } = interceptor as ResponseInterceptorObject;
    if (!onConfig) {
      throw new Error(ERROR_MESSAGES.INVALID_RESPONSE_INTERCEPTOR);
    }
    return [onConfig, onError ?? createDefaultErrorHandler()];
  }

  // 2. 元组形式 [onFulfilled, onRejected]
  if (Array.isArray(interceptor)) {
    return interceptor.length === 2 ? [interceptor[0], interceptor[1]] : [interceptor[0], undefined];
  }

  // 3. 函数形式
  return [interceptor as (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>, undefined];
}
