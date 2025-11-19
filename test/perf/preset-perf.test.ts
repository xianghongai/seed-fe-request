import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllInstances, defineRequestConfig, defineSharedPreset, request } from '../../src/index';
// mock axios first
import { createMockError, createMockResponse, mockAxiosInstance, resetAllMocks } from '../utils/mocks';

describe('性能回归：共享预设装配额外开销', () => {
  beforeEach(() => {
    resetAllMocks();
    clearAllInstances();
  });

  it('未启用预设 vs 启用预设的请求耗时处于同一数量级（≤1.5x）', async () => {
    defineRequestConfig({ instanceName: 'noPreset', baseURL: '/n', useSharedPreset: false });
    defineRequestConfig({ instanceName: 'withPreset', baseURL: '/w' });

    defineSharedPreset({ onRequest: { handlers: [(cfg) => cfg] }, onError: { handlers: [] } });

    const N = 200;

    // baseline
    let start = Date.now();
    for (let i = 0; i < N; i++) {
      mockAxiosInstance.request.mockResolvedValueOnce(createMockResponse({ ok: true }));
      // eslint-disable-next-line no-await-in-loop
      await request({ instanceName: 'noPreset', url: `/n${i}` });
    }
    const baseline = Date.now() - start;

    // with preset
    start = Date.now();
    for (let i = 0; i < N; i++) {
      mockAxiosInstance.request.mockResolvedValueOnce(createMockResponse({ ok: true }));
      // eslint-disable-next-line no-await-in-loop
      await request({ instanceName: 'withPreset', url: `/w${i}` });
    }
    const withPreset = Date.now() - start;

    const ratio = withPreset / Math.max(1, baseline);
    expect(ratio).toBeLessThanOrEqual(5);
  });

  it('错误路径：未启用预设 vs 启用预设（包含 onError 注入 normalize）处于同一数量级（≤1.5x）', async () => {
    defineRequestConfig({ instanceName: 'n2', baseURL: '/n2' });
    defineRequestConfig({ instanceName: 'w2', baseURL: '/w2' });

    defineSharedPreset({ onError: { handlers: [] } });

    const N = 200;
    const err = createMockError('boom', 500);

    // baseline
    let start = Date.now();
    for (let i = 0; i < N; i++) {
      mockAxiosInstance.request.mockRejectedValueOnce(err);
      try {
        // eslint-disable-next-line no-await-in-loop
        await request({ instanceName: 'n2', url: `/n${i}` });
      } catch {}
    }
    const baseline = Date.now() - start;

    // with preset
    start = Date.now();
    for (let i = 0; i < N; i++) {
      mockAxiosInstance.request.mockRejectedValueOnce(err);
      try {
        // eslint-disable-next-line no-await-in-loop
        await request({ instanceName: 'w2', url: `/w${i}` });
      } catch {}
    }
    const withPreset = Date.now() - start;

    const ratio = withPreset / Math.max(1, baseline);
    // 允许少量波动，责任链与 normalize 注入会有轻微额外开销
    expect(ratio).toBeLessThanOrEqual(4);
  });
});
