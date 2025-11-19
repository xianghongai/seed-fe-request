/**
 * 错误处理管道模块
 *
 * 职责:
 * 1. 组合多层错误中间件 (请求级 → 实例级 → 共享级)
 * 2. 执行 Koa 风格的错误处理管道
 * 3. 确保错误最终以标准化形式抛出
 *
 * 核心特性:
 * - Koa 风格: 中间件接收 (ctx, next)，通过 await next() 调用下一级
 * - 三级管道: 请求级 > 实例级 > 共享级，按顺序执行
 * - 跳过机制: skipErrorPipeline 可以跳过整条管道
 * - 副作用为主: 中间件用于日志、监控、提示等，不改变错误本身
 * - 始终抛出: 无论中间件如何处理，最终都会抛出标准化错误
 *
 * 与共享预设的关系:
 * - 共享预设的 onError 会在响应拦截器层注入 onRejected
 * - 本模块的错误管道独立于共享预设的 onError.enabled
 * - skipErrorPipeline 控制本管道的启用/跳过
 */
import { ERROR_MESSAGES } from '../constant/messages';
import type { ErrorContext, ErrorMiddleware } from '../types';

/**
 * 错误管道层级类型
 *
 * 定义三级错误处理管道:
 * - request: 请求级中间件 (临时处理)
 * - instance: 实例级中间件 (特定服务)
 * - global: 共享级中间件 (全局统一)
 *
 * 执行顺序: request → instance → global
 */
type LayerPipelines = {
  request?: ErrorMiddleware[]; // 请求级: 特定请求的错误处理
  instance?: ErrorMiddleware[]; // 实例级: 特定服务的错误处理
  global?: ErrorMiddleware[]; // 共享级: 全局统一错误处理
};

/**
 * 组合 Koa 风格中间件
 *
 * 将中间件数组组合成单个执行函数，支持 await next() 的洋葱模型
 *
 * 工作原理:
 * 1. 创建 dispatch 递归函数
 * 2. 每次调用 next() 时，执行下一个中间件
 * 3. 如果不调用 next()，后续中间件不会执行
 * 4. 防止重复调用 next() (检测 index 变化)
 *
 * Koa 洋葱模型:
 * ```
 * 中间件1 开始
 *   ├─ await next()  ─┐
 *   │                 │
 *   │   中间件2 开始   │
 *   │     ├─ await next()  ─┐
 *   │     │                 │
 *   │     │   中间件3 开始   │
 *   │     │   中间件3 结束   │
 *   │     │                 │
 *   │     └─────────────────┘
 *   │   中间件2 结束
 *   │
 *   └─────────────────┘
 * 中间件1 结束
 * ```
 *
 * @param middlewares - 中间件数组
 * @returns 组合后的执行函数
 *
 * @example
 * const runner = compose([
 *   async (ctx, next) => {
 *     console.log('1 start');
 *     await next();
 *     console.log('1 end');
 *   },
 *   async (ctx, next) => {
 *     console.log('2 start');
 *     await next();
 *     console.log('2 end');
 *   }
 * ]);
 *
 * await runner(ctx);
 * // 输出:
 * // 1 start
 * // 2 start
 * // 2 end
 * // 1 end
 */
function compose(middlewares: ErrorMiddleware[]): (ctx: ErrorContext) => Promise<void> {
  return function run(ctx: ErrorContext): Promise<void> {
    let index = -1; // 当前执行的中间件索引

    /**
     * 递归分发函数
     *
     * @param i - 要执行的中间件索引
     */
    async function dispatch(i: number): Promise<void> {
      // 防止重复调用 next()
      if (i <= index) {
        throw new Error(ERROR_MESSAGES.NEXT_CALLED_MULTIPLE_TIMES);
      }

      index = i;
      const fn = middlewares[i];

      // 没有更多中间件，结束执行
      if (!fn) return;

      // 执行当前中间件，传入 next 函数
      await fn(ctx, () => dispatch(i + 1));
    }

    // 从第一个中间件开始执行
    return dispatch(0);
  };
}

/**
 * 类型守卫: 检查是否有旧版的 skipErrorHandler 字段
 *
 * 用于向后兼容旧版 API
 *
 * @param x - 要检查的值
 * @returns 是否包含 skipErrorHandler 字段
 */
function hasLegacySkip(x: unknown): x is { skipErrorHandler?: boolean } {
  return typeof x === 'object' && x !== null && 'skipErrorHandler' in (x as Record<string, unknown>);
}

/**
 * 运行错误处理管道
 *
 * 核心流程:
 * 1. 检查是否跳过管道 (skipErrorPipeline 或旧版 skipErrorHandler)
 * 2. 组合三级中间件: 请求级 → 实例级 → 共享级
 * 3. 执行中间件链 (Koa 风格)
 * 4. 始终抛出标准化错误
 *
 * 重要特性:
 * - 中间件仅用于副作用 (日志、监控、提示等)
 * - 不会改变错误本身
 * - 无论中间件如何处理，最终都会抛出 ctx.normalized
 * - 如果没有中间件，直接抛出错误
 *
 * @param ctx - 错误上下文
 * @param layers - 三级错误中间件
 * @throws 始终抛出标准化错误 (ctx.normalized)
 *
 * @example
 * // 定义三级中间件
 * const layers = {
 *   request: [
 *     async (ctx, next) => {
 *       console.warn('请求失败:', ctx.config.url);
 *       await next();
 *     }
 *   ],
 *   instance: [
 *     async (ctx, next) => {
 *       if (getResponseStatus(ctx) === 409) {
 *         showDialog('冲突错误');
 *         return;  // 不调用 next()，终止
 *       }
 *       await next();
 *     }
 *   ],
 *   global: [
 *     async (ctx, next) => {
 *       console.error('全局错误:', ctx.normalized.message);
 *       await next();
 *     }
 *   ]
 * };
 *
 * try {
 *   await runErrorPipeline(ctx, layers);
 * } catch (error) {
 *   // 错误被抛出
 * }
 */
export async function runErrorPipeline(ctx: ErrorContext, layers: LayerPipelines): Promise<void> {
  // 1. 检查是否跳过错误处理管道
  if (
    ctx.config.skipErrorPipeline || // 新版
    (hasLegacySkip(ctx.config) && (ctx.config as { skipErrorHandler?: boolean }).skipErrorHandler === true) // 旧版兼容
  ) {
    // 跳过管道，直接抛出标准化错误
    throw ctx.normalized;
  }

  // 2. 组合三级中间件
  const chain: ErrorMiddleware[] = [];
  if (layers.request?.length) chain.push(...layers.request); // 请求级
  if (layers.instance?.length) chain.push(...layers.instance); // 实例级
  if (layers.global?.length) chain.push(...layers.global); // 共享级

  // 3. 如果没有中间件，直接抛出错误
  if (chain.length === 0) {
    throw ctx.normalized;
  }

  // 4. 组合并执行中间件链
  const runner = compose(chain);
  try {
    await runner(ctx);
  } catch {
    // 无论中间件内部是否抛错，都忽略
    // 错误处理的最终目的是副作用 (日志/监控/提示)
    // 不应该改变错误本身
  }

  // 5. 始终以标准化错误拒绝
  // 中间件仅用于副作用（记录/告警/分流），不影响错误传播
  throw ctx.normalized;
}
