import type { AxiosInstance } from 'axios';
import { INVALID_INTERCEPTOR_ID } from '../constant/messages';
import type { AnyRequestInterceptor, AnyResponseInterceptor, CustomRequestConfig } from '../types';
import { isTupleInterceptor } from '../utils/validators';
import { parseRequestInterceptor, parseResponseInterceptor } from './interceptor-parser';

/**
 * 创建拦截器注册函数
 */
function createInterceptorRegistrar(instance: AxiosInstance, type: 'request' | 'response') {
  const interceptor = instance.interceptors[type];

  return (onFulfilled: unknown, onRejected?: unknown) => {
    return onRejected !== undefined
      ? interceptor.use(onFulfilled as never, onRejected as never)
      : interceptor.use(onFulfilled as never);
  };
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
 * 设置实例拦截器
 */
export function setupInstanceInterceptors(
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
