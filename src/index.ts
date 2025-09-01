import { DEFAULT_INSTANCE_NAME } from './constant/messages';
import {
  clearAllInstances,
  clearInstance,
  clearInstancesForTesting,
  defineRequestConfig,
  getRequestInstance,
  hasInstance,
} from './core/instance-manager';
import { handleRequestError } from './error/error-handler';
import type { CustomRequestConfig, HttpRequest } from './types';
import { addHttpMethodShortcuts } from './utils/http-shortcuts';

// 导出所有类型
export * from './types';

// 导出常量
export { DEFAULT_INSTANCE_NAME };

// 导出核心API
export { defineRequestConfig, getRequestInstance };

// 导出实例管理API
export { hasInstance, clearInstance, clearAllInstances };

// 导出工具函数
export { normalizeError } from './utils/request-error';

// 导出测试工具（仅用于测试）
export { clearInstancesForTesting as __clearInstancesForTesting__ };

// 全局 request 便捷方法
export async function request<T = unknown>(config: CustomRequestConfig): Promise<T> {
  try {
    const instanceName = config.instanceName ?? DEFAULT_INSTANCE_NAME;
    const instance = getRequestInstance(instanceName);

    // 直接使用增强实例调用
    return await instance<T>(config);
  } catch (error) {
    return handleRequestError(error, config);
  }
}

// 全局 request 便捷方法
const httpRequest = addHttpMethodShortcuts(request) as HttpRequest;

export default httpRequest;
