/**
 * 配置验证模块
 *
 * 职责:
 * 1. 解析和验证请求配置
 * 2. 类型保护 (Type Guards)
 * 3. 配置净化 (移除自定义字段)
 * 4. 开发时尽早失败 (Fail Fast)
 *
 * 核心特性:
 * - 类型安全: TypeScript 类型守卫确保类型正确性
 * - 早期验证: 在配置使用前验证，避免运行时错误
 * - 灵活性: 支持相对路径和绝对路径的 baseURL
 * - 多格式支持: 验证多种拦截器格式
 *
 * 验证规则:
 * ```
 * baseURL:  字符串，支持相对路径或 http(s):// 绝对路径
 * timeout:  非负有限数
 * interceptors: 函数/对象{onConfig}/元组/数组
 * ```
 *
 * @example
 * // 配置验证
 * validateRequestConfig({
 *   baseURL: '/api',
 *   timeout: 5000,
 *   interceptors: { request: [...] }
 * });
 *
 * @example
 * // 类型保护
 * if (isInterceptorObject(interceptor)) {
 *   const { onConfig, onError } = interceptor;
 * }
 */
import type { CustomRequestConfig } from '../types';

/**
 * 解析 withFullResponse 配置的最终值
 *
 * 优先级: 请求级 > 实例级 > false (默认)
 *
 * withFullResponse 控制返回值类型:
 * - true: 返回完整的 AxiosResponse 对象
 * - false: 仅返回 response.data
 *
 * @param requestConfig - 请求级配置
 * @param instanceConfig - 实例级配置 (可选)
 * @returns 最终的 withFullResponse 值
 *
 * @example
 * // 请求级优先
 * const result = resolveWithFullResponse(
 *   { withFullResponse: true },
 *   { withFullResponse: false }
 * );
 * // result = true (请求级优先)
 *
 * @example
 * // 使用实例级默认值
 * const result = resolveWithFullResponse(
 *   {},
 *   { withFullResponse: true }
 * );
 * // result = true (实例级)
 *
 * @example
 * // 使用默认值
 * const result = resolveWithFullResponse({}, undefined);
 * // result = false (默认值)
 */
export function resolveWithFullResponse(
  requestConfig: CustomRequestConfig,
  instanceConfig: CustomRequestConfig | undefined
): boolean {
  return requestConfig.withFullResponse !== undefined
    ? requestConfig.withFullResponse
    : (instanceConfig?.withFullResponse ?? false);
}

/**
 * 清理自定义配置字段，返回纯 Axios 配置
 *
 * 移除 Axios 不识别的自定义字段，防止传递给 Axios 时报错
 *
 * 自定义字段包括:
 * - withFullResponse: 本库的响应格式控制字段
 *
 * @param config - 包含自定义字段的配置
 * @returns 纯 Axios 配置
 *
 * @example
 * const config = {
 *   url: '/api/users',
 *   withFullResponse: true,  // 自定义字段
 *   timeout: 5000
 * };
 *
 * const axiosConfig = sanitizeAxiosConfig(config);
 * // axiosConfig = { url: '/api/users', timeout: 5000 }
 * // withFullResponse 已被移除
 */
export function sanitizeAxiosConfig(config: CustomRequestConfig): CustomRequestConfig {
  const { withFullResponse: _, ...axiosConfig } = config;
  return axiosConfig;
}

/**
 * Symbol 类型保护
 *
 * 用于验证实例名称是否为 Symbol 类型
 *
 * @param value - 待验证的值
 * @returns 是否为 Symbol 类型
 *
 * @example
 * const name = Symbol('myInstance');
 * if (isSymbol(name)) {
 *   // TypeScript 知道 name 是 symbol 类型
 *   console.log(name.description);
 * }
 */
export function isSymbol(value: unknown): value is symbol {
  return typeof value === 'symbol';
}

/**
 * 拦截器对象格式类型保护
 *
 * 检查是否为有效的拦截器对象格式: { onConfig, onError? }
 *
 * 对象格式特点:
 * - onConfig: 必需，处理成功情况
 * - onError: 可选，处理错误情况
 *
 * @param interceptor - 待验证的拦截器
 * @returns 是否为对象格式
 *
 * @example
 * const interceptor = {
 *   onConfig: (config) => config,
 *   onError: (error) => Promise.reject(error)
 * };
 *
 * if (isInterceptorObject(interceptor)) {
 *   // TypeScript 知道有 onConfig 和 onError 属性
 *   const { onConfig, onError } = interceptor;
 * }
 *
 * @example
 * // 数组格式不是对象格式
 * const tupleInterceptor = [(config) => config, (err) => Promise.reject(err)];
 * isInterceptorObject(tupleInterceptor);  // false
 */
export function isInterceptorObject(interceptor: unknown): interceptor is { onConfig: unknown; onError?: unknown } {
  return (
    !Array.isArray(interceptor) && typeof interceptor === 'object' && interceptor !== null && 'onConfig' in interceptor
  );
}

/**
 * 元组拦截器格式类型保护
 *
 * 检查是否为有效的元组拦截器格式: [onFulfilled, onRejected]
 *
 * 元组格式特点:
 * - 长度为 2
 * - 两个元素都是函数
 * - Axios 原生风格
 *
 * @param interceptors - 待验证的拦截器
 * @returns 是否为元组格式
 *
 * @example
 * const interceptor = [
 *   (config) => config,
 *   (error) => Promise.reject(error)
 * ];
 *
 * if (isTupleInterceptor(interceptor)) {
 *   // TypeScript 知道这是 [Function, Function]
 *   const [onFulfilled, onRejected] = interceptor;
 * }
 *
 * @example
 * // 对象格式不是元组格式
 * const objInterceptor = { onConfig: (config) => config };
 * isTupleInterceptor(objInterceptor);  // false
 */
