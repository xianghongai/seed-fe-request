/**
 * 错误处理器模块 (已废弃)
 *
 * 职责:
 * 统一的错误处理流程，支持多级错误处理器
 *
 * 注意:
 * - 此模块已被新的错误管道 (error pipeline) 取代
 * - 仅保留用于向后兼容旧的 errorHandler 配置
 * - 新代码请使用 errorPipeline 替代
 *
 * 核心特性:
 * - 多级处理: 请求级 > 实例级 > 全局级
 * - 副作用处理: 用于日志、提示等，不改变错误抛出
 * - 跳过机制: 支持通过 skipErrorHandler 跳过处理
 *
 * 处理优先级:
 * ```
 * 1. config.errorConfig.errorHandler       (请求级)
 * 2. instanceConfig.errorConfig.errorHandler (实例级)
 * 3. getGlobalErrorHandler()               (全局级)
 * ```
 *
 * 迁移指南:
 * ```typescript
 * // 旧方式 (errorHandler)
 * httpRequest({
 *   url: '/api/users',
 *   errorConfig: {
 *     errorHandler: (error, ctx) => {
 *       console.error('Error:', error);
 *     }
 *   }
 * });
 *
 * // 新方式 (errorPipeline)
 * httpRequest({
 *   url: '/api/users',
 *   errorPipeline: [
 *     async (ctx, next) => {
 *       console.error('Error:', ctx.normalized);
 *       return next();
 *     }
 *   ]
 * });
 * ```
 *
 * @deprecated 请使用 errorPipeline 替代
 */
import { DEFAULT_INSTANCE_NAME } from '../constant/messages';
import { getGlobalErrorHandler } from '../core/global-error';
import { getInstanceConfig } from '../core/instance-manager';
import type { CustomRequestConfig, ErrorContext } from '../types';
import { resolveWithFullResponse } from '../utils/validators';

/**
 * 处理请求错误 (已废弃)
 *
 * 执行错误处理器链，用于副作用处理 (日志、提示等)
 *
 * 重要说明:
 * - 错误处理器仅用于副作用，不影响错误抛出
 * - 无论是否执行处理器，错误最终都会抛出
 * - 调用方仍需要通过 try/catch 捕获错误
 *
 * 工作流程:
 * 1. 检查是否跳过错误处理 (skipErrorHandler)
 * 2. 获取实例配置并合并
 * 3. 按优先级执行错误处理器: 请求级 > 实例级 > 全局级
 * 4. 抛出原始错误
 *
 * @param error - 错误对象
 * @param config - 请求配置
 * @throws 始终抛出原始错误
 *
 * @deprecated 请使用 errorPipeline 替代
 *
 * @example
 * // 使用请求级错误处理器
 * try {
 *   await httpRequest({
 *     url: '/api/users',
 *     errorConfig: {
 *       errorHandler: (error, ctx) => {
 *         // 副作用: 记录日志
 *         console.error('Request failed:', error);
 *         // 副作用: 显示提示
 *         showErrorToast(error.message);
 *       }
 *     }
 *   });
 * } catch (error) {
 *   // 错误仍然会被抛出，需要在这里处理
 *   console.error('Caught error:', error);
 * }
 *
 * @example
 * // 跳过错误处理
 * try {
 *   await httpRequest({
 *     url: '/api/users',
 *     skipErrorHandler: true  // 跳过所有错误处理器
 *   });
 * } catch (error) {
 *   // 直接捕获原始错误，未执行任何处理器
 * }
 *
 * @example
 * // 实例级错误处理器
 * // 通过 defineRequestConfig 注册实例配置，然后使用 getRequestInstance 获取实例
 * defineRequestConfig({
 *   instanceName: 'api',
 *   baseURL: '/api',
 *   errorConfig: {
 *     errorHandler: (error, ctx) => {
 *       // 所有请求的默认错误处理
 *       logError(error, ctx.config);
 *     }
 *   }
 * });
 * const api = getRequestInstance('api');
 * await api({ url: '/users' });
 *
 * @example
 * // 全局错误处理器
 * setGlobalErrorHandler((error, ctx) => {
 *   // 全局副作用处理
 *   if (ctx.response?.status === 401) {
 *     redirectToLogin();
 *   }
 * });
 *
 * @example
 * // 迁移到新的 errorPipeline
 * // 旧方式
 * const oldConfig = {
 *   errorConfig: {
 *     errorHandler: (error, ctx) => {
 *       console.error('Error:', error);
 *     }
 *   }
 * };
 *
 * // 新方式 (推荐)
 * const newConfig = {
 *   errorPipeline: [
 *     async (ctx, next) => {
 *       console.error('Error:', ctx.normalized);
 *       return next();  // 继续执行后续中间件
 *     }
 *   ]
 * };
 */
export function handleRequestError(error: unknown, config: CustomRequestConfig): never {
  // 1. 如果设置了跳过错误处理，则直接抛出错误
  if (config.skipErrorHandler) {
    throw error;
  }

  // 2. 获取实例默认配置
  const instanceConfig = getInstanceConfig(config.instanceName ?? DEFAULT_INSTANCE_NAME);

  // 3. 确定最终的 withFullResponse 值
  const finalWithFullResponse = resolveWithFullResponse(config, instanceConfig);

  // 4. 合并请求配置和实例配置
  const mergedConfig = {
    ...config,
    withFullResponse: finalWithFullResponse,
  };

  // 5. 按优先级执行错误处理器
  // 优先级: 请求级 > 实例级 > 全局级
  if (config.errorConfig?.errorHandler) {
    // 请求级错误处理器
    config.errorConfig.errorHandler(error, { config: mergedConfig });
  } else if (instanceConfig?.errorConfig?.errorHandler) {
    // 实例级错误处理器
    instanceConfig.errorConfig.errorHandler(error, { config: mergedConfig });
  } else {
    // 全局级错误处理器
    const globalHandler = getGlobalErrorHandler();
    if (typeof globalHandler === 'function') {
      // 标准化错误
      const normalized = error instanceof Error ? error : new Error(String(error));
      // 创建错误上下文
      const ctx: ErrorContext = {
        error,
        normalized,
        config: mergedConfig,
        instanceName: config.instanceName ?? DEFAULT_INSTANCE_NAME,
        response: undefined,
        state: Object.create(null),
      };
      // 执行全局处理函数 (仅副作用，不改变错误抛出)
      void globalHandler(normalized, ctx);
    }
  }

  // 6. 错误处理器仅用于副作用 (日志、提示等)
  // 错误仍然需要抛出，让调用方能够捕获和处理
  throw error;
}
