import { describe, expect, it } from 'vitest';
import { InterceptorChain } from '../../src/interceptors/chain';

describe('InterceptorChain', () => {
  it('按顺序执行 onFulfilled', async () => {
    const chain = new InterceptorChain<number, unknown>();
    chain
      .use((v) => v + 1)
      .use(async (v) => v * 2)
      .use((v) => v - 3);

    const out = await chain.execute(1);
    // ((1 + 1) * 2) - 3 = 1
    expect(out).toBe(1);
  });

  it('onRejected 返回值应视为恢复并继续', async () => {
    const chain = new InterceptorChain<number, unknown>();
    chain
      .use((v) => v + 1)
      .use((_v) => {
        throw new Error('boom');
      })
      .use(
        (v) => v,
        (_err) => 42
      )
      .use((v) => v + 1);

    const out = await chain.execute(1);
    // 第2步抛错后由 onRejected 恢复为 42，继续 +1 → 43
    expect(out).toBe(43);
  });

  it('初始 Promise 拒绝时进入第一个 onRejected', async () => {
    const chain = new InterceptorChain<number, unknown>();
    chain
      .use(
        (v) => v,
        () => 41
      )
      .use((v) => v + 1);

    await expect(chain.execute(Promise.reject(new Error('transport')))).resolves.toBe(42);
  });

  it('onRejected 未恢复则应抛出', async () => {
    const chain = new InterceptorChain<number, unknown>();
    chain
      .use((v) => v + 1)
      .use((_v) => {
        throw new Error('boom');
      }) // 无 onRejected
      .use((v) => v + 1);

    await expect(chain.execute(1)).rejects.toThrow('boom');
  });
});
