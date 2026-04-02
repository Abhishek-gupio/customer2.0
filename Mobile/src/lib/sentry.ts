export type BoundaryLevel = 'app' | 'feature' | 'widget';

export interface ErrorCaptureContext {
  correlationId?: string;
  surface?: string;
  level?: BoundaryLevel;
  componentStack?: string;
  extras?: Record<string, unknown>;
}

export interface ErrorIssuePayload {
  appName?: string;
  to?: string;
  correlationId: string;
  error: unknown;
  context?: ErrorCaptureContext;
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

export function createCorrelationId(prefix = 'gupio'): string {
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

export function captureError(
  error: unknown,
  context: ErrorCaptureContext = {},
): string {
  const correlationId = context.correlationId ?? createCorrelationId();
  const serializedError = serializeError(error);

  console.error(`[ErrorCapture:${correlationId}]`, {
    correlationId,
    surface: context.surface ?? 'unknown',
    level: context.level ?? 'feature',
    componentStack: context.componentStack,
    extras: context.extras,
    error: serializedError,
  });

  return correlationId;
}

export function reportHandledError(
  error: unknown,
  context: ErrorCaptureContext = {},
): HandledErrorResult {
  const correlationId = captureError(error, context);

  return {
    correlationId,
    serializedError: serializeError(error),
  };
}

export function appendCorrelationId(
  message: string,
  correlationId: string,
): string {
  return `${message}\nRef: ${correlationId}`;
}

export function buildIssueMailtoUrl(payload: ErrorIssuePayload): string {
  const appName = payload.appName ?? 'Gupio Customer App';
  const to = payload.to ?? 'support@gupio.com';
  const serializedError = serializeError(payload.error);
  const subject = `[${appName}] Issue report ${payload.correlationId}`;
  const bodyLines = [
    `Correlation ID: ${payload.correlationId}`,
    `Surface: ${payload.context?.surface ?? 'unknown'}`,
    `Boundary level: ${payload.context?.level ?? 'feature'}`,
    '',
    `Error: ${serializedError.name}: ${serializedError.message}`,
    '',
    'Component stack:',
    payload.context?.componentStack || 'Unavailable',
    '',
    'Stack:',
    serializedError.stack || 'Unavailable',
  ];

  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
}
