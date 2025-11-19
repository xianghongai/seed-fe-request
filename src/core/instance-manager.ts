/**
 * 实例管理器
 *
 * 职责:
 * 1. 管理多个 Axios 实例的生命周期
 * 2. 为每个实例创建增强的请求函数
 * 3. 执行混合拦截器策略:
 *    - 实例级: 永久注册到 Axios
 *    - 共享级 + 请求级: 手动链式执行
 * 4. 统一错误处理管道
 *
 * 核心设计:
 * - 实例映射: Map<InstanceName, RequestInstance>
 * - 配置映射: Map<InstanceName, CustomRequestConfig>
 * - 增强请求函数: 包装 Axios 请求，添加拦截器链和错误处理
 *
 * 执行流程:
 * ```
 * 请求发起
 *   ↓
 * 捕获共享上下文快照 (并发隔离)
 *   ↓
 * 合并配置 (实例 + 请求 + 共享预设)
 *   ↓
 * 请求拦截器链 (手动)
 *   ├─ 共享预设拦截器
 *   └─ 请求级拦截器
 *   ↓
 * Axios 发送请求 (自动执行实例级)
 *   ↓
 * 响应拦截器链 (手动)
 *   ├─ 请求级拦截器
 *   └─ 共享预设拦截器
 *   ↓
 * 返回数据 (data 或完整响应)
 *
 * 如果出错:
 *   ↓
 * 错误处理管道
 *   ├─ 请求级中间件
 *   ├─ 实例级中间件
 *   └─ 共享级中间件
 *   ↓
 * 抛出标准化错误
 * ```
 */
