/**
 * 数组工具函数模块
 *
 * 职责:
 * 将单值/只读数组统一转换为可变数组
 *
 * 核心特性:
 * - 格式统一: 单值/只读数组 → 可变数组
 * - 空值处理: undefined → 空数组
 * - 不可变性: 只读数组会被浅拷贝为可变数组
 *
 * 转换规则:
 * ```
 * undefined        → []
 * 单个值           → [值]
 * 只读数组         → [...数组] (浅拷贝)
 * 普通数组         → [...数组] (浅拷贝)
 * ```
 *
 * @example
 * toArray(undefined);  // []
 * toArray('hello');    // ['hello']
 * toArray([1, 2, 3]);  // [1, 2, 3] (新数组)
 */

/**
 * 将单个值或只读数组统一为可变数组
 *
 * 适用场景:
 * - API 接受单值或数组参数时的标准化
 * - 只读数组需要转换为可变数组
 * - 处理可选值 (undefined → [])
 *
 * 转换逻辑:
 * 1. undefined: 返回空数组
 * 2. 数组: 浅拷贝为新数组 (保护原始数据)
 * 3. 单值: 包装为单元素数组
 *
 * @param x - 单个值/只读数组/undefined
 * @returns 可变数组
 *
 * @example
 * // undefined → 空数组
 * toArray(undefined);
 * // 返回: []
 *
 * @example
 * // 单值 → 单元素数组
 * toArray(42);
 * // 返回: [42]
 *
 * toArray('hello');
 * // 返回: ['hello']
 *
 * @example
 * // 只读数组 → 可变数组 (浅拷贝)
 * const readonlyArr: ReadonlyArray<number> = [1, 2, 3];
 * const mutableArr = toArray(readonlyArr);
 * // 返回: [1, 2, 3] (新数组，可变)
 * mutableArr.push(4);  // OK
 *
 * @example
 * // 普通数组 → 新数组 (浅拷贝)
 * const original = [1, 2, 3];
 * const copy = toArray(original);
 * // 返回: [1, 2, 3] (新数组)
 * copy.push(4);
 * // original 保持不变: [1, 2, 3]
 * // copy 被修改: [1, 2, 3, 4]
 *
 * @example
 * // 实际应用: 处理 handlers 配置
 * function processHandlers(handlers: Handler | ReadonlyArray<Handler> | undefined) {
 *   const handlerList = toArray(handlers);
 *   // handlerList 始终是数组，可以安全遍历
 *   for (const handler of handlerList) {
 *     handler();
 *   }
 * }
 */
export function toArray<T>(x: ReadonlyArray<T> | T | undefined): T[] {
  // 1. undefined → 空数组
  if (x === undefined) return [];

  // 2. 数组 → 浅拷贝
  // 3. 单值 → 包装为数组
  return Array.isArray(x) ? [...(x as ReadonlyArray<T>)] : [x as T];
}
