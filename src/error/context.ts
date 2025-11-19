/**
 * 错误上下文创建模块
 *
 * 职责:
 * 1. 创建标准化的错误上下文对象
 * 2. 错误标准化处理 (确保为 Error 类型)
 * 3. 安全提取响应对象 (如 AxiosError.response)
 *
 * 核心特性:
 * - 类型安全: 始终返回 Error 类型的 normalized 字段
 * - 结构化检查: 使用结构化检查而非 any 类型
 * - 状态隔离: 每个上下文都有独立的 state 对象
 *
 * @example
 * try {
 *   await axiosInstance.request(config);
 * } catch (error) {
 *   const ctx = createErrorContext(error, config, 'userAPI');
 *   console.log(ctx.normalized.message);  // 始终是 Error 类型
 *   console.log(ctx.response);  // AxiosError 时包含响应对象
 * }
 */
import type { CustomRequestConfig, ErrorContext, InstanceName } from '../types';

/**
 * 创建错误上下文
 *
 * 工作流程:
 * 1. 标准化错误: 确保 normalized 字段始终是 Error 实例
 * 2. 提取响应: 安全提取 AxiosError 中的 response 字段
 * 3. 创建 state: 初始化空的状态对象供中间件使用
 *
 * 错误标准化:
 * - 如果已经是 Error: 直接使用
 * - 其他类型: 转换为字符串并创建 Error 实例
 *
 * 响应提取:
 * - 使用结构化检查 ('response' in error)
 * - 不依赖 any 类型，保持类型安全
 *
 * @param error - 原始错误对象 (可能是任意类型)
 * @param config - 触发错误的请求配置
 * @param instanceName - 实例名称 (可选)
 * @returns 标准化的错误上下文
 *
 * @example
 * // HTTP 错误 (AxiosError)
 * const ctx = createErrorContext(axiosError, config, 'api');
 * console.log(ctx.normalized.message);  // "Request failed with status code 404"
 * console.log(ctx.response?.status);    // 404
 *
 * @example
 * // 非 Error 类型
 * const ctx = createErrorContext('Network timeout', config);
 * console.log(ctx.normalized.message);  // "Network timeout"
 * console.log(ctx.response);            // undefined
 *
 * @example
 * // 中间件使用 state
 * const middleware: ErrorMiddleware = async (ctx, next) => {
 *   ctx.state.retryCount = (ctx.state.retryCount as number || 0) + 1;
 *   await next();
 * };
 */
export function createErrorContext(
  error: unknown,
  config: CustomRequestConfig,
  instanceName?: InstanceName
): ErrorContext {
  // 1. 错误标准化: 确保 normalized 始终是 Error 实例
  const normalized = error instanceof Error ? error : new Error(String(error));

  // 2. 响应提取: 尽力提取响应对象 (如 AxiosError.response)
  // 不依赖响应的具体结构，使用结构化检查避免 any
  let response: unknown;
  if (typeof error === 'object' && error !== null && 'response' in (error as Record<string, unknown>)) {
    response = (error as { response?: unknown }).response;
  }

  // 3. 返回标准化的错误上下文
  return {
    error, // 原始错误
    normalized, // 标准化的 Error 对象
    config, // 请求配置
    instanceName, // 实例名称
    response, // 响应对象 (如果有)
    state: Object.create(null), // 中间件共享状态 (纯对象，无原型链)
  };
}
