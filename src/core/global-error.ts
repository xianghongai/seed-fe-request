import type { CustomRequestConfig, ErrorMiddleware } from '../types';

// In-memory shared error pipeline. Last set wins.
let globalErrorPipeline: ErrorMiddleware[] | undefined;
let legacyGlobalHandler: ((error: unknown, options: { config: CustomRequestConfig }) => void) | undefined;

export function setGlobalErrorPipeline(middlewares: ErrorMiddleware[]): void {
  globalErrorPipeline = Array.isArray(middlewares) ? middlewares.slice() : [];
}

export function clearGlobalErrorPipeline(): void {
  globalErrorPipeline = undefined;
}

export function getGlobalErrorPipeline(): ErrorMiddleware[] | undefined {
  if (globalErrorPipeline?.length) return globalErrorPipeline;
  if (legacyGlobalHandler) {
    return [
      (ctx) => {
        legacyGlobalHandler?.(ctx.normalized, { config: ctx.config });
      },
    ];
  }
  return undefined;
}

// Legacy compatibility (alpha stage shim): map legacy global handler to pipeline
export function setGlobalErrorHandler(
  handler: (error: unknown, options: { config: CustomRequestConfig }) => void
): void {
  legacyGlobalHandler = handler;
}

export function clearGlobalErrorHandler(): void {
  legacyGlobalHandler = undefined;
}
