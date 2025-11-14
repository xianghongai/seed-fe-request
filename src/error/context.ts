import type { CustomRequestConfig, ErrorContext, InstanceName } from '../types';

// Create a minimal, safe error context for the pipeline
export function createErrorContext(
  error: unknown,
  config: CustomRequestConfig,
  instanceName?: InstanceName
): ErrorContext {
  const normalized = error instanceof Error ? error : new Error(String(error));
  // Best-effort response extraction (e.g., AxiosError has response)
  // Do not rely on response shape here. Avoid any by structural check.
  let response: unknown;
  if (typeof error === 'object' && error !== null && 'response' in (error as Record<string, unknown>)) {
    response = (error as { response?: unknown }).response;
  }
  return {
    error,
    normalized,
    config,
    instanceName,
    response,
    state: Object.create(null),
  };
}
