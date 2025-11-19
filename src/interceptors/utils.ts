/**
 * 拦截器工具函数模块
 *
 * 职责:
 * 将多种格式的拦截器配置统一转换为数组格式
 *
 * 核心特性:
 * - 格式统一: 将单值/数组/元组统一为数组
 * - 元组识别: 智能识别 [onFulfilled, onRejected] 元组格式
 * - 空值处理: undefined/null 转换为空数组
 *
 * 转换规则:
 * ```
 * undefined/null       → []
 * 单个拦截器           → [拦截器]
 * 元组 [fn, fn]        → [元组] (视为单个拦截器项)
 * 拦截器数组           → [拦截器1, 拦截器2, ...]
 * ```
 *
 * @example
 * // 单值转数组
 * toInterceptorArray((config) => config);
 * // 返回: [(config) => config]
 *
 * @example
 * // 元组保持完整
 * toInterceptorArray([(config) => config, (err) => Promise.reject(err)]);
 * // 返回: [[(config) => config, (err) => Promise.reject(err)]]
 *
 * @example
 * // 数组保持原样
 * toInterceptorArray([interceptor1, interceptor2, interceptor3]);
 * // 返回: [interceptor1, interceptor2, interceptor3]
 */

/**
 * 将单值/数组/元组统一为拦截器数组
 *
 * 智能处理多种输入格式，统一转换为数组形式
 *
 * 转换逻辑:
 * 1. null/undefined: 返回空数组
 * 2. 非数组: 包装为单元素数组
 * 3. 元组 [fn, fn]: 视为单个拦截器项，包装为 [元组]
 * 4. 其他数组: 原样返回
 *
 * 元组识别:
 * - 长度为 2
 * - 两个元素都是函数
 * - 符合 Axios 拦截器元组格式 [onFulfilled, onRejected]
 *
 * @param value - 拦截器配置 (单值/数组/元组/null/undefined)
 * @returns 拦截器数组
 *
 * @example
 * // undefined/null → 空数组
 * toInterceptorArray(undefined);  // []
 * toInterceptorArray(null);       // []
 *
 * @example
 * // 单个拦截器 → 单元素数组
 * const interceptor = (config) => config;
 * toInterceptorArray(interceptor);
 * // 返回: [(config) => config]
 *
 * @example
 * // 元组格式 → 保持元组完整性
 * const tuple = [
 *   (config) => config,
 *   (error) => Promise.reject(error)
 * ];
 * toInterceptorArray(tuple);
 * // 返回: [[onFulfilled, onRejected]]  (元组作为单个项)
 *
 * @example
 * // 拦截器数组 → 原样返回
 * const interceptors = [
 *   (config) => { config.headers.A = '1'; return config; },
 *   (config) => { config.headers.B = '2'; return config; },
 *   (config) => { config.headers.C = '3'; return config; }
 * ];
 * toInterceptorArray(interceptors);
 * // 返回: [拦截器1, 拦截器2, 拦截器3]  (保持数组原样)
 *
 * @example
 * // 对象格式拦截器
 * const objInterceptor = {
 *   onConfig: (config) => config,
 *   onError: (err) => Promise.reject(err)
 * };
 * toInterceptorArray(objInterceptor);
 * // 返回: [{ onConfig, onError }]  (包装为数组)
 */
export function toInterceptorArray<T>(value: unknown): T[] {
  // 1. null/undefined → 空数组
  if (value == null) return [];

  // 2. 非数组 → 包装为单元素数组
  if (!Array.isArray(value)) return [value as T];

  // 3. 元组判断: 长度为 2 且都是函数
  const arr = value as unknown[];
  if (arr.length === 2 && typeof arr[0] === 'function' && typeof arr[1] === 'function') {
    // 视为 Axios 元组格式 [onFulfilled, onRejected]，包装为数组
    return [value as unknown as T];
  }

  // 4. 其他数组 → 原样返回
  return value as T[];
}
