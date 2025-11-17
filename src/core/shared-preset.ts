import type { SharedPreset } from '../types';

/**
 * 共享预设管理（骨架）
 * - 本模块提供对全局共享预设的最小读写能力
 * - 后续用户故事将基于此接入实例/请求级覆盖与拦截器装配
 */

// 模块级存储：当前激活的共享预设（仅单一预设；命名/多预设可在后续扩展）
let currentPreset: SharedPreset | undefined;
let contextVersion = 0;

/**
 * 注册/替换全局共享预设
 */
export function defineSharedPreset(preset: SharedPreset): void {
  currentPreset = { ...preset };
  contextVersion++;
}

/**
 * 清理当前共享预设
 */
export function clearSharedPreset(): void {
  currentPreset = undefined;
  contextVersion++;
}

/**
 * 读取当前共享预设（返回只读视图）
 */
export function getSharedPreset(): SharedPreset | undefined {
  return currentPreset ? { ...currentPreset } : undefined;
}

/**
 * 更新共享上下文（浅合并）
 * - 若不存在预设，则创建一个空预设并写入 context
 */
export function updateSharedContext(patch: Record<string, unknown>): void {
  if (!currentPreset) {
    currentPreset = { context: { ...patch } };
    contextVersion++;
    return;
  }
  const prev = currentPreset.context ?? {};
  currentPreset = { ...currentPreset, context: { ...prev, ...patch } };
  contextVersion++;
}

/** 读取共享上下文版本号（诊断用） */
export function getSharedContextVersion(): number {
  return contextVersion;
}

// 预留：实例级覆盖注册（将在 US1/US3 中实现）。此处仅导出类型占位，避免循环依赖。
// 不再维护实例级 apply 状态；实例是否应用共享预设由实例自身的 useSharedPreset 与 presetOverrides 决定
