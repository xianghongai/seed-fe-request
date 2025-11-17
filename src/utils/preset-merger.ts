import type { AxiosResponse } from 'axios';
import type {
  AnyRequestInterceptor,
  AnyResponseInterceptor,
  CustomRequestConfig,
  SharedPreset,
  StageConfig,
} from '../types';
import { normalizeError } from './request-error';

// 辅助：将单个值或只读数组统一为可变数组（含 undefined → 空数组）
function toArray<T>(x: undefined): T[];
function toArray<T>(x: ReadonlyArray<T>): T[];
function toArray<T>(x: T): T[];
function toArray<T>(x: ReadonlyArray<T> | T | undefined): T[] {
  if (x === undefined) return [];
  return Array.isArray(x) ? [...(x as ReadonlyArray<T>)] : [x as T];
}

function stageEnabled(stage?: StageConfig<unknown>): boolean {
  return stage?.enabled !== false; // 未显式禁用则视为开启
}

/**
 * 将 SharedPreset 的阶段钩子转换为 `config.interceptors` 结构
 * 注意：
 * - 本函数不做层级覆盖合并（US3 实现），仅将传入的 sharedPreset 转为临时一次性拦截器
 * - 错误阶段：若存在 onError 且未禁用，则在响应拦截器中追加一个 onRejected，将错误标准化为 Promise.reject(Error)
 */
export function computePresetInterceptors(
  _requestCfg: CustomRequestConfig | undefined,
  _instanceCfg: CustomRequestConfig | undefined,
  sharedPreset: Pick<SharedPreset, 'onRequest' | 'onResponse' | 'onError'> | undefined
): { request: AnyRequestInterceptor[]; response: AnyResponseInterceptor[] } {
  const requestList: AnyRequestInterceptor[] = [];
  const responseList: AnyResponseInterceptor[] = [];

  if (!sharedPreset) {
    return { request: requestList, response: responseList };
  }

  // 请求阶段
  if (sharedPreset.onRequest && stageEnabled(sharedPreset.onRequest)) {
    const reqHandlers = sharedPreset.onRequest.handlers as
      | ReadonlyArray<AnyRequestInterceptor>
      | AnyRequestInterceptor
      | undefined;
    requestList.push(...toArray<AnyRequestInterceptor>(reqHandlers));
  }

  // 响应成功阶段
  if (sharedPreset.onResponse && stageEnabled(sharedPreset.onResponse)) {
    const resHandlers = sharedPreset.onResponse.handlers as
      | ReadonlyArray<AnyResponseInterceptor>
      | AnyResponseInterceptor
      | undefined;
    responseList.push(...toArray<AnyResponseInterceptor>(resHandlers));
  }

  // 错误阶段：通过在响应拦截器中追加一个 onRejected 来统一标准化
  if (sharedPreset.onError && stageEnabled(sharedPreset.onError)) {
    const passThrough = (resp: AxiosResponse) => resp;
    const normalizeReject: (err: unknown) => unknown = (err) => normalizeError(err);
    // 使用元组形式 [onFulfilled, onRejected]
    responseList.push([passThrough, normalizeReject]);
  }

  return { request: requestList, response: responseList };
}
