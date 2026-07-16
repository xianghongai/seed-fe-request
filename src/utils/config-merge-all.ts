/**
 * 配置合并模块
 *
 * 职责:
 * 1. 合并多层配置 (实例级 + 请求级 + 共享预设)
 * 2. 计算最终的拦截器链 (共享 + 请求级)
 * 3. 捕获共享上下文快照 (并发隔离)
 *
 * 核心特性:
 * - 优先级: 请求级 > 实例级 > 共享级
 * - 缓存优化: 共享预设拦截器缓存 (无请求级覆盖时)
 * - 快照机制: 每次请求捕获当时的上下文
 * - 扁平化: 返回统一的配置结构供调用方使用
 *
 * 配置合并优先级:
 * ```
 * 请求级配置 (最高优先级)
 *   ↓ 覆盖
 * 实例级配置
 *   ↓ 覆盖
 * 共享预设配置 (最低优先级)
 * ```
 *
 * 拦截器执行顺序:
 * ```
 * 请求拦截器: 共享预设 → 请求级
 * 响应拦截器: 请求级 → 共享预设
 * ```
 *
 * @example
 * const merged = mergeAllConfigs(instanceConfig, requestConfig);
 * const {
 *   axiosConfig,           // 纯 Axios 配置
 *   requestInterceptors,   // 请求拦截器 (共享 + 请求级)
 *   responseInterceptors,  // 响应拦截器 (请求级 + 共享)
 *   withFullResponse,      // 是否返回完整响应
 *   contextSnapshot,       // 上下文快照
 * } = merged;
 */
import type { AxiosRequestConfig } from 'axios';
import { DEFAULT_INSTANCE_NAME } from '../constant/messages';
import { getSharedContextVersion, getSharedPreset } from '../core/shared-preset';
import { toInterceptorArray } from '../interceptors/utils';
import type { AnyRequestInterceptor, AnyResponseInterceptor, CustomRequestConfig } from '../types';
import { mergeConfigs, mergePresetLayers } from './config-merger';
import { computePresetInterceptors } from './preset-merger';

/**
 * 合并后的配置接口
 *
 * 包含所有请求执行所需的信息
 */
export interface MergedAllConfigs {
  axiosConfig: AxiosRequestConfig; // 纯 Axios 配置
  requestInterceptors: AnyRequestInterceptor[]; // 请求拦截器 (共享 + 请求级)
  responseInterceptors: AnyResponseInterceptor[]; // 响应拦截器 (请求级 + 共享)
  withFullResponse: boolean; // 是否返回完整响应
  contextSnapshot: Readonly<Record<string, unknown>>; // 上下文快照
}

/**
 * 共享预设拦截器缓存
 *
 * 缓存结构:
 * - version: 上下文版本号 (用于失效判断)
 * - request: 缓存的请求拦截器数组
 * - response: 缓存的响应拦截器数组
 *
 * 缓存策略:
 * - 键: InstanceName 本身，保留 Symbol 的身份语义
 * - 失效: 上下文版本变化时
 * - 启用条件: 无请求级 presetOverrides
 */
type CachedPreset = { version: number; request: AnyRequestInterceptor[]; response: AnyResponseInterceptor[] };
const presetCache = new Map<string | symbol, CachedPreset>();

/**
 * 清理指定实例或全部实例的共享预设缓存。
 * 每个实例只保留当前版本，避免上下文更新造成历史版本持续累积。
 */
export function clearPresetCache(instanceName?: string | symbol): void {
  if (instanceName === undefined) {
    presetCache.clear();
    return;
  }
  presetCache.delete(instanceName);
}

