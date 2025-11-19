/**
 * 拦截器责任链 (轻量级实现)
 *
 * 设计理念:
 * - 轻量: 仅 46 行代码，无过度封装
 * - 职责单一: 只做一件事 - 按序执行拦截器
 * - 恢复机制: 支持错误恢复，继续执行后续拦截器
 * - 性能优化: 使用 for-of 遍历，避免数组方法开销
 *
 * 执行流程:
 * 1. 按顺序执行每个处理器的 onFulfilled
 * 2. 如果抛出错误且提供了 onRejected:
 *    - 调用 onRejected 处理错误
 *    - 如果返回非 undefined，视为恢复，继续执行
 *    - 否则重新抛出错误
 * 3. 返回最终结果
 *
 * 使用场景:
 * - 手动执行共享预设拦截器 (不注册到 Axios)
 * - 手动执行请求级拦截器 (不注册到 Axios)
 *
 * @example
 * // 基础用法
 * const chain = new InterceptorChain<AxiosRequestConfig>();
 * chain
 *   .use((config) => {
 *     config.headers.Authorization = `Bearer ${token}`;
 *     return config;
 *   })
 *   .use((config) => {
 *     config.headers['X-Timestamp'] = Date.now();
 *     return config;
 *   });
 *
 * const result = await chain.execute(initialConfig);
 *
 * @example
 * // 错误恢复
 * const chain = new InterceptorChain<number>();
 * chain
 *   .use(
 *     (val) => { throw new Error('test'); },
 *     (err) => {
 *       console.error('Recovered from:', err);
 *       return 100;  // 返回非 undefined，视为恢复
 *     }
 *   )
 *   .use((val) => val + 1);  // 继续执行: 100 + 1 = 101
 *
 * const result = await chain.execute(0);  // 101
 */
export class InterceptorChain<TValue, TError = unknown> {
  /**
   * 处理器数组
   *
   * 每个处理器包含:
   * - onFulfilled: 成功处理函数 (必需)
   * - onRejected: 错误处理函数 (可选)
   */
  private handlers: Array<{
    onFulfilled: (value: TValue) => TValue | Promise<TValue>;
    onRejected?: (error: TError) => unknown;
  }> = [];

  /**
   * 添加处理器到链中
   *
   * 支持链式调用，可连续添加多个处理器
   *
   * @param onFulfilled - 成功处理函数，接收上一个处理器的结果
   * @param onRejected - 错误处理函数 (可选)，处理上一个处理器抛出的错误
   * @returns this - 返回自身，支持链式调用
   */
  use(onFulfilled: (value: TValue) => TValue | Promise<TValue>, onRejected?: (error: TError) => unknown): this {
    this.handlers.push({ onFulfilled, onRejected });
    return this;
  }

  /**
   * 执行责任链
   *
   * 按顺序执行所有处理器，每个处理器接收上一个处理器的结果
   *
   * 错误处理:
   * - 如果 onFulfilled 抛出错误且有 onRejected:
   *   - 调用 onRejected(error)
   *   - 如果返回非 undefined，视为恢复，继续执行后续处理器
   *   - 否则重新抛出错误，终止执行
   * - 如果没有 onRejected，直接抛出错误
   *
   * @param initial - 初始值，传递给第一个处理器
   * @returns Promise<TValue> - 最后一个处理器的返回值
   * @throws 如果有未恢复的错误
   */
  async execute(initial: TValue): Promise<TValue> {
    let result = initial;

    // 遍历所有处理器，按序执行
    for (const h of this.handlers) {
      try {
        // 执行成功处理函数
        result = await h.onFulfilled(result);
      } catch (err) {
        // 如果提供了错误处理函数
        if (h.onRejected) {
          // 调用错误处理函数
          const recovered = await h.onRejected(err as TError);

          // 如果返回非 undefined，视为错误已恢复
          if (recovered !== undefined) {
            result = recovered as TValue;
            continue; // 继续执行下一个处理器
          }
        }

        // 无恢复或未提供 onRejected，重新抛出错误
        throw err;
      }
    }

    return result;
  }

  /**
   * 清空所有处理器
   *
   * 调用后，链中将没有任何处理器
   */
  clear(): void {
    this.handlers = [];
  }

  /**
   * 获取链中处理器的数量
   *
   * @returns 处理器数量
   */
  get length(): number {
    return this.handlers.length;
  }
}
