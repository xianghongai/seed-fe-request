import { DEFAULT_INSTANCE_NAME, ERROR_MESSAGES } from '../constant/messages';
import { clearInstanceConfigs as clearErrorConfigs, setInstanceConfig } from '../error/error-handler';
import type { CustomRequestConfig, InstanceName, RequestInstance } from '../types';
import { initializeInstance } from './request-handler';

/**
 * 实例映射，用于存储定义的增强实例
 */
const instanceMap: Map<InstanceName, RequestInstance> = new Map();

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
 * 清理所有实例映射（仅用于测试）
 */
export function clearInstancesForTesting(): void {
  instanceMap.clear();
  clearErrorConfigs();
}

/**
 * 注册多个实例，可以是单个配置对象或配置数组
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
