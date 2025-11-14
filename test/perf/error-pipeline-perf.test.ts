import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllInstances,
  clearGlobalErrorPipeline,
  defineRequestConfig,
  request,
  setGlobalErrorPipeline,
} from '../../src/index';
// mock axios first
import { createMockError, mockAxiosInstance, resetAllMocks } from '../utils/mocks';

describe('性能回归：错误管线（pipeline）额外开销', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();
    clearGlobalErrorPipeline();
  });

  it('无管线 vs 三层空操作中间件，失败路径耗时处于同一数量级（≤2x）', async () => {
    defineRequestConfig({ instanceName: 'perf', baseURL: '/perf' });

    const N = 200;
    const err = createMockError('boom', 500);

    // baseline: no pipelines
    let start = Date.now();
    for (let i = 0; i < N; i++) {
      mockAxiosInstance.request.mockRejectedValueOnce(err);
      try {
        // eslint-disable-next-line no-await-in-loop
        await request({ instanceName: 'perf', url: `/x${i}` });
      } catch {}
    }
    const baseline = Date.now() - start;

    // with three layers: request/instance/global no-op
    const noop = vi.fn(async (_ctx: any, next?: any) => {
      if (next) await next();
    });
    defineRequestConfig({ instanceName: 'perf2', baseURL: '/perf2', errorPipeline: [noop] });
    setGlobalErrorPipeline([noop]);

    start = Date.now();
    for (let i = 0; i < N; i++) {
      mockAxiosInstance.request.mockRejectedValueOnce(err);
      try {
        // eslint-disable-next-line no-await-in-loop
        await request({ instanceName: 'perf2', url: `/y${i}`, errorPipeline: [noop] });
      } catch {}
    }
    const withPipes = Date.now() - start;

    const ratio = withPipes / Math.max(1, baseline);
    expect(ratio).toBeLessThanOrEqual(2);
  });
});
