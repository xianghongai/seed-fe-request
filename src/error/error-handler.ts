import { DEFAULT_INSTANCE_NAME } from '../constant/messages';
import { getGlobalErrorHandler } from '../core/global-error';
import { getInstanceConfig } from '../core/instance-manager';
import type { CustomRequestConfig, ErrorContext } from '../types';
import { resolveWithFullResponse } from '../utils/validators';

/**
 * 处理请求错误
 * 注意：此函数用于统一的错误处理流程，errorHandler 用于副作用处理（如日志、用户提示等）
 * 错误最终仍会抛出，让调用方决定如何处理
 */
export function handleRequestError(error: unknown, config: CustomRequestConfig): never {
  // 如果设置了跳过错误处理，则直接抛出错误
  if (config.skipErrorHandler) {
    throw error;
  }

  // 获取实例默认配置
  const instanceConfig = getInstanceConfig(config.instanceName ?? DEFAULT_INSTANCE_NAME);

  // 确定最终的 withFullResponse 值
  const finalWithFullResponse = resolveWithFullResponse(config, instanceConfig);

  // 合并请求配置和实例配置
  const mergedConfig = {
    ...config,
    withFullResponse: finalWithFullResponse,
  };

  // 优先使用请求级别的 errorHandler
  if (config.errorConfig?.errorHandler) {
    config.errorConfig.errorHandler(error, { config: mergedConfig });
  } else if (instanceConfig?.errorConfig?.errorHandler) {
    // 其次使用实例级别的 errorHandler
    instanceConfig.errorConfig.errorHandler(error, { config: mergedConfig });
  } else {
    // 最后尝试全局共享错误处理
    const globalHandler = getGlobalErrorHandler();
    if (typeof globalHandler === 'function') {
      const normalized = error instanceof Error ? error : new Error(String(error));
      const ctx: ErrorContext = {
        config: mergedConfig,
        instanceName: config.instanceName ?? DEFAULT_INSTANCE_NAME,
        cause: error,
        normalized,
      };
      // 全局处理函数仅用于副作用（记录/提示），不改变错误抛出行为
      void globalHandler(normalized, ctx);
    }
  }

  // 注意：errorHandler 是用于副作用处理（如日志记录、用户提示等）
  // 错误仍然需要抛出，让调用方能够捕获和处理
  throw error;
}
