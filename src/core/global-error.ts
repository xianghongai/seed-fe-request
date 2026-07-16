/**
 * 全局错误处理模块
 *
 * 职责:
 * 1. 管理全局错误中间件
 *
 * 特性:
 * - 内存级存储: 重新加载页面后丢失
 * - 最后设置生效: 多次调用会覆盖
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
import type { ErrorMiddleware } from '../types';

/**
 * 全局错误中间件数组
 *
 * 按顺序执行，支持 Koa 风格的 next()
 */
let globalErrorPipeline: ErrorMiddleware[] | undefined;
let globalErrorPipelineOwner: symbol | undefined;

/**
 * 一次全局错误管道注册的所有权句柄。
 * 句柄只能清理自己仍然拥有的当前注册，避免相邻应用互相删除策略。
 */
export interface GlobalErrorPipelineRegistration {
  isActive: () => boolean;
  dispose: () => boolean;
}

/** 仅当句柄仍拥有当前注册时清理，供 registration.dispose() 使用。 */
function clearOwnedGlobalErrorPipeline(ownerId: symbol): boolean {
  if (globalErrorPipelineOwner !== ownerId) {
    return false;
  }
  globalErrorPipeline = undefined;
  globalErrorPipelineOwner = undefined;
  return true;
}

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
export function setGlobalErrorPipeline(middlewares: ErrorMiddleware[]): GlobalErrorPipelineRegistration {
  const id = Symbol('seed-fe:request:global-error-pipeline');
  globalErrorPipeline = Array.isArray(middlewares) ? middlewares.slice() : [];
  globalErrorPipelineOwner = id;

  return Object.freeze({
    isActive: () => globalErrorPipelineOwner === id,
    dispose: () => clearOwnedGlobalErrorPipeline(id),
  });
}

/**
 * 清除全局错误中间件
 */
export function clearGlobalErrorPipeline(): void {
  globalErrorPipeline = undefined;
  globalErrorPipelineOwner = undefined;
}

/**
 * 获取全局错误管道
 *
 * @returns 中间件数组，如果未设置则返回 undefined
 */
export function getGlobalErrorPipeline(): ErrorMiddleware[] | undefined {
  return globalErrorPipeline?.length ? globalErrorPipeline : undefined;
}