/**
 * 合并所有配置
 *
 * 单一合并入口，统一处理所有配置层级的合并
 *
 * 工作流程:
 * 1. 合并基础配置 (实例 + 请求)
 * 2. 捕获共享上下文快照 (并发隔离)
 * 3. 合并共享预设配置 (请求级 > 实例级 > 共享级)
 * 4. 计算拦截器链 (使用缓存优化)
 * 5. 组合请求/响应拦截器
 *
 * 缓存优化:
 * - 无请求级覆盖时: 使用缓存的共享预设拦截器
 * - 版本不匹配时: 重新计算并更新缓存
 * - 有请求级覆盖时: 不使用缓存，每次重新计算
 *
 * @param instanceConfig - 实例级配置 (可选)
 * @param requestConfig - 请求级配置
 * @returns 合并后的完整配置
 *
 * @example
 * // 基础合并
 * const merged = mergeAllConfigs(instanceConfig, requestConfig);
 * console.log(merged.axiosConfig);  // 纯 Axios 配置
 * console.log(merged.requestInterceptors);  // [共享, 请求级]
 * console.log(merged.responseInterceptors); // [请求级, 共享]
 *
 * @example
 * // 带缓存优化
 * // 第一次请求: 计算并缓存
 * const merged1 = mergeAllConfigs(instanceConfig, { url: '/api/users' });
 *
 * // 第二次请求: 使用缓存 (无 presetOverrides)
 * const merged2 = mergeAllConfigs(instanceConfig, { url: '/api/posts' });
 *
 * // 第三次请求: 不使用缓存 (有 presetOverrides)
 * const merged3 = mergeAllConfigs(instanceConfig, {
 *   url: '/api/admin',
 *   presetOverrides: { onError: { enabled: false } }
 * });
 */
export function mergeAllConfigs(
  instanceConfig: CustomRequestConfig | undefined,
  requestConfig: CustomRequestConfig
): MergedAllConfigs {
  // 1. 合并基础配置 (实例 + 请求)
  const { mergedConfig, finalWithFullResponse } = mergeConfigs(instanceConfig, requestConfig);

  // 2. 读取共享预设；最终快照在完成三层合并后创建。
  const shared = getSharedPreset();

  // 3. 判断是否启用共享预设
  const isSharedPresetEnabledAtInstance = instanceConfig?.useSharedPreset !== false;
  const applied = !!requestConfig.presetOverrides || isSharedPresetEnabledAtInstance;
  const instancePresetOverrides = instanceConfig?.presetOverrides;

  // 4. 合并共享预设配置 (请求级 > 实例级 > 共享级)
  const mergedStages = applied
    ? mergePresetLayers(requestConfig.presetOverrides, instancePresetOverrides, shared)
    : undefined;

  const effectivePreset = mergedStages
    ? { onRequest: mergedStages.onRequest, onResponse: mergedStages.onResponse, onError: mergedStages.onError }
    : undefined;
  const contextSnapshot = Object.freeze({ ...(mergedStages?.context ?? {}) });

  // 5. 计算拦截器 (使用缓存优化)
  let presetInterceptors: { request: AnyRequestInterceptor[]; response: AnyResponseInterceptor[] } = {
    request: [],
    response: [],
  };

  if (applied) {
    const instanceName = requestConfig.instanceName ?? instanceConfig?.instanceName ?? DEFAULT_INSTANCE_NAME;
    const ver = getSharedContextVersion();
    const canUseCache = !requestConfig.presetOverrides; // 无请求级覆盖时可用缓存
    const cached = canUseCache ? presetCache.get(instanceName) : undefined;

    if (cached && cached.version === ver) {
      // 缓存命中: 直接使用
      presetInterceptors = { request: cached.request, response: cached.response };
    } else {
      // 缓存未命中: 重新计算
      const computed = computePresetInterceptors(requestConfig, instanceConfig, effectivePreset);
      presetInterceptors = computed;

      // 更新缓存 (仅在无请求级覆盖时)
      if (canUseCache) {
        presetCache.set(instanceName, { version: ver, request: computed.request, response: computed.response });
      }
    }
  }

  // 6. 组合请求拦截器 (共享预设 → 请求级)
  const requestInterceptors: AnyRequestInterceptor[] = [];
  if (presetInterceptors.request.length) requestInterceptors.push(...presetInterceptors.request);
  if (requestConfig.interceptors?.request) {
    requestInterceptors.push(...toInterceptorArray<AnyRequestInterceptor>(requestConfig.interceptors.request));
  }

  // 7. 组合响应拦截器 (请求级 → 共享预设)
  const responseInterceptors: AnyResponseInterceptor[] = [];
  if (requestConfig.interceptors?.response) {
    responseInterceptors.push(...toInterceptorArray<AnyResponseInterceptor>(requestConfig.interceptors.response));
  }
  if (presetInterceptors.response.length) responseInterceptors.push(...presetInterceptors.response);

  // 8. 返回合并后的配置；错误管道由执行层按请求、实例、全局分层编排。
  return {
    axiosConfig: mergedConfig,
    requestInterceptors,
    responseInterceptors,
    withFullResponse: finalWithFullResponse,
    contextSnapshot,
  };
}
