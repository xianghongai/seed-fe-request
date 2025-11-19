/**
 * 配置合并器模块
 *
 * 职责:
 * 1. 合并实例级和请求级配置
 * 2. 合并共享预设的三层覆盖 (请求级 > 实例级 > 共享级)
 * 3. 处理特殊字段 (如 withFullResponse)
 *
 * 核心特性:
 * - 优先级: 请求级 > 实例级 > 共享级
 * - 浅合并: params 和 context 使用浅合并
 * - 智能推断: enabled 可从 handlers 是否存在推断
 * - 追加模式: 支持 appendHandlers 追加处理器
 *
 * 合并策略:
 * ```
 * enabled:  请求级 ?? 实例级 ?? 共享级
 * params:   { ...共享, ...实例, ...请求 }  (浅合并)
 * handlers: 请求级 ?? 实例级 ?? 共享级  (整组覆盖)
 *           或 [...共享, ...实例, ...请求]  (追加模式)
 * context:  { ...共享, ...实例, ...请求 }  (浅合并)
 * ```
 *
 * @example
 * // 基础配置合并
 * const { mergedConfig, finalWithFullResponse } = mergeConfigs(
 *   instanceConfig,
 *   requestConfig
 * );
 *
 * @example
 * // 预设层级合并
 * const merged = mergePresetLayers(
 *   requestOverrides,
 *   instanceOverrides,
 *   sharedPreset
 * );
 */
import type {
  CustomRequestConfig,
  ErrorStageHook,
  PresetContext,
  PresetOverrides,
  RequestStageHook,
  ResponseStageHook,
  SharedPreset,
  StageConfig,
} from '../types';
import { toArray } from './array';
import { resolveWithFullResponse, sanitizeAxiosConfig } from './validators';

/**
 * 合并请求配置
 *
 * 处理 withFullResponse 等特殊字段，生成纯 Axios 配置
 *
 * 工作流程:
 * 1. 解析 withFullResponse 最终值 (请求级 > 实例级)
 * 2. 清理自定义字段 (移除 Axios 不识别的属性)
 * 3. 创建合并后的配置对象
 *
 * @param instanceConfig - 实例级配置 (可选)
 * @param requestConfig - 请求级配置
 * @returns 合并后的配置和 withFullResponse 值
 *
 * @example
 * const { mergedConfig, finalWithFullResponse } = mergeConfigs(
 *   { baseURL: '/api', withFullResponse: false },
 *   { url: '/users', withFullResponse: true }
 * );
 * // finalWithFullResponse = true (请求级优先)
 */
export function mergeConfigs(
  instanceConfig: CustomRequestConfig | undefined,
  requestConfig: CustomRequestConfig
): {
  mergedConfig: CustomRequestConfig;
  finalWithFullResponse: boolean;
} {
  // 1. 确定最终的 withFullResponse 值 (请求级 > 实例级 > false)
  const finalWithFullResponse = resolveWithFullResponse(requestConfig, instanceConfig);

  // 2. 移除 withFullResponse，因为 axios 不识别这个属性
  const axiosConfig = sanitizeAxiosConfig(requestConfig);

  // 3. 创建合并后的配置
  const mergedConfig = {
    ...axiosConfig,
    withFullResponse: finalWithFullResponse,
  };

  return { mergedConfig, finalWithFullResponse };
}

