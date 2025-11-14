import type { ErrorContext, ErrorMiddleware } from '../types';

type LayerPipelines = {
  request?: ErrorMiddleware[];
  instance?: ErrorMiddleware[];
  global?: ErrorMiddleware[];
};

// Compose middlewares in Koa-style. Each middleware receives (ctx, next)
function compose(middlewares: ErrorMiddleware[]): (ctx: ErrorContext) => Promise<void> {
  return function run(ctx: ErrorContext): Promise<void> {
    let index = -1;
    async function dispatch(i: number): Promise<void> {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      const fn = middlewares[i];
      if (!fn) return;
      await fn(ctx, () => dispatch(i + 1));
    }
    return dispatch(0);
  };
}

function hasLegacySkip(x: unknown): x is { skipErrorHandler?: boolean } {
  return typeof x === 'object' && x !== null && 'skipErrorHandler' in (x as Record<string, unknown>);
}

export async function runErrorPipeline(ctx: ErrorContext, layers: LayerPipelines): Promise<void> {
  if (
    ctx.config.skipErrorPipeline ||
    (hasLegacySkip(ctx.config) && (ctx.config as { skipErrorHandler?: boolean }).skipErrorHandler === true)
  ) {
    throw ctx.normalized;
  }

  const chain: ErrorMiddleware[] = [];
  if (layers.request?.length) chain.push(...layers.request);
  if (layers.instance?.length) chain.push(...layers.instance);
  if (layers.global?.length) chain.push(...layers.global);

  if (chain.length === 0) {
    // No handlers configured; just throw
    throw ctx.normalized;
  }

  const runner = compose(chain);
  try {
    await runner(ctx);
  } catch {
    // Normalize final outcome regardless of middleware throwing
  }
  // Always reject with normalized error; pipeline is for side-effects
  throw ctx.normalized;
}
