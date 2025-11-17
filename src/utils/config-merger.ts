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
import { resolveWithFullResponse, sanitizeAxiosConfig } from './validators';

function toArray<T>(x?: ReadonlyArray<T> | T): T[] {
  if (x === undefined) return [];
  if (Array.isArray(x)) return [...x] as T[];
  return [x as T];
}

/**
 * 合并请求配置，处理 withFullResponse 等特殊字段
 */
export function mergeConfigs(
  instanceConfig: CustomRequestConfig | undefined,
  requestConfig: CustomRequestConfig,
): {
  mergedConfig: CustomRequestConfig;
  finalWithFullResponse: boolean;
} {
  // 确定最终的 withFullResponse 值
  const finalWithFullResponse = resolveWithFullResponse(requestConfig, instanceConfig);

  // 移除 withFullResponse，因为 axios 不识别这个属性
  const axiosConfig = sanitizeAxiosConfig(requestConfig);

  // 创建合并后的配置
  const mergedConfig = {
    ...axiosConfig,
    withFullResponse: finalWithFullResponse,
  };

  return { mergedConfig, finalWithFullResponse };
}

/**
 * 合并共享预设的三层覆盖（占位实现）
 * 决策顺序：请求 > 实例 > 共享；采用浅选择策略（先出现者胜出）。
 * NOTE: 真实的 enabled/params/handlers 合并策略将在 US3 中完成。
 */
export function mergePresetLayers(
  request?: PresetOverrides,
  instance?: PresetOverrides,
  shared?: SharedPreset,
): {
  onRequest?: StageConfig<RequestStageHook>;
  onResponse?: StageConfig<ResponseStageHook>;
  onError?: StageConfig<ErrorStageHook>;
  context?: PresetContext;
} {
  const append = request?.appendHandlers ?? instance?.appendHandlers ?? false;

  function mergeStage<T>(r?: StageConfig<T>, i?: StageConfig<T>, s?: StageConfig<T>): StageConfig<T> | undefined {
    if (!r && !i && !s) return undefined;
    // enabled：高优先级覆盖低优先级
    const enabled = r?.enabled ?? i?.enabled ?? s?.enabled;
    // params：浅合并，shared → instance → request
    const params = { ...(s?.params ?? {}), ...(i?.params ?? {}), ...(r?.params ?? {}) } as PresetContext;
    // handlers：整组覆盖（默认）或追加（appendHandlers=true 时）
    let handlers: ReadonlyArray<T> | T | undefined;
    if (append) {
      const combined = [...toArray<T>(s?.handlers), ...toArray<T>(i?.handlers), ...toArray<T>(r?.handlers)];
      handlers = combined.length ? (combined as ReadonlyArray<T>) : undefined;
    } else {
      handlers = r?.handlers ?? i?.handlers ?? s?.handlers;
    }
    // 若未显式设置 enabled，则根据 handlers 是否存在推断
    const finalEnabled = enabled ?? handlers !== undefined;
    return { enabled: finalEnabled, params, handlers } as StageConfig<T>;
  }

  const onRequest = mergeStage<RequestStageHook>(request?.onRequest, instance?.onRequest, shared?.onRequest);
  const onResponse = mergeStage<ResponseStageHook>(request?.onResponse, instance?.onResponse, shared?.onResponse);
  const onError = mergeStage<ErrorStageHook>(request?.onError, instance?.onError, shared?.onError);

  // context：shared → instance → request 浅合并
  const context = {
    ...(shared?.context ?? {}),
    ...(instance?.context ?? {}),
    ...(request?.context ?? {}),
  } as PresetContext;

  return { onRequest, onResponse, onError, context };
}
