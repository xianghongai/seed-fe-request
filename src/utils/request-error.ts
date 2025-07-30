/**
 * 将任意类型的错误标准化为 Promise 拒绝
 * 用于拦截器中统一错误处理格式
 */
export function normalizeError(error: unknown): Promise<never> {
  // 如果已经是 Error 实例（包括 AxiosError），直接拒绝
  if (error instanceof Error) {
    return Promise.reject(error);
  }

  // 非 Error 类型，包装成 Error 实例
  return Promise.reject(new Error(String(error)));
}
