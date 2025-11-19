/**
 * 拦截器管理模块
 *
 * 职责:
 * 1. 将拦截器注册到 Axios 实例
 * 2. 支持多种格式的拦截器配置
 * 3. 管理拦截器 ID (用于卸载)
 * 4. 区分永久注册和一次性注册
 *
 * 核心特性:
 * - 格式兼容: 支持新旧两种配置格式
 * - 批量注册: 支持数组形式的拦截器
 * - ID 管理: 返回注册的拦截器 ID，便于后续卸载
 * - 一次性模式: 支持临时拦截器的自动卸载
 *
 * 注册模式:
 * ```
 * 永久注册 (isOneTime=false): 拦截器注册后一直有效
 * 一次性注册 (isOneTime=true): 收集 ID，便于请求后自动卸载
 * ```
 *
 * 配置格式兼容:
 * ```
 * 新格式: config.interceptors.request / config.interceptors.response
 * 旧格式: config.requestInterceptors / config.responseInterceptors
 * ```
 *
 * @example
 * // 永久注册实例拦截器
 * const { requestIds, responseIds } = setupInstanceInterceptors(
 *   axiosInstance,
 *   instanceConfig,
 *   false
 * );
 *
 * @example
 * // 一次性注册请求拦截器 (返回 ID 用于卸载)
 * const { requestIds, responseIds } = setupInstanceInterceptors(
 *   axiosInstance,
 *   requestConfig,
 *   true
 * );
 * // 请求后使用 requestIds 卸载
 */
import type { AxiosInstance } from 'axios';
import { INVALID_INTERCEPTOR_ID } from '../constant/messages';
import type { AnyRequestInterceptor, AnyResponseInterceptor, CustomRequestConfig } from '../types';
import { parseRequestInterceptor, parseResponseInterceptor } from './interceptor-parser';
import { toInterceptorArray } from './utils';

/**
 * 创建拦截器注册函数
 *
 * 返回一个闭包函数，用于注册拦截器到 Axios 实例
 *
 * @param instance - Axios 实例
 * @param type - 拦截器类型 (request 或 response)
 * @returns 注册函数
 *
 * @example
 * const registerRequest = createInterceptorRegistrar(instance, 'request');
 * const id = registerRequest(
 *   (config) => config,
 *   (error) => Promise.reject(error)
 * );
 * // id 可用于后续卸载: instance.interceptors.request.eject(id)
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
 *
 * 支持单个或数组形式的拦截器，统一注册到 Axios 实例
 *
 * 工作流程:
 * 1. 转换为拦截器数组 (统一处理单个和数组)
 * 2. 遍历数组，解析每个拦截器
 * 3. 注册到 Axios 实例，获取 ID
 * 4. 收集有效的 ID (跳过无效的 -1)
 *
 * @param interceptors - 拦截器配置 (单个/数组/null/undefined)
 * @param parser - 拦截器解析函数
 * @param registerFn - 注册函数
 * @param collectIds - ID 收集数组 (可选，用于一次性注册)
 * @returns 注册的拦截器 ID 数组
 *
 * @example
 * // 注册单个拦截器
 * const ids = registerSingleInterceptorGroup(
 *   (config) => config,
 *   parseRequestInterceptor,
 *   registerRequestInterceptor
 * );
 * // ids: [0]  (注册成功的 ID)
 *
 * @example
 * // 注册拦截器数组
 * const ids = registerSingleInterceptorGroup(
 *   [interceptor1, interceptor2, interceptor3],
 *   parseRequestInterceptor,
 *   registerRequestInterceptor
 * );
 * // ids: [0, 1, 2]  (按顺序注册)
 *
 * @example
 * // 一次性注册 (收集 ID 到外部数组)
 * const requestIds: number[] = [];
 * registerSingleInterceptorGroup(
 *   interceptors,
 *   parseRequestInterceptor,
 *   registerRequestInterceptor,
 *   requestIds  // ID 会追加到这个数组
 * );
 */
function registerSingleInterceptorGroup<T extends AnyRequestInterceptor | AnyResponseInterceptor>(
  interceptors: T | T[] | null | undefined,
  parser: (interceptor: T) => [unknown, unknown | undefined],
  registerFn: (onFulfilled: unknown, onRejected?: unknown) => number,
  collectIds?: number[]
): number[] {
  if (!interceptors) return [];

  const ids: number[] = [];
  const list = toInterceptorArray<T>(interceptors as unknown);
  for (const item of list) {
    const [onFulfilled, onRejected] = parser(item);
    const id = registerFn(onFulfilled, onRejected);
    if (id !== INVALID_INTERCEPTOR_ID) ids.push(id);
  }
  if (collectIds) collectIds.push(...ids);
  return ids;
}

/**
 * 设置实例拦截器
 *
 * 主要入口函数，将配置中的拦截器注册到 Axios 实例
 *
 * 工作流程:
 * 1. 创建请求和响应拦截器的注册函数
 * 2. 处理新格式配置 (config.interceptors.request / response)
 * 3. 处理旧格式配置 (config.requestInterceptors / responseInterceptors)
 * 4. 根据 isOneTime 决定是否收集 ID
 * 5. 返回所有注册的拦截器 ID
 *
 * 注册模式:
 * - 永久注册 (isOneTime=false): 实例级拦截器，注册后一直有效
 * - 一次性注册 (isOneTime=true): 请求级拦截器，收集 ID 用于请求后自动卸载
 *
 * @param instance - Axios 实例
 * @param config - 配置对象 (包含拦截器配置)
 * @param isOneTime - 是否为一次性注册 (默认 false)
 * @returns 注册的拦截器 ID (requestIds 和 responseIds)
 *
 * @example
 * // 永久注册实例拦截器（库内部用法示例）
 * // 说明：实际对外 API 通过 defineRequestConfig 完成注册；此处演示底层注册流程
 * const axiosInstance = axios.create({ baseURL: '/api' });
 * const config = { interceptors: { request: (cfg) => { cfg.headers.Token = getToken(); return cfg; } } } as any;
 * const { requestIds } = setupInstanceInterceptors(axiosInstance, config, false);
 * // 这些拦截器会一直有效，直到实例销毁（或手动 eject）
 *
 * @example
 * // 一次性注册请求拦截器（演示用）
 * const { requestIds, responseIds } = setupInstanceInterceptors(
 *   axiosInstance,
 *   {
 *     interceptors: {
 *       request: (config) => {
 *         config.headers['X-Request-ID'] = generateId();
 *         return config;
 *       }
 *     }
 *   },
 *   true  // 一次性注册
 * );
 *
 * // 请求完成后卸载
 * requestIds.forEach(id => axiosInstance.interceptors.request.eject(id));
 * responseIds.forEach(id => axiosInstance.interceptors.response.eject(id));
 *
 * @example
 * // 兼容旧格式
 * setupInstanceInterceptors(
 *   instance,
 *   {
 *     requestInterceptors: [...],  // 旧格式
 *     responseInterceptors: [...]  // 旧格式
 *   }
 * );
 */
export function setupInstanceInterceptors(
  instance: AxiosInstance,
  config: CustomRequestConfig,
  isOneTime = false
): { requestIds: number[]; responseIds: number[] } {
  const requestIds: number[] = [];
  const responseIds: number[] = [];

  // 1. 创建注册函数
  const registerRequestInterceptor = createInterceptorRegistrar(instance, 'request');
  const registerResponseInterceptor = createInterceptorRegistrar(instance, 'response');

  // 2. 处理新格式配置 (config.interceptors.request / response)
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

  // 3. 处理旧格式配置 (兼容性)
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
