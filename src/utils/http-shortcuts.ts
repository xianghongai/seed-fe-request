/**
 * HTTP 方法快捷方式模块
 *
 * 职责:
 * 为基础请求函数添加 HTTP 方法快捷方式 (get/post/put/delete 等)
 *
 * 设计理念:
 * - 便捷性: 提供符合直觉的 API (如 httpRequest.get('/users'))
 * - 灵活性: 支持传入额外的配置参数
 * - 类型安全: 完整的 TypeScript 类型支持
 *
 * @example
 * // 基础请求函数
 * const request = async (config) => { ... };
 *
 * // 添加快捷方式
 * const enhanced = addHttpMethodShortcuts(request);
 *
 * // 使用快捷方式
 * const users = await enhanced.get('/users');
 * const newUser = await enhanced.post('/users', { name: 'John' });
 */
import type { CustomRequestConfig, HttpRequest } from '../types';

/**
 * 为基础请求函数添加 HTTP 方法快捷方式
 *
 * 支持的方法:
 * - GET: 获取资源
 * - POST: 创建资源
 * - PUT: 更新资源 (完整)
 * - DELETE: 删除资源
 * - PATCH: 更新资源 (部分)
 * - HEAD: 获取资源元数据
 * - OPTIONS: 获取支持的方法
 *
 * @param baseRequest - 基础请求函数
 * @returns 增强后的请求函数 (包含所有 HTTP 方法快捷方式)
 *
 * @example
 * // 基础用法
 * const enhanced = addHttpMethodShortcuts(baseRequest);
 *
 * // GET 请求
 * const users = await enhanced.get<User[]>('/api/users');
 *
 * // POST 请求
 * const newUser = await enhanced.post<User>('/api/users', {
 *   name: 'John',
 *   email: 'john@example.com'
 * });
 *
 * // PUT 请求
 * const updated = await enhanced.put<User>('/api/users/1', {
 *   name: 'John Doe',
 *   email: 'john.doe@example.com'
 * });
 *
 * // DELETE 请求
 * await enhanced.delete('/api/users/1');
 *
 * // PATCH 请求
 * const patched = await enhanced.patch<User>('/api/users/1', {
 *   email: 'newemail@example.com'
 * });
 *
 * // 带额外配置
 * const users = await enhanced.get<User[]>('/api/users', {
 *   params: { page: 1, limit: 10 },
 *   headers: { 'X-Custom': 'value' }
 * });
 */
export function addHttpMethodShortcuts<T extends (config: CustomRequestConfig) => Promise<unknown>>(
  baseRequest: T
): T & Omit<HttpRequest, 'default'> {
  const enhanced = baseRequest as T & Omit<HttpRequest, 'default'>;

  /**
   * GET 方法: 获取资源
   *
   * @param url - 请求 URL
   * @param config - 额外的请求配置 (可选)
   * @returns Promise<T> - 响应数据
   */
  enhanced.get = <T = unknown>(url: string, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'GET', url }) as Promise<T>;

  /**
   * POST 方法: 创建资源
   *
   * @param url - 请求 URL
   * @param data - 请求数据 (可选)
   * @param config - 额外的请求配置 (可选)
   * @returns Promise<T> - 响应数据
   */
  enhanced.post = <T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'POST', url, data }) as Promise<T>;

  /**
   * PUT 方法: 完整更新资源
   *
   * @param url - 请求 URL
   * @param data - 请求数据 (可选)
   * @param config - 额外的请求配置 (可选)
   * @returns Promise<T> - 响应数据
   */
  enhanced.put = <T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'PUT', url, data }) as Promise<T>;

  /**
   * DELETE 方法: 删除资源
   *
   * @param url - 请求 URL
   * @param config - 额外的请求配置 (可选)
   * @returns Promise<T> - 响应数据
   */
  enhanced.delete = <T = unknown>(url: string, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'DELETE', url }) as Promise<T>;

  /**
   * PATCH 方法: 部分更新资源
   *
   * @param url - 请求 URL
   * @param data - 请求数据 (可选)
   * @param config - 额外的请求配置 (可选)
   * @returns Promise<T> - 响应数据
   */
  enhanced.patch = <T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'PATCH', url, data }) as Promise<T>;

  /**
   * HEAD 方法: 获取资源元数据 (仅响应头)
   *
   * @param url - 请求 URL
   * @param config - 额外的请求配置 (可选)
   * @returns Promise<T> - 响应数据
   */
  enhanced.head = <T = unknown>(url: string, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'HEAD', url }) as Promise<T>;

  /**
   * OPTIONS 方法: 获取支持的 HTTP 方法
   *
   * @param url - 请求 URL
   * @param config - 额外的请求配置 (可选)
   * @returns Promise<T> - 响应数据
   */
  enhanced.options = <T = unknown>(url: string, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'OPTIONS', url }) as Promise<T>;

  return enhanced;
}
