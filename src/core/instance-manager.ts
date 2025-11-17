import axios, { type AxiosInstance } from 'axios';
import { DEFAULT_INSTANCE_NAME, ERROR_MESSAGES } from '../constant/messages';
import { createErrorContext } from '../error/context';
import { runErrorPipeline } from '../error/pipeline';
import { setupInstanceInterceptors } from '../interceptors/interceptor-manager';
import type {
  AnyRequestInterceptor,
  AnyResponseInterceptor,
  CustomRequestConfig,
  ErrorMiddleware,
  InstanceName,
  RequestInstance,
} from '../types';
import { mergeConfigs, mergePresetLayers } from '../utils/config-merger';
import { addHttpMethodShortcuts } from '../utils/http-shortcuts';
import { computePresetInterceptors } from '../utils/preset-merger';
import { getGlobalErrorPipeline } from './global-error';
import { getSharedPreset } from './shared-preset';

/**
 * 实例映射，用于存储定义的增强实例
 */
const instanceMap: Map<InstanceName, RequestInstance> = new Map();

/**
 * 实例配置映射，用于存储实例的原始配置（包含错误处理器等）
 */
const instanceConfigMap: Map<InstanceName, CustomRequestConfig> = new Map();

/**
 * 验证实例名称，检查是否已存在并处理异常情况
 */
function validateInstanceName(instanceName: InstanceName): boolean {
  if (instanceMap.has(instanceName)) {
    throw new Error(ERROR_MESSAGES.INSTANCE_ALREADY_EXISTS(String(instanceName)));
  }

  return false;
}

/**
 * 获取请求实例
 */
export function getRequestInstance(instanceName?: InstanceName): RequestInstance {
  const instance = instanceMap.get(instanceName ?? DEFAULT_INSTANCE_NAME);
  if (!instance) {
    const name = String(instanceName ?? DEFAULT_INSTANCE_NAME);
    throw new Error(ERROR_MESSAGES.INSTANCE_NOT_FOUND(name));
  }
  return instance;
}

/**
 * 设置请求实例
 */
export function setRequestInstance(instanceName: InstanceName, instance: RequestInstance): void {
  instanceMap.set(instanceName, instance);
}

/**
 * 检查实例是否存在
 */
export function hasInstance(instanceName?: InstanceName): boolean {
  return instanceMap.has(instanceName ?? DEFAULT_INSTANCE_NAME);
}

/**
 * 清除指定实例
 */
export function clearInstance(instanceName?: InstanceName): boolean {
  const name = instanceName ?? DEFAULT_INSTANCE_NAME;
  const deleted = instanceMap.delete(name);
  if (deleted) {
    // 同时清除该实例的配置
    clearInstanceConfigs(name);
  }
  return deleted;
}

/**
 * 清除所有实例
 */
export function clearAllInstances(): void {
  instanceMap.clear();
  clearInstanceConfigs();
}

/**
 * 创建增强的请求实例，支持便捷方法和 withFullResponse 逻辑
 */
