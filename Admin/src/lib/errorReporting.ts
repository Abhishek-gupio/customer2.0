import type { BoundaryLevel } from '../components/ErrorBoundary';

interface ErrorCaptureContext {
  correlationId?: string;
  surface?: string;
  level?: BoundaryLevel;
  extras?: Record<string, unknown>;
}

interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

export interface HandledErrorResult {
  correlationId: string;
  serializedError: SerializedError;
}

export function createCorrelationId(prefix = 'admin'): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: error.stack,
    };
  }

  return {
    name: 'NonErrorThrown',
    message: typeof error === 'string' ? error : 'Unknown error',
  };
}

export function reportHandledError(
  error: unknown,
  context: ErrorCaptureContext = {},
): HandledErrorResult {
  const correlationId = context.correlationId ?? createCorrelationId();
  const serializedError = serializeError(error);

  console.error(`[AdminHandledError:${correlationId}]`, {
    correlationId,
    surface: context.surface ?? 'unknown',
    level: context.level ?? 'feature',
    extras: context.extras,
    error: serializedError,
  });

  return {
    correlationId,
    serializedError,
  };
}

export function appendCorrelationId(
  message: string,
  correlationId: string,
): string {
  return `${message} Ref: ${correlationId}`;
}
