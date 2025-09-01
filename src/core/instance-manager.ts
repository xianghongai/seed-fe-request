import axios, { type AxiosInstance } from 'axios';
import { DEFAULT_INSTANCE_NAME, ERROR_MESSAGES } from '../constant/messages';
import { setupInstanceInterceptors } from '../interceptors/interceptor-manager';
import type { CustomRequestConfig, InstanceName, RequestInstance } from '../types';
import { mergeConfigs } from '../utils/config-merger';
import { addHttpMethodShortcuts } from '../utils/http-shortcuts';

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

    // 添加一次性拦截器
    const { requestIds, responseIds } = setupInstanceInterceptors(
      axiosInstance,
      { ...config, withFullResponse: finalWithFullResponse },
      true
    );

    try {
      // 发送请求
      const response = await axiosInstance.request(mergedConfig);

      // 根据最终的 withFullResponse 决定返回内容
      return finalWithFullResponse ? (response as unknown as T) : (response.data as T);
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
 * NOTE: 不能在声明周期内获取实例，因为有可能实例已初始化，重复初始化会报错
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