export function isTupleInterceptor(
  interceptors: unknown
): interceptors is [(...args: unknown[]) => unknown, (...args: unknown[]) => unknown] {
  return (
    Array.isArray(interceptors) &&
    interceptors.length === 2 &&
    typeof interceptors[0] === 'function' &&
    typeof interceptors[1] === 'function'
  );
}

/**
 * 验证请求配置
 *
 * 开发时尽早失败 (Fail Fast)，在配置错误时立即抛出异常
 *
 * 验证项:
 * - baseURL: 字符串，支持相对路径或 http(s):// 绝对路径
 * - timeout: 非负有限数
 * - interceptors: 函数/对象{onConfig}/元组/数组
 * - presetOverrides: 对象类型
 *
 * @param config - 待验证的配置
 * @throws TypeError - 如果配置类型错误
 * @throws Error - 如果配置值无效
 *
 * @example
 * // 有效配置
 * validateRequestConfig({
 *   baseURL: '/api',
 *   timeout: 5000,
 *   interceptors: {
 *     request: (config) => config
 *   }
 * });
 *
 * @example
 * // 无效配置 - 抛出 TypeError
 * validateRequestConfig({
 *   baseURL: 123,  // 应该是字符串
 *   timeout: -100   // 应该是非负数
 * });
 * // 抛出: TypeError: baseURL must be a string, got number
 *
 * @example
 * // 无效 baseURL - 抛出 Error
 * validateRequestConfig({
 *   baseURL: 'ftp://example.com'  // 协议必须是 http 或 https
 * });
 * // 抛出: Error: Invalid baseURL: "ftp://example.com". Must start with http:// or https://
 */
export function validateRequestConfig(config: CustomRequestConfig): void {
  validateBaseURL(config.baseURL);
  validateTimeout(config.timeout);
  validateInterceptors(config.interceptors);
  validatePresetOverrides(config.presetOverrides);
}

/**
 * 验证 baseURL 配置
 *
 * 规则:
 * - 必须是字符串
 * - 支持相对路径 (如 '/api')
 * - 支持 http(s):// 绝对路径
 * - 不支持其他协议 (如 ftp://)
 *
 * @param baseURL - 待验证的 baseURL
 * @throws TypeError - 如果不是字符串
 * @throws Error - 如果协议无效
 */
function validateBaseURL(baseURL: unknown): void {
  if (baseURL === undefined) return;
  if (typeof baseURL !== 'string') {
    throw new TypeError(`baseURL must be a string, got ${typeof baseURL}`);
  }
  // 允许相对路径（如 '/api'），也允许 http/https 绝对路径；若包含方案但非 http/https，则认为非法
  if (typeof baseURL === 'string') {
    const s = baseURL.trim();
    if (s.includes('://') && !/^https?:\/\//.test(s)) {
      throw new Error(`Invalid baseURL: "${baseURL}". Must start with http:// or https://`);
    }
  }
}

/**
 * 验证 timeout 配置
 *
 * 规则:
 * - 必须是数字
 * - 必须是有限数 (不能是 Infinity 或 NaN)
 * - 必须非负 (>= 0)
 *
 * @param timeout - 待验证的 timeout
 * @throws TypeError - 如果不是数字
 * @throws Error - 如果值无效
 */
function validateTimeout(timeout: unknown): void {
  if (timeout === undefined) return;
  if (typeof timeout !== 'number') {
    throw new TypeError(`timeout must be a number, got ${typeof timeout}`);
  }
  if (!Number.isFinite(timeout) || timeout < 0) {
    throw new Error(`Invalid timeout: ${String(timeout)}. Must be a non-negative finite number`);
  }
}

/**
 * 验证拦截器配置
 *
 * 规则:
 * - request 和 response 可选
 * - 每个拦截器必须是: 函数/对象{onConfig}/数组
 *
 * @param itc - 待验证的拦截器配置
 * @throws TypeError - 如果拦截器类型无效
 */
function validateInterceptors(itc: CustomRequestConfig['interceptors']): void {
  if (!itc) return;
  const check = (value: unknown, type: 'request' | 'response') => validateInterceptorValue(value, type);
  if (itc.request !== undefined && itc.request !== null) check(itc.request, 'request');
  if (itc.response !== undefined && itc.response !== null) check(itc.response, 'response');
}

/**
 * 验证单个拦截器值
 *
 * 有效格式:
 * - 函数: (config) => config
 * - 对象: { onConfig, onError? }
 * - 数组: [onFulfilled, onRejected] 或 [拦截器1, 拦截器2, ...]
 *
 * @param value - 待验证的拦截器值
 * @param type - 拦截器类型 (request 或 response)
 * @throws TypeError - 如果格式无效
 */
function validateInterceptorValue(value: unknown, type: 'request' | 'response'): void {
  const ok = typeof value === 'function' || isInterceptorObject(value) || Array.isArray(value);
  if (!ok) {
    throw new TypeError(`Invalid ${type} interceptor type. Expected function, array, or object with onConfig`);
  }
}

/**
 * 验证预设覆盖配置
 *
 * 规则:
 * - 必须是对象
 * - 深入校验留给类型系统和运行期解析
 *
 * @param overrides - 待验证的预设覆盖配置
 * @throws TypeError - 如果不是对象
 */
function validatePresetOverrides(overrides: unknown): void {
  if (overrides === undefined) return;
  if (typeof overrides !== 'object' || overrides === null) {
    throw new TypeError('presetOverrides must be an object');
  }
  // 轻量形状校验（enabled/params/handlers），深入校验留给类型系统与运行期解析
}
