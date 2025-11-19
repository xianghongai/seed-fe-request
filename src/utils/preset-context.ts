/**
 * 共享上下文快照工具模块
 *
 * 职责:
 * 1. 使用 Symbol 隐藏属性将上下文快照附加到请求配置
 * 2. 提供类型安全的快照读取接口
 * 3. 确保并发请求间的上下文隔离
 *
 * 核心机制:
 * - Symbol 作为隐藏键: 不会污染用户配置，不可枚举
 * - 不可变快照: 使用 Object.freeze() 冻结，防止修改
 * - 按请求捕获: 每个请求都有独立的快照，互不干扰
 *
 * 使用场景:
 * - 多语言切换: 同时发起的请求可能使用不同语言
 * - 用户切换: 确保请求使用正确的用户信息
 * - 租户隔离: 多租户环境下确保请求不会混淆
 *
 * @example
 * // 在请求发起时附加快照
 * const snapshot = captureSharedContext();
 * attachPresetContext(config, snapshot);
 *
 * // 在拦截器中读取快照
 * const handler: RequestHandler = (config) => {
 *   const context = readPresetContext(config);
 *   config.headers['Accept-Language'] = String(context.lang);
 *   return config;
 * };
 */
import type { CustomRequestConfig } from '../types';

/**
 * Symbol 键: 用于在配置对象上存储上下文快照
 *
 * 特性:
 * - unique symbol: 确保全局唯一，避免冲突
 * - 不可枚举: for...in 和 Object.keys() 不会遍历到
 * - 只读: 定义时不可修改
 */
export const PRESET_CONTEXT_SYMBOL: unique symbol = Symbol('seed-fe:request:presetContext');

/**
 * 上下文快照类型
 *
 * 只读的键值对，确保快照不会被修改
 */
export type PresetContextSnapshot = Readonly<Record<string, unknown>>;

/**
 * 将上下文快照附加到配置对象
 *
 * 使用 Object.defineProperty 定义不可枚举、不可写的隐藏属性
 *
 * 属性特性:
 * - enumerable: false - 不会在 for...in 循环中出现
 * - writable: false - 不可修改
 * - configurable: false - 不可删除或重新配置
 *
 * 错误处理:
 * - 静默失败: 如果定义失败 (如对象被冻结)，不会抛出错误
 * - 最小侵入: 读取侧有容错，即使附加失败也不影响请求
 *
 * @param config - 请求配置对象
 * @param snapshot - 冻结的上下文快照
 *
 * @example
 * const snapshot = captureSharedContext();
 * attachPresetContext(config, snapshot);
 *
 * // 快照不会出现在遍历中
 * console.log(Object.keys(config));  // 不包含快照
 * console.log(config);  // 控制台也看不到快照
 */
export function attachPresetContext(config: CustomRequestConfig, snapshot: PresetContextSnapshot): void {
  try {
    Object.defineProperty(config as object, PRESET_CONTEXT_SYMBOL as unknown as string, {
      value: snapshot,
      enumerable: false, // 不可枚举
      writable: false, // 不可写
      configurable: false, // 不可删除
    });
  } catch {
    // 静默失败：保持最小侵入，读侧有容错
  }
}

/**
 * 从配置对象读取上下文快照
 *
 * 类型安全: 确保返回值始终是有效的快照对象
 * 容错机制: 如果快照不存在，返回空的冻结对象
 *
 * @param config - 请求配置对象
 * @returns 上下文快照，如果不存在则返回空的冻结对象
 *
 * @example
 * // 在拦截器中使用
 * const handler: RequestHandler = (config) => {
 *   const snapshot = readPresetContext(config);
 *
 *   // 安全访问: 即使快照不存在也不会报错
 *   if (snapshot.lang) {
 *     config.headers['Accept-Language'] = String(snapshot.lang);
 *   }
 *
 *   if (snapshot.userId) {
 *     config.headers['X-User-ID'] = String(snapshot.userId);
 *   }
 *
 *   return config;
 * };
 */
export function readPresetContext(config: CustomRequestConfig): PresetContextSnapshot {
  const anyCfg = config as unknown as Record<string | symbol, unknown>;
  const snap = anyCfg[PRESET_CONTEXT_SYMBOL as unknown as string] as PresetContextSnapshot | undefined;
  return snap ?? (Object.freeze({}) as PresetContextSnapshot);
}
