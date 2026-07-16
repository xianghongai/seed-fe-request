/**
 * 共享预设管理模块
 *
 * 职责:
 * 1. 管理全局共享预设 (单一预设)
 * 2. 提供上下文快照机制 (并发隔离)
 * 3. 支持运行期动态更新上下文
 *
 * 核心特性:
 * - 单一预设: 同一时刻只有一个共享预设生效
 * - 快照机制: 每次请求捕获当时的上下文，确保并发安全
 * - 不可变性: 预设和上下文都冻结，防止意外修改
 * - 版本控制: 上下文变更时递增版本号 (用于缓存失效)
 *
 * 设计理念:
 * - 提供机制，不预置业务逻辑
 * - 用户自定义请求/响应/错误阶段的处理
 * - 最小侵入: 不污染用户配置，使用 Symbol 存储快照
 *
 * @example
 * // 定义共享预设
 * defineSharedPreset({
 *   onRequest: {
 *     handlers: [(config) => {
 *       const snapshot = readPresetContext(config);
 *       config.headers['Accept-Language'] = String(snapshot.lang);
 *       return config;
 *     }]
 *   },
 *   onError: {
 *     handlers: []  // 启用错误标准化
 *   }
 * });
 *
 * // 运行期更新上下文
 * updateSharedContext({ lang: 'zh-CN' });
 * await httpRequest.get('/users');  // 使用 zh-CN
 *
 * updateSharedContext({ lang: 'en-US' });
 * await httpRequest.get('/users');  // 使用 en-US (并发安全)
 */
import type { SharedPreset, StageConfig } from '../types';

/**
 * 当前激活的共享预设
 *
 * 只读: 通过 Object.freeze() 冻结，防止外部修改
 */
let currentPreset: SharedPreset | undefined;

/**
 * 上下文版本号
 *
 * 每次更新上下文时递增
 * 用途: 缓存失效、诊断调试
 */
let contextVersion = 0;

/**
 * 复制并冻结阶段配置的可变容器。
 * 处理器函数保持原身份，但数组和参数对象不能再被调用方原地修改。
 */
function freezeStage<T>(stage: StageConfig<T> | undefined): StageConfig<T> | undefined {
  if (!stage) {
    return undefined;
  }

  const handlers = Array.isArray(stage.handlers) ? Object.freeze([...stage.handlers]) : stage.handlers;
  return Object.freeze({
    ...stage,
    params: stage.params ? Object.freeze({ ...stage.params }) : undefined,
    handlers,
  });
}

/**
 * 创建共享预设快照，断开调用方对嵌套配置容器的可变引用。
 */
function freezePreset(preset: SharedPreset): SharedPreset {
  return Object.freeze({
    ...preset,
    context: preset.context ? Object.freeze({ ...preset.context }) : undefined,
    onRequest: freezeStage(preset.onRequest),
    onResponse: freezeStage(preset.onResponse),
    onError: freezeStage(preset.onError),
  });
}

/**
 * 注册/替换全局共享预设
 *
 * 注意:
 * - 同一时刻只有一个共享预设生效
 * - 对象会被冻结，防止外部修改
 * - 版本号会递增
 *
 * @param preset - 共享预设配置
 *
 * @example
 * defineSharedPreset({
 *   id: 'app-preset',
 *   context: { lang: 'zh-CN' },
 *   onRequest: {
 *     handlers: [(config) => {
 *       const snapshot = readPresetContext(config);
 *       config.headers['Accept-Language'] = String(snapshot.lang);
 *       return config;
 *     }]
 *   },
 *   onError: {
 *     handlers: []  // 启用错误标准化
 *   }
 * });
 */
export function defineSharedPreset(preset: SharedPreset): void {
  currentPreset = freezePreset(preset);
  contextVersion++;
}

/**
 * 清理当前共享预设
 *
 * 清理后，所有实例将不再应用共享预设
 * 版本号会递增
 */
export function clearSharedPreset(): void {
  currentPreset = undefined;
  contextVersion++;
}

/**
 * 读取当前共享预设 (只读视图)
 *
 * 返回: 冻结的只读引用，避免不必要的对象复制
 *
 * @returns 共享预设只读视图，如果未定义则返回 undefined
 */
export function getSharedPreset(): Readonly<SharedPreset> | undefined {
  // 返回只读引用，避免不必要的对象复制
  return currentPreset;
}

/**
 * 更新共享上下文 (运行期动态更新)
 *
 * 浅合并: 新值会覆盖旧值，但不会递归合并嵌套对象
 *
 * 用途:
 * - 多语言切换
 * - 用户信息更新
 * - 主题切换
 * - 租户切换
 *
 * 注意:
 * - 并发安全: 每次请求捕获快照，不会相互影响
 * - 版本号递增
 *
 * @param patch - 要更新的上下文键值对
 *
 * @example
 * // 初始上下文
 * defineSharedPreset({
 *   context: { lang: 'zh-CN', theme: 'light' }
 * });
 *
 * // 更新语言
 * updateSharedContext({ lang: 'en-US' });
 * // 现在上下文为: { lang: 'en-US', theme: 'light' }
 *
 * // 添加新字段
 * updateSharedContext({ userId: '123' });
 * // 现在上下文为: { lang: 'en-US', theme: 'light', userId: '123' }
 */
export function updateSharedContext(patch: Record<string, unknown>): void {
  if (!currentPreset) {
    // 如果预设不存在，创建一个空预设
    currentPreset = freezePreset({ context: patch });
    contextVersion++;
    return;
  }

  // 浅合并上下文
  const prev = currentPreset.context ?? {};
  currentPreset = freezePreset({ ...currentPreset, context: { ...prev, ...patch } });
  contextVersion++;
}

/**
 * 读取共享上下文版本号 (诊断用)
 *
 * 用途:
 * - 调试: 查看上下文更新次数
 * - 缓存: 判断是否需要重新计算
 *
 * @returns 当前版本号
 */
export function getSharedContextVersion(): number {
  return contextVersion;
}

/**
 * 捕获共享上下文的不可变快照
 *
 * 核心机制: 并发隔离
 *
 * 工作原理:
 * 1. 每次请求发起时调用此函数
 * 2. 复制当前上下文并冻结
 * 3. 将快照附加到请求配置 (使用 Symbol)
 * 4. 拦截器通过 readPresetContext() 读取快照
 *
 * 并发场景:
 * ```typescript
 * updateSharedContext({ lang: 'zh-CN' });
 * const req1 = request('/api1');  // 快照: { lang: 'zh-CN' }
 *
 * updateSharedContext({ lang: 'en-US' });
 * const req2 = request('/api2');  // 快照: { lang: 'en-US' }
 *
 * await Promise.all([req1, req2]);  // 每个请求使用各自快照，互不影响
 * ```
 *
 * @returns 冻结的上下文快照
 */
export function captureSharedContext(): Readonly<Record<string, unknown>> {
  const snapshot = currentPreset?.context ?? {};
  // 浅拷贝并冻结，确保不可变
  return Object.freeze({ ...snapshot });
}
