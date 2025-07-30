import type { CustomRequestConfig } from '../types';

/**
 * 解析 withFullResponse 配置的最终值
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
 */
export function sanitizeAxiosConfig(config: CustomRequestConfig): CustomRequestConfig {
  const { withFullResponse: _, ...axiosConfig } = config;
  return axiosConfig;
}

/**
 * 实例名称验证函数
 */
export function isSymbol(value: unknown): value is symbol {
  return typeof value === 'symbol';
}

/**
 * 检查是否为有效的拦截器对象格式
 */
export function isInterceptorObject(interceptor: unknown): interceptor is { onConfig: unknown; onError?: unknown } {
  return (
    !Array.isArray(interceptor) && typeof interceptor === 'object' && interceptor !== null && 'onConfig' in interceptor
  );
}

/**
 * 检查是否为元组拦截器格式
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
