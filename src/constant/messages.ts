/**
 * 错误消息常量
 */
export const ERROR_MESSAGES = {
  INVALID_REQUEST_INTERCEPTOR: '[@seed-fe/request] Invalid request interceptor: onConfig is required',
  INVALID_RESPONSE_INTERCEPTOR: '[@seed-fe/request] Invalid response interceptor: onConfig is required',
  NEXT_CALLED_MULTIPLE_TIMES: 'next() called multiple times in error middleware',
  INSTANCE_ALREADY_EXISTS: (name: string) =>
    `[@seed-fe/request] Instance ${name} already exists, cannot be defined again`,
  INSTANCE_NOT_FOUND: (name: string) => `[@seed-fe/request] Axios instance not found for instanceName: ${name}`,
} as const;

/**
 * 默认实例名称
 */
export const DEFAULT_INSTANCE_NAME = Symbol.for('default');

/**
 * 表示拦截器添加失败的常量
 */
export const INVALID_INTERCEPTOR_ID = -1;
