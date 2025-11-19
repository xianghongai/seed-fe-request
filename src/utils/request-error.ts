/**
 * 错误标准化模块
 *
 * 职责:
 * 将任意类型的错误统一标准化为 Error 实例
 *
 * 核心特性:
 * - 类型统一: 确保所有错误都是 Error 实例
 * - 信息保留: 保留原始错误信息
 * - Promise 规范: 返回拒绝的 Promise
 *
 * 标准化规则:
 * ```
 * Error 实例 (包括 AxiosError)  → Promise.reject(error)  (保持原样)
 * 字符串/数字/对象等           → Promise.reject(new Error(String(error)))  (包装)
 * ```
 *
 * @example
 * // 标准化错误
 * normalizeError(new Error('Network error'));
 * // 返回: Promise.reject(Error('Network error'))
 *
 * @example
 * // 标准化非 Error 类型
 * normalizeError('Something went wrong');
 * // 返回: Promise.reject(new Error('Something went wrong'))
 */

/**
 * 将任意类型的错误标准化为 Promise 拒绝
 *
 * 用于拦截器中统一错误处理格式，确保所有错误都是 Error 实例
 *
 * 标准化流程:
 * 1. 检查是否已经是 Error 实例 (包括 AxiosError)
 * 2. 如果是，直接返回拒绝的 Promise
 * 3. 如果不是，包装为 Error 实例后返回拒绝的 Promise
 *
 * 为什么需要标准化:
 * - JavaScript 可以 throw 任意类型 (字符串、数字、对象等)
 * - 标准化确保错误处理逻辑的一致性
 * - Error 实例包含堆栈信息，便于调试
 *
 * @param error - 任意类型的错误
 * @returns 拒绝的 Promise，值为 Error 实例
 *
 * @example
 * // Error 实例 - 保持原样
 * const error = new Error('Network error');
 * const result = normalizeError(error);
 * // 返回: Promise.reject(Error('Network error'))
 *
 * @example
 * // AxiosError - 保持原样
 * const axiosError = new AxiosError('Request failed');
 * const result = normalizeError(axiosError);
 * // 返回: Promise.reject(AxiosError('Request failed'))
 *
 * @example
 * // 字符串 - 包装为 Error
 * const result = normalizeError('Something went wrong');
 * // 返回: Promise.reject(new Error('Something went wrong'))
 *
 * @example
 * // 数字 - 包装为 Error
 * const result = normalizeError(404);
 * // 返回: Promise.reject(new Error('404'))
 *
 * @example
 * // 对象 - 包装为 Error
 * const result = normalizeError({ code: 'ERR_NETWORK', message: 'Failed' });
 * // 返回: Promise.reject(new Error('[object Object]'))
 *
 * @example
 * // 实际应用: 拦截器中使用
 * const interceptor = {
 *   onConfig: (response) => response,
 *   onError: (error) => {
 *     // 统一标准化错误
 *     return normalizeError(error);
 *   }
 * };
 *
 * @example
 * // 实际应用: 错误管道中使用
 * async function errorHandler(error, next) {
 *   // 确保错误是 Error 实例
 *   const normalizedError = await normalizeError(error);
 *   // 可以安全地访问 Error 属性
 *   console.error(normalizedError.message);
 *   console.error(normalizedError.stack);
 *   return next();
 * }
 */
export function normalizeError(error: unknown): Promise<never> {
  // 1. 如果已经是 Error 实例 (包括 AxiosError)，直接拒绝
  if (error instanceof Error) {
    return Promise.reject(error);
  }

  // 2. 非 Error 类型，包装成 Error 实例
  // String(error) 确保转换为字符串表示
  return Promise.reject(new Error(String(error)));
}
