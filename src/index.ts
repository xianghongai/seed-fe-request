import { DEFAULT_INSTANCE_NAME } from './constant/messages';
import {
  clearAllInstances,
  clearInstance,
  defineRequestConfig,
  getRequestInstance,
  hasInstance,
} from './core/instance-manager';
import type { CustomRequestConfig, HttpRequest } from './types';
import { addHttpMethodShortcuts } from './utils/http-shortcuts';

// 错误管线（共享级）API 导出
export {
  clearGlobalErrorHandler,
  clearGlobalErrorPipeline,
  // legacy compatibility exports (alpha shim)
  setGlobalErrorHandler,
  setGlobalErrorPipeline,
} from './core/global-error';
// 导出所有类型
export * from './types';
// ErrorContext helpers (strict TS friendly)
export { getResponseStatus, hasResponseStatus } from './utils/error-context';

// 导出常量
export { DEFAULT_INSTANCE_NAME };

// 导出核心API
export { defineRequestConfig, getRequestInstance };

// 导出实例管理API
export { hasInstance, clearInstance, clearAllInstances };

// 导出工具函数
export { normalizeError } from './utils/request-error';

// 全局 request 便捷方法
export async function request<T = unknown>(config: CustomRequestConfig): Promise<T> {
  const instanceName = config.instanceName ?? DEFAULT_INSTANCE_NAME;
  const instance = getRequestInstance(instanceName);

  // 直接使用增强实例调用；错误在实例层统一编排
  return instance<T>({ ...config, instanceName });
}

// 全局 request 便捷方法
const httpRequest = addHttpMethodShortcuts(request) as HttpRequest;

export default httpRequest;
