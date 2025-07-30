import axios, { type AxiosInstance } from 'axios';
import { getInstanceConfig } from '../error/error-handler';
import { setupInstanceInterceptors } from '../interceptors/interceptor-manager';
import type { CustomRequestConfig, InstanceName, RequestInstance } from '../types';
import { mergeConfigs } from '../utils/config-merger';
import { addHttpMethodShortcuts } from '../utils/http-shortcuts';
import { setRequestInstance } from './instance-manager';

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
