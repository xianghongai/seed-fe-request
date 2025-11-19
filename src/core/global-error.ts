/**
 * 全局错误处理模块
 *
 * 职责:
 * 1. 管理全局错误中间件
 * 2. 兼容旧版 errorHandler
 *
 * 特性:
 * - 内存级存储: 重新加载页面后丢失
 * - 最后设置生效: 多次调用会覆盖
 * - 向后兼容: 支持旧版 errorHandler
 *
 * @example
 * // 设置全局错误中间件
 * async function logErrorMw(ctx, next) {
 *   console.error('Global error:', ctx.normalized.message);
 *   await next();
 * }
 * async function auth401Mw(ctx, next) {
 *   if (getResponseStatus(ctx) === 401) {
 *     redirectToLogin();
 *     return;
 *   }
 *   await next();
 * }
 * setGlobalErrorPipeline([logErrorMw, auth401Mw]);
 */
import type { CustomRequestConfig, ErrorMiddleware } from '../types';

/**
 * 全局错误中间件数组
 *
 * 按顺序执行，支持 Koa 风格的 next()
 */
let globalErrorPipeline: ErrorMiddleware[] | undefined;

/**
 * 旧版全局错误处理器 (兼容)
 *
 * @deprecated 将在 v2.0 移除，请使用 errorPipeline
 */
let legacyGlobalHandler: ((error: unknown, options: { config: CustomRequestConfig }) => void) | undefined;

/**
 * 设置全局错误中间件
 *
 * 注意:
 * - 会覆盖之前设置的中间件
 * - 数组会被复制，防止外部修改
 *
 * @param middlewares - 中间件数组
 *
 * @example
 * async function logMw(ctx, next) {
 *   console.error('Error:', {
 *     url: ctx.config.url,
 *     status: getResponseStatus(ctx),
 *     message: ctx.normalized.message
 *   });
 *   await next();
 * }
 * async function redirect401Mw(ctx, next) {
 *   if (getResponseStatus(ctx) === 401) {
 *     window.location.href = '/login';
 *     return;
 *   }
 *   await next();
 * }
 * setGlobalErrorPipeline([logMw, redirect401Mw]);
 */
export function setGlobalErrorPipeline(middlewares: ErrorMiddleware[]): void {
  globalErrorPipeline = Array.isArray(middlewares) ? middlewares.slice() : [];
}

/**
 * 清除全局错误中间件
 */
export function clearGlobalErrorPipeline(): void {
  globalErrorPipeline = undefined;
}

/**
 * 获取全局错误管道
 *
 * 优先返回新版 errorPipeline，否则返回兼容的旧版 handler
 *
 * @returns 中间件数组，如果都未设置则返回 undefined
 */
export function getGlobalErrorPipeline(): ErrorMiddleware[] | undefined {
  // 新版
  if (globalErrorPipeline?.length) return globalErrorPipeline;

  // 旧版兼容
  if (legacyGlobalHandler) {
    return [
      (ctx) => {
        legacyGlobalHandler?.(ctx.normalized, { config: ctx.config });
        // 旧版语义: 不调用 next()
      },
    ];
  }

  return undefined;
}

/**
 * 设置全局错误处理器 (旧版兼容)
 *
 * @deprecated 将在 v2.0 移除，请使用 setGlobalErrorPipeline
 * @param handler - 错误处理函数
 *
 * @example
 * setGlobalErrorHandler((error, { config }) => {
 *   console.error('Error:', error);
 * });
 */
export function setGlobalErrorHandler(
  handler: (error: unknown, options: { config: CustomRequestConfig }) => void
): void {
  legacyGlobalHandler = handler;
}

/**
 * 清除全局错误处理器 (旧版兼容)
 *
 * @deprecated 将在 v2.0 移除
 */
export function clearGlobalErrorHandler(): void {
  legacyGlobalHandler = undefined;
}
