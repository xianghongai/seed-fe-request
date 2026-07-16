import { DEFAULT_INSTANCE_NAME } from './constant/messages';
import { defineRequestConfig, getRequestInstance } from './core/instance-manager';
import type { CustomRequestConfig, HttpRequest } from './types';
import { addHttpMethodShortcuts } from './utils/http-shortcuts';

// 全局 request 方法
export async function request<T = unknown>(config: CustomRequestConfig): Promise<T> {
  const instanceName = config.instanceName ?? DEFAULT_INSTANCE_NAME;
  const instance = getRequestInstance(instanceName);

  // 直接使用增强实例调用；错误在实例层统一编排
  return instance<T>({ ...config, instanceName });
}

// 全局 request 便捷方法
const httpRequest = addHttpMethodShortcuts(request) as HttpRequest;

// 导出全局 request 便捷方法
export default httpRequest;
// 导出所有类型
export * from './types';
// 导出常量
export { DEFAULT_INSTANCE_NAME };
export type { GlobalErrorPipelineRegistration } from './core/global-error';
// 错误管道（共享级）API 导出
export { clearGlobalErrorPipeline, setGlobalErrorPipeline } from './core/global-error';
// 导出实例管理API
export { clearAllInstances, clearInstance, clearInstanceIfCurrent, hasInstance } from './core/instance-manager';
// 共享预设 API 导出（应用开关由 useSharedPreset/presetOverrides 决定）
export { clearSharedPreset, defineSharedPreset, getSharedPreset, updateSharedContext } from './core/shared-preset';
// ErrorContext helpers (strict TS friendly)
export { getResponseStatus, hasResponseStatus } from './error/context-utils';
export { readPresetContext } from './utils/preset-context';
// 导出工具函数
export { normalizeError } from './utils/request-error';
// 导出核心API
export { defineRequestConfig, getRequestInstance };
