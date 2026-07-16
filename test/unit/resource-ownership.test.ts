import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllInstances,
  clearGlobalErrorPipeline,
  clearInstance,
  clearInstanceIfCurrent,
  defineRequestConfig,
  getRequestInstance,
  hasInstance,
  setGlobalErrorPipeline,
} from '../../src/index';

describe('资源所有权', () => {
  beforeEach(() => {
    clearAllInstances();
    clearGlobalErrorPipeline();
  });

  it('旧的全局错误管道句柄不能清除后续注册', () => {
    const first = setGlobalErrorPipeline([]);
    const second = setGlobalErrorPipeline([]);

    expect(first.dispose()).toBe(false);
    expect(second.isActive()).toBe(true);
    expect(second.dispose()).toBe(true);
  });

  it('仅清除仍与预期引用一致的请求实例', () => {
    defineRequestConfig({ instanceName: 'owned' });
    const first = getRequestInstance('owned');
    clearInstance('owned');
    defineRequestConfig({ instanceName: 'owned' });

    expect(clearInstanceIfCurrent('owned', first)).toBe(false);
    expect(hasInstance('owned')).toBe(true);
  });
});
