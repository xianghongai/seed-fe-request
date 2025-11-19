/**
 * 预设合并器模块
 *
 * 职责:
 * 将共享预设转换为拦截器数组 (仅限共享级)
 *
 * 核心特性:
 * - 阶段转换: 将预设的阶段钩子转换为 Axios 拦截器格式
 * - 错误标准化: 通过响应拦截器的 onRejected 注入错误标准化
 * - 独立管道: 错误阶段不影响错误管道 (请求级/实例级/共享级)
 *
 * 重要说明:
 * - 此模块仅处理共享预设的拦截器转换
 * - 错误阶段 (onError) 通过响应拦截器实现，不启用/禁用错误管道
 * - 若要跳过整条错误管道，请使用 config.skipErrorPipeline
 *
 * 转换规则:
 * ```
 * onRequest  → 请求拦截器数组
 * onResponse → 响应拦截器数组
 * onError    → 响应拦截器的 onRejected (错误标准化)
 * ```
 *
 * @example
 * const preset = {
 *   onRequest: {
 *     enabled: true,
 *     handlers: [(config) => { ... }]
 *   },
 *   onError: {
 *     enabled: true,
 *     handlers: []  // 启用错误标准化
 *   }
 * };
 *
 * const { request, response } = computePresetInterceptors(
 *   requestConfig,
 *   instanceConfig,
 *   preset
 * );
 * // request: [请求处理器]
 * // response: [响应处理器, [passThrough, normalizeError]]
 */
import type { AxiosResponse } from 'axios';
import type {
  AnyRequestInterceptor,
  AnyResponseInterceptor,
  CustomRequestConfig,
  SharedPreset,
  StageConfig,
} from '../types';
import { toArray } from './array';
import { normalizeError } from './request-error';

/**
 * 检查阶段是否启用
 *
 * 规则: 未显式禁用 (enabled !== false) 则视为启用
 *
 * @param stage - 阶段配置
 * @returns 是否启用
 */
function stageEnabled(stage?: StageConfig<unknown>): boolean {
  return stage?.enabled !== false; // 未显式禁用则视为开启
}

/**
 * 计算共享预设的拦截器
 *
 * 将共享预设的阶段钩子转换为拦截器数组
 *
 * 工作流程:
 * 1. 处理请求阶段 (onRequest): 转换为请求拦截器
 * 2. 处理响应阶段 (onResponse): 转换为响应拦截器
 * 3. 处理错误阶段 (onError): 注入错误标准化到响应拦截器
 *
 * 重要说明:
 * - 错误阶段通过响应拦截器的 onRejected 实现
 * - onError.enabled 仅影响共享预设的错误标准化
 * - 不会启用/禁用请求级/实例级/共享级的错误管道
 * - 若要跳过整条错误管道，请使用 config.skipErrorPipeline
 *
 * @param _requestCfg - 请求级配置 (保留参数，当前未使用)
 * @param _instanceCfg - 实例级配置 (保留参数，当前未使用)
 * @param sharedPreset - 共享预设配置
 * @returns 转换后的拦截器数组
 *
 * @example
 * // 完整的共享预设
 * const preset = {
 *   onRequest: {
 *     enabled: true,
 *     handlers: [
 *       (config) => {
 *         config.headers.Token = getToken();
 *         return config;
 *       }
 *     ]
 *   },
 *   onResponse: {
 *     enabled: true,
 *     handlers: [
 *       (response) => {
 *         console.log('Response:', response.status);
 *         return response;
 *       }
 *     ]
 *   },
 *   onError: {
 *     enabled: true,
 *     handlers: []  // 启用错误标准化
 *   }
 * };
 *
 * const { request, response } = computePresetInterceptors(
 *   undefined,
 *   undefined,
 *   preset
 * );
 *
 * // request: [请求拦截器]
 * // response: [响应拦截器, [passThrough, normalizeError]]
 *
 * @example
 * // 禁用错误标准化
 * const preset = {
 *   onRequest: { handlers: [...] },
 *   onError: { enabled: false }  // 禁用
 * };
 *
 * const { request, response } = computePresetInterceptors(
 *   undefined,
 *   undefined,
 *   preset
 * );
 * // response: [响应拦截器]  (不包含错误标准化)
 */
export function computePresetInterceptors(
  _requestCfg: CustomRequestConfig | undefined,
  _instanceCfg: CustomRequestConfig | undefined,
  sharedPreset: Pick<SharedPreset, 'onRequest' | 'onResponse' | 'onError'> | undefined
): { request: AnyRequestInterceptor[]; response: AnyResponseInterceptor[] } {
  const requestList: AnyRequestInterceptor[] = [];
  const responseList: AnyResponseInterceptor[] = [];

  // 如果没有共享预设，返回空数组
  if (!sharedPreset) {
    return { request: requestList, response: responseList };
  }

  // 1. 请求阶段: 转换为请求拦截器
  if (sharedPreset.onRequest && stageEnabled(sharedPreset.onRequest)) {
    const reqHandlers = sharedPreset.onRequest.handlers as
      | ReadonlyArray<AnyRequestInterceptor>
      | AnyRequestInterceptor
      | undefined;
    requestList.push(...toArray<AnyRequestInterceptor>(reqHandlers));
  }

  // 2. 响应成功阶段: 转换为响应拦截器
  if (sharedPreset.onResponse && stageEnabled(sharedPreset.onResponse)) {
    const resHandlers = sharedPreset.onResponse.handlers as
      | ReadonlyArray<AnyResponseInterceptor>
      | AnyResponseInterceptor
      | undefined;
    responseList.push(...toArray<AnyResponseInterceptor>(resHandlers));
  }

  // 3. 错误阶段: 通过响应拦截器的 onRejected 注入错误标准化
  // 说明:
  // - 此处只影响共享预设转换出的响应拦截器
  // - 不影响实例级/全局级错误管道的执行
  // - presetOverrides.onError.enabled=false 仅禁用此 onRejected，不禁用错误管道
  if (sharedPreset.onError && stageEnabled(sharedPreset.onError)) {
    // passThrough: 成功时直接返回响应
    const passThrough = (resp: AxiosResponse) => resp;

    // normalizeReject: 失败时标准化错误
    const normalizeReject: (err: unknown) => unknown = (err) => normalizeError(err);

    // 使用元组形式 [onFulfilled, onRejected]
    responseList.push([passThrough, normalizeReject]);
  }

  return { request: requestList, response: responseList };
}