/**
 * 合并共享预设的三层覆盖
 *
 * 决策顺序: 请求级 > 实例级 > 共享级
 *
 * 合并规则:
 * - enabled: 高优先级覆盖低优先级
 * - params: 浅合并 (共享 → 实例 → 请求)
 * - handlers: 整组覆盖 (默认) 或追加 (appendHandlers=true)
 * - context: 浅合并 (共享 → 实例 → 请求)
 *
 * 追加模式 (appendHandlers=true):
 * - handlers: [...共享, ...实例, ...请求]
 * - 所有层级的处理器都会保留并按顺序执行
 *
 * 覆盖模式 (appendHandlers=false，默认):
 * - handlers: 请求级 ?? 实例级 ?? 共享级
 * - 只使用最高优先级的处理器
 *
 * @param request - 请求级预设覆盖 (可选)
 * @param instance - 实例级预设覆盖 (可选)
 * @param shared - 共享级预设 (可选)
 * @returns 合并后的预设配置
 *
 * @example
 * // 覆盖模式 (默认)
 * const merged = mergePresetLayers(
 *   { onRequest: { handlers: [reqHandler] } },  // 请求级
 *   { onRequest: { handlers: [insHandler] } },  // 实例级
 *   { onRequest: { handlers: [sharedHandler] } } // 共享级
 * );
 * // 结果: onRequest.handlers = [reqHandler]  (仅请求级)
 *
 * @example
 * // 追加模式
 * const merged = mergePresetLayers(
 *   { appendHandlers: true, onRequest: { handlers: [reqHandler] } },
 *   { onRequest: { handlers: [insHandler] } },
 *   { onRequest: { handlers: [sharedHandler] } }
 * );
 * // 结果: onRequest.handlers = [sharedHandler, insHandler, reqHandler]
 *
 * @example
 * // enabled 优先级
 * const merged = mergePresetLayers(
 *   { onError: { enabled: false } },  // 请求级禁用
 *   undefined,
 *   { onError: { enabled: true, handlers: [...] } }  // 共享级启用
 * );
 * // 结果: onError.enabled = false (请求级优先)
 */
export function mergePresetLayers(
  request?: PresetOverrides,
  instance?: PresetOverrides,
  shared?: SharedPreset
): {
  onRequest?: StageConfig<RequestStageHook>;
  onResponse?: StageConfig<ResponseStageHook>;
  onError?: StageConfig<ErrorStageHook>;
  context?: PresetContext;
} {
  // 确定是否使用追加模式
  const append = request?.appendHandlers ?? instance?.appendHandlers ?? false;

  /**
   * 合并单个阶段配置
   *
   * @param r - 请求级阶段配置
   * @param i - 实例级阶段配置
   * @param s - 共享级阶段配置
   * @returns 合并后的阶段配置
   */
  function mergeStage<T>(r?: StageConfig<T>, i?: StageConfig<T>, s?: StageConfig<T>): StageConfig<T> | undefined {
    // 如果三层都没有配置，返回 undefined
    if (!r && !i && !s) return undefined;

    // 1. enabled: 高优先级覆盖低优先级
    const enabled = r?.enabled ?? i?.enabled ?? s?.enabled;

    // 2. params: 浅合并 (共享 → 实例 → 请求)
    const params = { ...(s?.params ?? {}), ...(i?.params ?? {}), ...(r?.params ?? {}) } as PresetContext;

    // 3. handlers: 根据 appendHandlers 决定策略
    let handlers: ReadonlyArray<T> | T | undefined;
    if (append) {
      // 追加模式: 合并所有层级的处理器
      const combined = [...toArray<T>(s?.handlers), ...toArray<T>(i?.handlers), ...toArray<T>(r?.handlers)];
      handlers = combined.length ? (combined as ReadonlyArray<T>) : undefined;
    } else {
      // 覆盖模式: 使用最高优先级的处理器
      handlers = r?.handlers ?? i?.handlers ?? s?.handlers;
    }

    // 4. 智能推断 enabled: 如果未显式设置，根据 handlers 是否存在推断
    const finalEnabled = enabled ?? handlers !== undefined;

    return { enabled: finalEnabled, params, handlers } as StageConfig<T>;
  }

  // 合并三个阶段
  const onRequest = mergeStage<RequestStageHook>(request?.onRequest, instance?.onRequest, shared?.onRequest);
  const onResponse = mergeStage<ResponseStageHook>(request?.onResponse, instance?.onResponse, shared?.onResponse);
  const onError = mergeStage<ErrorStageHook>(request?.onError, instance?.onError, shared?.onError);

  // context: 浅合并 (共享 → 实例 → 请求)
  const context = {
    ...(shared?.context ?? {}),
    ...(instance?.context ?? {}),
    ...(request?.context ?? {}),
  } as PresetContext;

  return { onRequest, onResponse, onError, context };
}