function createEnhancedInstance(axiosInstance: AxiosInstance, instanceName: InstanceName): RequestInstance {
  const instanceConfig = getInstanceConfig(instanceName);

  const enhancedRequest = async <T = unknown>(config: CustomRequestConfig): Promise<T> => {
    const { mergedConfig, finalWithFullResponse } = mergeConfigs(instanceConfig, config);

    // 预设装配：若实例启用了共享预设，则根据共享预设与实例覆盖计算一次性拦截器
    const sharedPreset = getSharedPreset();
    // 实例级共享预设开关：默认启用（仅当显式设置为 false 时关闭）
    const isSharedPresetEnabledAtInstance = instanceConfig?.useSharedPreset !== false;
    const applied = !!config.presetOverrides || isSharedPresetEnabledAtInstance;
    const instancePresetOverrides = instanceConfig?.presetOverrides;
    const mergedStages = applied
      ? mergePresetLayers(config.presetOverrides, instancePresetOverrides, sharedPreset)
      : undefined;
    const effectivePreset = mergedStages
      ? ({
          context: mergedStages.context,
          onRequest: mergedStages.onRequest,
          onResponse: mergedStages.onResponse,
          onError: mergedStages.onError,
        } as const)
      : undefined;
    const presetInterceptors = applied
      ? computePresetInterceptors(
          config,
          instanceConfig,
          effectivePreset
            ? {
                onRequest: effectivePreset.onRequest,
                onResponse: effectivePreset.onResponse,
                onError: effectivePreset.onError,
              }
            : undefined
        )
      : { request: [], response: [] };

    // 合并用户配置与预设产生的拦截器（一次性注册）
    const mergedOneTime: CustomRequestConfig = {
      ...config,
      withFullResponse: finalWithFullResponse,
      interceptors: {
        request: (() => {
          const list: AnyRequestInterceptor[] = [];
          list.push(...presetInterceptors.request);
          const req = config.interceptors?.request;
          if (Array.isArray(req)) list.push(...(req as AnyRequestInterceptor[]));
          else if (req) list.push(req as AnyRequestInterceptor);
          return list;
        })(),
        response: (() => {
          const list: AnyResponseInterceptor[] = [];
          const res = config.interceptors?.response;
          if (Array.isArray(res)) list.push(...(res as AnyResponseInterceptor[]));
          else if (res) list.push(res as AnyResponseInterceptor);
          list.push(...presetInterceptors.response);
          return list;
        })(),
      },
    };

    // mergedStages 已在上方用于构建一次性拦截器，无需额外副作用调用

    // 添加一次性拦截器
    const { requestIds, responseIds } = setupInstanceInterceptors(axiosInstance, mergedOneTime, true);

    try {
      // 发送请求
      const response = await axiosInstance.request(mergedConfig);

      // 业务异常抛出：优先使用请求级 errorThrower，其次实例级
      const errorThrower = config.errorConfig?.errorThrower ?? instanceConfig?.errorConfig?.errorThrower;
      if (typeof errorThrower === 'function') {
        // 传入响应数据，允许用户在 200 场景识别并主动抛错
        // 若抛错，将在下方 catch 中进入实例级错误编排
        errorThrower(response.data as unknown);
      }

      // 根据最终的 withFullResponse 决定返回内容
      return finalWithFullResponse ? (response as unknown as T) : (response.data as T);
    } catch (error) {
      // 构造错误上下文并运行错误管线（请求 → 实例 → 共享）
      const ctx = createErrorContext(error, { ...config, instanceName }, instanceName);
      const instanceCfg = getInstanceConfig(instanceName);
      // 构建请求级错误管线（兼容旧 errorHandler）
      const requestLayer: ErrorMiddleware[] | undefined = (() => {
        const list: ErrorMiddleware[] = [];
        if (config.errorPipeline?.length) list.push(...config.errorPipeline);
        const legacyRequestHandler = config.errorConfig?.errorHandler as
          | ((error: unknown, options: { config: CustomRequestConfig }) => void)
          | undefined;
        if (legacyRequestHandler) {
          list.push((ctx) => {
            legacyRequestHandler(ctx.normalized, { config: ctx.config });
            // 兼容旧语义：不调用 next()，在当前层终止
          });
        }
        return list.length ? list : undefined;
      })();

      const instanceLayer: ErrorMiddleware[] | undefined = (() => {
        const list: ErrorMiddleware[] = [];
        if (instanceCfg?.errorPipeline?.length) list.push(...instanceCfg.errorPipeline);
        const legacyInstanceHandler = instanceCfg?.errorConfig?.errorHandler as
          | ((error: unknown, options: { config: CustomRequestConfig }) => void)
          | undefined;
        if (legacyInstanceHandler) {
          list.push((ctx) => {
            legacyInstanceHandler(ctx.normalized, { config: ctx.config });
            // 兼容旧语义：不调用 next()，在当前层终止
          });
        }
        return list.length ? list : undefined;
      })();

      const layers = {
        request: requestLayer,
        instance: instanceLayer,
        global: getGlobalErrorPipeline(),
      } as const;
      await runErrorPipeline(ctx, layers);
      // runErrorPipeline 最终会抛错，这里加入 throw 以满足类型系统
      throw ctx.normalized;
    } finally {
      // 移除一次性拦截器
      requestIds.forEach((id: number) => axiosInstance.interceptors.request.eject(id));
      responseIds.forEach((id: number) => axiosInstance.interceptors.response.eject(id));
    }
  };

  // 添加便捷方法
  return addHttpMethodShortcuts(enhancedRequest) as RequestInstance;
}

/**
 * 初始化并存储实例
 */
export function initializeInstance(instanceName: InstanceName, config: CustomRequestConfig): void {
  const axiosInstance = axios.create(config);

  // 添加默认响应拦截器（直接传递响应）
  axiosInstance.interceptors.response.use((response) => response);

  // 添加用户配置的拦截器
  setupInstanceInterceptors(axiosInstance, config);

  // 创建并存储增强实例
  const enhancedInstance = createEnhancedInstance(axiosInstance, instanceName);
  setRequestInstance(instanceName, enhancedInstance);
}

/**
 * 获取实例配置
 */
export function getInstanceConfig(instanceName: InstanceName): CustomRequestConfig | undefined {
  return instanceConfigMap.get(instanceName);
}

/**
 * 设置实例配置
 */
export function setInstanceConfig(instanceName: InstanceName, config: CustomRequestConfig): void {
  instanceConfigMap.set(instanceName, config);
}

/**
 * 清理实例配置（可清除指定实例或所有实例）
 */
export function clearInstanceConfigs(instanceName?: InstanceName): void {
  if (instanceName !== undefined) {
    instanceConfigMap.delete(instanceName);
  } else {
    instanceConfigMap.clear();
  }
}

/**
 * 注册多个实例，可以是单个配置对象或配置数组
 * NOTE: 当前设计遵循了：
 * - 关注点分离：配置定义与实例使用分离 (因为有可能实例已初始化，重复初始化会报错)
 * - 单一职责：defineRequestConfig 专注配置管理，不承担实例分发职责
 * - 依赖反转：用户依赖抽象的实例名称，而非具体实例
 */
export function defineRequestConfig(configs: CustomRequestConfig | CustomRequestConfig[]): void {
  // 转换为数组统一处理
  const configsArray = Array.isArray(configs) ? configs : [configs];

  configsArray.forEach((config) => {
    const instanceName = config.instanceName ?? DEFAULT_INSTANCE_NAME;

    // 检查实例是否已存在，并处理异常情况
    if (validateInstanceName(instanceName)) return;

    // 保存配置并初始化实例
    setInstanceConfig(instanceName, config);
    initializeInstance(instanceName, config);
  });
}