import axios, { type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { DEFAULT_INSTANCE_NAME, ERROR_MESSAGES } from '../constant/messages';
import { createErrorContext } from '../error/context';
import { runErrorPipeline } from '../error/pipeline';
import { InterceptorChain } from '../interceptors/chain';
import { setupInstanceInterceptors } from '../interceptors/interceptor-manager';
import { parseRequestInterceptor, parseResponseInterceptor } from '../interceptors/interceptor-parser';
import type { CustomRequestConfig, ErrorMiddleware, InstanceName, RequestInstance } from '../types';
import { mergeAllConfigs } from '../utils/config-merge-all';
import { addHttpMethodShortcuts } from '../utils/http-shortcuts';
import { attachPresetContext } from '../utils/preset-context';
import { validateRequestConfig } from '../utils/validators';
// preset 计算在 mergeAllConfigs 内部处理
import { getGlobalErrorPipeline } from './global-error';

/**
 * 实例映射表
 * 存储所有已注册的请求实例
 *
 * key: 实例名称 (string 或 symbol)
 * value: 增强的请求实例 (包含 get/post 等便捷方法)
 */
const instanceMap: Map<InstanceName, RequestInstance> = new Map();

/**
 * 实例配置映射表
 * 存储每个实例的原始配置
 *
 * 用途:
 * - 实例级拦截器
 * - 实例级错误处理
 * - 合并请求配置
 */
const instanceConfigMap: Map<InstanceName, CustomRequestConfig> = new Map();

/**
 * 验证实例名称
 *
 * 检查实例是否已存在，防止重复注册
 *
 * @param instanceName - 要验证的实例名称
 * @throws 如果实例已存在，抛出错误
 * @returns false (始终返回 false，用于逻辑判断)
 */
function validateInstanceName(instanceName: InstanceName): boolean {
  if (instanceMap.has(instanceName)) {
    throw new Error(ERROR_MESSAGES.INSTANCE_ALREADY_EXISTS(String(instanceName)));
  }

  return false;
}

/**
 * 获取请求实例
 *
 * @param instanceName - 实例名称，不传则使用默认实例
 * @returns 请求实例
 * @throws 如果实例不存在，抛出错误
 *
 * @example
 * const api = getRequestInstance('userAPI');
 * const users = await api.get('/users');
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
 *
 * @param instanceName - 实例名称
 * @param instance - 请求实例
 */
export function setRequestInstance(instanceName: InstanceName, instance: RequestInstance): void {
  instanceMap.set(instanceName, instance);
}

/**
 * 检查实例是否存在
 *
 * @param instanceName - 实例名称，不传则检查默认实例
 * @returns 是否存在
 *
 * @example
 * if (hasInstance('userAPI')) {
 *   console.log('实例存在');
 * }
 */
export function hasInstance(instanceName?: InstanceName): boolean {
  return instanceMap.has(instanceName ?? DEFAULT_INSTANCE_NAME);
}

/**
 * 清除指定实例
 *
 * @param instanceName - 实例名称，不传则清除默认实例
 * @returns 是否成功删除
 *
 * @example
 * clearInstance('userAPI');
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
 *
 * @example
 * clearAllInstances();
 */
export function clearAllInstances(): void {
  instanceMap.clear();
  clearInstanceConfigs();
}

/**
 * 创建增强的请求实例
 *
 * 核心逻辑:
 * 1. 捕获共享上下文快照 (并发隔离)
 * 2. 合并所有配置 (实例 + 请求 + 共享预设)
 * 3. 手动执行拦截器链:
 *    - 请求链: 共享预设 → 请求级
 *    - Axios 自动执行实例级拦截器
 *    - 响应链: 请求级 → 共享预设
 * 4. 错误处理管道: 请求级 → 实例级 → 共享级
 *
 * @param axiosInstance - 原生 Axios 实例
 * @param instanceName - 实例名称
 * @returns 增强的请求实例 (包含 get/post 等方法)
 */
function createEnhancedInstance(axiosInstance: AxiosInstance, instanceName: InstanceName): RequestInstance {
  const instanceConfig = getInstanceConfig(instanceName);

  /**
   * 增强的请求函数
   *
   * 这是核心的请求执行函数，包装了完整的请求流程
   *
   * @param config - 请求配置
   * @returns Promise<T> - 响应数据或完整响应
   */
  const enhancedRequest = async <T = unknown>(config: CustomRequestConfig): Promise<T> => {
    // 1. 合并所有配置 (实例 + 请求 + 共享预设)
    const merged = mergeAllConfigs(instanceConfig, config);
    const {
      axiosConfig, // 纯 Axios 配置
      withFullResponse: finalWithFullResponse, // 是否返回完整响应
      requestInterceptors, // 请求拦截器 (共享 + 请求级)
      responseInterceptors, // 响应拦截器 (请求级 + 共享)
      contextSnapshot, // 共享上下文快照
    } = merged;

    // 2. 将上下文快照附加到配置 (使用 Symbol，不污染配置)
    attachPresetContext(axiosConfig, contextSnapshot);

    try {
      // 3. 请求拦截器链 (手动执行)
      // 请求链在发送给 axios 前应产出 InternalAxiosRequestConfig
      const requestChain = new InterceptorChain<InternalAxiosRequestConfig, unknown>();
      for (const itc of requestInterceptors) {
        const [onFulfilled, onRejected] = parseRequestInterceptor(itc);
        requestChain.use(
          onFulfilled as (
            value: InternalAxiosRequestConfig
          ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>,
          onRejected as (error: unknown) => unknown
        );
      }

      // 执行请求链
      const finalRequestConfig = await requestChain.execute(axiosConfig as unknown as InternalAxiosRequestConfig);

      // 4. 发送请求 (Axios 自动执行实例级拦截器)
      const response = await axiosInstance.request(finalRequestConfig);

      // 5. 业务异常抛出 (errorThrower)
      // 用于处理 200 + success=false 这类协议
      const errorThrower = config.errorConfig?.errorThrower ?? instanceConfig?.errorConfig?.errorThrower;
      if (typeof errorThrower === 'function') {
        const respData = (response as unknown as { data: unknown }).data;
        errorThrower(respData);
      }

      // 6. 响应拦截器链 (手动执行)
      const responseChain = new InterceptorChain<AxiosResponse, unknown>();
      for (const itc of responseInterceptors) {
        const [onFulfilled, onRejected] = parseResponseInterceptor(itc);
        responseChain.use(
          onFulfilled as (value: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>,
          onRejected as (error: unknown) => unknown
        );
      }

      // 执行响应链
      const finalResponse = await responseChain.execute(response);

      // 7. 返回数据
      return finalWithFullResponse
        ? (finalResponse as unknown as T) // 完整响应
        : (finalResponse.data as T); // 仅数据
    } catch (error) {
      // 8. 错误处理管道

      // 8.1 创建错误上下文
      // 提醒：共享预设的 onError.enabled 与此无关；它只影响响应拦截器的 onRejected 注入。
      // 若需要跳过整条错误管道（包括实例/全局级），请在请求上设置 skipErrorPipeline: true。
      const ctx = createErrorContext(error, { ...config, instanceName }, instanceName);

      // 8.2 构建请求级错误管道 (兼容旧 errorHandler)
      const instanceCfg = getInstanceConfig(instanceName);
      const requestLayer: ErrorMiddleware[] | undefined = (() => {
        const list: ErrorMiddleware[] = [];

        // 新版: errorPipeline
        if (config.errorPipeline?.length) list.push(...config.errorPipeline);

        // 旧版兼容: errorConfig.errorHandler
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

      // 8.3 构建实例级错误管道
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

      // 8.4 运行错误管道
      const layers = {
        request: requestLayer,
        instance: instanceLayer,
        global: getGlobalErrorPipeline(),
      } as const;
      await runErrorPipeline(ctx, layers);

      // 8.5 抛出标准化错误
      throw ctx.normalized;
    } finally {
      // 无一次性拦截器可移除
    }
  };

  // 9. 添加 HTTP 方法便捷函数 (get/post/put/delete 等)
  return addHttpMethodShortcuts(enhancedRequest) as RequestInstance;
}

/**
 * 初始化并存储实例
 *
 * 步骤:
 * 1. 创建 Axios 实例
 * 2. 添加默认响应拦截器
 * 3. 注册用户配置的实例级拦截器 (永久注册)
 * 4. 创建增强实例
 * 5. 存储到实例映射表
 *
 * @param instanceName - 实例名称
 * @param config - 实例配置
 */
export function initializeInstance(instanceName: InstanceName, config: CustomRequestConfig): void {
  // 1. 创建 Axios 实例
  const axiosInstance = axios.create(config);

  // 2. 添加默认响应拦截器（直接传递响应）
  axiosInstance.interceptors.response.use((response) => response);

  // 3. 添加用户配置的实例级拦截器 (永久注册)
  setupInstanceInterceptors(axiosInstance, config);

  // 4. 创建增强实例
  const enhancedInstance = createEnhancedInstance(axiosInstance, instanceName);

  // 5. 存储到实例映射表
  setRequestInstance(instanceName, enhancedInstance);
}

/**
 * 获取实例配置
 *
 * @param instanceName - 实例名称
 * @returns 实例配置，如果不存在则返回 undefined
 */
export function getInstanceConfig(instanceName: InstanceName): CustomRequestConfig | undefined {
  return instanceConfigMap.get(instanceName);
}

/**
 * 设置实例配置
 *
 * @param instanceName - 实例名称
 * @param config - 实例配置
 */
export function setInstanceConfig(instanceName: InstanceName, config: CustomRequestConfig): void {
  instanceConfigMap.set(instanceName, config);
}

/**
 * 清理实例配置
 *
 * @param instanceName - 实例名称，不传则清除所有实例配置
 */
export function clearInstanceConfigs(instanceName?: InstanceName): void {
  if (instanceName !== undefined) {
    instanceConfigMap.delete(instanceName);
  } else {
    instanceConfigMap.clear();
  }
}

/**
 * 注册请求配置
 *
 * 这是用户配置实例的主入口函数
 *
 * 支持:
 * - 单个配置: defineRequestConfig({ baseURL: '...' })
 * - 多个配置: defineRequestConfig([config1, config2])
 *
 * 设计理念:
 * - 关注点分离: 配置定义与实例使用分离
 * - 单一职责: 专注配置管理，不承担实例分发职责
 * - 依赖反转: 用户依赖抽象的实例名称，而非具体实例
 *
 * @param configs - 单个配置或配置数组
 * @throws 如果实例名称重复，抛出错误
 *
 * @example
 * // 单个实例
 * defineRequestConfig({
 *   baseURL: 'https://api.example.com',
 *   timeout: 5000
 * });
 *
 * @example
 * // 多个实例
 * defineRequestConfig([
 *   { instanceName: 'api1', baseURL: 'https://api1.example.com' },
 *   { instanceName: 'api2', baseURL: 'https://api2.example.com' }
 * ]);
 */
export function defineRequestConfig(configs: CustomRequestConfig | CustomRequestConfig[]): void {
  // 统一转换为数组处理
  const configsArray = Array.isArray(configs) ? configs : [configs];

  configsArray.forEach((config) => {
    // 1. 开发期输入校验
    validateRequestConfig(config);

    // 2. 确定实例名称
    const instanceName = config.instanceName ?? DEFAULT_INSTANCE_NAME;

    // 3. 检查是否已存在
    if (validateInstanceName(instanceName)) return;

    // 4. 保存配置
    setInstanceConfig(instanceName, config);

    // 5. 初始化实例
    initializeInstance(instanceName, config);
  });
}
