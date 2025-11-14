import type { ErrorContext } from '../types';

// Narrow unknown to a generic object
function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/**
 * Type guard: checks whether a value looks like a response with a numeric status
 */
export function hasResponseStatus(x: unknown): x is { status: number } {
  return isObject(x) && typeof (x as { status?: unknown }).status === 'number';
}

/**
 * Safely read HTTP status code from ErrorContext.response (if present)
 */
export function getResponseStatus(ctx: ErrorContext): number | undefined {
  return hasResponseStatus(ctx.response) ? ctx.response.status : undefined;
}
