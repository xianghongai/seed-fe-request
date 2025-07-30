import type { CustomRequestConfig, HttpRequest } from '../types';

/**
 * 为基础请求函数添加 HTTP 方法快捷方式
 */
export function addHttpMethodShortcuts<T extends (config: CustomRequestConfig) => Promise<unknown>>(
  baseRequest: T
): T & Omit<HttpRequest, 'default'> {
  const enhanced = baseRequest as T & Omit<HttpRequest, 'default'>;

  enhanced.get = <T = unknown>(url: string, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'GET', url }) as Promise<T>;

  enhanced.post = <T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'POST', url, data }) as Promise<T>;

  enhanced.put = <T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'PUT', url, data }) as Promise<T>;

  enhanced.delete = <T = unknown>(url: string, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'DELETE', url }) as Promise<T>;

  enhanced.patch = <T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'PATCH', url, data }) as Promise<T>;

  enhanced.head = <T = unknown>(url: string, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'HEAD', url }) as Promise<T>;

  enhanced.options = <T = unknown>(url: string, config?: CustomRequestConfig): Promise<T> =>
    baseRequest({ ...config, method: 'OPTIONS', url }) as Promise<T>;

  return enhanced;
}
