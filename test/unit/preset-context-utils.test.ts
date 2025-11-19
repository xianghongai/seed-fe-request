import { describe, expect, it } from 'vitest';
import type { CustomRequestConfig } from '../../src/types';
import { attachPresetContext, readPresetContext } from '../../src/utils/preset-context';

describe('Preset Context Utils', () => {
  it('attachPresetContext 后 readPresetContext 能读到快照', () => {
    const cfg = { url: '/x' } as CustomRequestConfig;
    const snap = Object.freeze({ lang: 'zh-CN', region: 'CN' });
    attachPresetContext(cfg, snap);

    const out = readPresetContext(cfg);
    expect(out).toEqual(snap);
    // 应为只读对象
    expect(Object.isFrozen(out)).toBe(true);
  });

  it('未附加时 readPresetContext 返回空只读对象', () => {
    const cfg = { url: '/y' } as CustomRequestConfig;
    const out = readPresetContext(cfg);
    expect(out).toEqual({});
    expect(Object.isFrozen(out)).toBe(true);
  });
});
