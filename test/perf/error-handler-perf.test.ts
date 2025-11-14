import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllInstances,
  clearGlobalErrorPipeline,
  defineRequestConfig,
  request,
  setGlobalErrorPipeline,
} from '../../src/index';
// 确保 axios 在导入库代码前被 mock
import { createMockError, mockAxiosInstance, resetAllMocks } from '../utils/mocks';

describe('性能回归：共享错误处理的额外开销', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();
    clearGlobalErrorPipeline();
    vi.clearAllMocks();
  });

  it('开启共享处理与关闭共享处理的失败路径耗时处于同一数量级（<2x）', async () => {
    defineRequestConfig({ baseURL: 'https://api.example.com' });
    const error = createMockError('fail', 500);

    const N = 200;

    // baseline: 无共享处理
    let start = Date.now();
    for (let i = 0; i < N; i++) {
      mockAxiosInstance.request.mockRejectedValueOnce(error);
      try {
        // eslint-disable-next-line no-await-in-loop
        await request({ url: `/t${i}` });
      } catch {}
    }
    const baseline = Date.now() - start;

    // with global handler
    setGlobalErrorPipeline([vi.fn(async () => {})]);
    start = Date.now();
    for (let i = 0; i < N; i++) {
      mockAxiosInstance.request.mockRejectedValueOnce(error);
      try {
        // eslint-disable-next-line no-await-in-loop
        await request({ url: `/t${i}` });
      } catch {}
    }
    const withGlobal = Date.now() - start;

    // 断言在测试环境下处于同一数量级，避免易碎阈值
    const ratio = withGlobal / Math.max(1, baseline);
    expect(ratio).toBeLessThanOrEqual(2);
  });
});
