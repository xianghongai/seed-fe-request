/**
 * 错误上下文工具函数模块
 *
 * 职责:
 * 安全地提取错误上下文中的信息
 *
 * 核心特性:
 * - 类型安全: 使用类型守卫确保类型正确
 * - 防御性编程: 处理未知类型的值
 * - 空安全: 避免 null/undefined 导致的错误
 *
 * 主要功能:
 * ```
 * isObject         → 检查是否为对象
 * hasResponseStatus → 检查是否包含响应状态码
 * getResponseStatus → 安全提取响应状态码
 * ```
 *
 * @example
 * // 安全提取状态码
 * const status = getResponseStatus(errorContext);
 * if (status === 404) {
 *   // 处理 404 错误
 * }
 */
import type { ErrorContext } from '../types';

/**
 * 对象类型守卫
 *
 * 将 unknown 类型窄化为通用对象类型
 *
 * 检查规则:
 * - 类型必须是 'object'
 * - 不能是 null (typeof null === 'object')
 *
 * @param x - 待检查的值
 * @returns 是否为对象
 *
 * @example
 * const value: unknown = { foo: 'bar' };
 * if (isObject(value)) {
 *   // TypeScript 知道 value 是对象
 *   console.log(value.foo);
 * }
 *
 * @example
 * isObject(null);        // false (null 不是对象)
 * isObject(undefined);   // false
 * isObject(42);          // false
 * isObject('string');    // false
 * isObject([]);          // true (数组也是对象)
 * isObject({});          // true
 */
function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/**
 * 响应状态码类型守卫
 *
 * 检查值是否包含数字类型的 status 属性
 *
 * 适用场景:
 * - 验证响应对象是否包含有效的 HTTP 状态码
 * - 在错误处理中安全访问 status
 *
 * @param x - 待检查的值
 * @returns 是否包含 status: number
 *
 * @example
 * const response = { status: 200, data: {...} };
 * if (hasResponseStatus(response)) {
 *   // TypeScript 知道 response.status 是 number
 *   console.log(response.status);  // 200
 * }
 *
 * @example
 * const error = { message: 'Error' };
 * hasResponseStatus(error);  // false (没有 status)
 *
 * @example
 * const invalid = { status: '200' };
 * hasResponseStatus(invalid);  // false (status 不是 number)
 */
export function hasResponseStatus(x: unknown): x is { status: number } {
  return isObject(x) && typeof (x as { status?: unknown }).status === 'number';
}

/**
 * 安全提取响应状态码
 *
 * 从错误上下文的响应对象中安全地读取 HTTP 状态码
 *
 * 安全机制:
 * - 检查响应对象是否存在
 * - 检查 status 属性是否为数字
 * - 不存在时返回 undefined
 *
 * @param ctx - 错误上下文
 * @returns HTTP 状态码 (如果存在)，否则 undefined
 *
 * @example
 * // 成功提取状态码
 * const ctx: ErrorContext = {
 *   error: new Error('Request failed'),
 *   config: {...},
 *   response: { status: 404, data: null }
 * };
 * const status = getResponseStatus(ctx);
 * // status = 404
 *
 * @example
 * // 没有响应对象
 * const ctx: ErrorContext = {
 *   error: new Error('Network error'),
 *   config: {...}
 * };
 * const status = getResponseStatus(ctx);
 * // status = undefined (网络错误，没有响应)
 *
 * @example
 * // 响应对象缺少 status
 * const ctx: ErrorContext = {
 *   error: new Error('Unknown error'),
 *   config: {...},
 *   response: { data: null }
 * };
 * const status = getResponseStatus(ctx);
 * // status = undefined
 *
 * @example
 * // 实际应用: 错误处理
 * async function errorHandler(error: unknown, next: () => Promise<void>) {
 *   const ctx = createErrorContext(error, config);
 *   const status = getResponseStatus(ctx);
 *
 *   if (status === 401) {
 *     // 未授权，重定向到登录页
 *     redirectToLogin();
 *   } else if (status === 404) {
 *     // 资源不存在
 *     showNotFoundMessage();
 *   } else if (status && status >= 500) {
 *     // 服务器错误
 *     showServerErrorMessage();
 *   } else {
 *     // 其他错误或没有状态码
 *     showGenericErrorMessage();
 *   }
 *
 *   return next();
 * }
 */
export function getResponseStatus(ctx: ErrorContext): number | undefined {
  return hasResponseStatus(ctx.response) ? ctx.response.status : undefined;
}
