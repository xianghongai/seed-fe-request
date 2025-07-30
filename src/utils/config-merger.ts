import type { CustomRequestConfig } from '../types';
import { resolveWithFullResponse, sanitizeAxiosConfig } from './validators';

/**
 * 合并请求配置，处理 withFullResponse 等特殊字段
 */
export function mergeConfigs(
  instanceConfig: CustomRequestConfig | undefined,
  requestConfig: CustomRequestConfig
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
