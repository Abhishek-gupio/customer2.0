import * as React from 'react';
import { Button } from './ui/Button';

export type BoundaryLevel = 'app' | 'feature' | 'widget';

export interface ReportIssuePayload {
  correlationId: string;
  error: Error;
  componentStack?: string;
  level: BoundaryLevel;
  boundaryName?: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  level?: BoundaryLevel;
  boundaryName?: string;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onRetry?: () => void | Promise<void>;
  onSoftRefresh?: () => void | Promise<void>;
  onReportIssue?: (payload: ReportIssuePayload) => void | Promise<void>;
}

interface ErrorBoundaryState {
  error: Error | null;
  correlationId: string | null;
  componentStack?: string;
  resetCounter: number;
  reporting: boolean;
}

const INITIAL_STATE: ErrorBoundaryState = {
  error: null,
  correlationId: null,
  componentStack: undefined,
  resetCounter: 0,
  reporting: false,
};

function createCorrelationId(prefix = 'admin'): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

function getDefaultTitle(level: BoundaryLevel): string {
  switch (level) {
    case 'app':
      return 'The admin app hit a fatal error';
    case 'widget':
      return 'This widget could not render';
    default:
      return 'This page section ran into a problem';
  }
}

function getDefaultMessage(level: BoundaryLevel): string {
  switch (level) {
    case 'app':
      return 'Try restarting the admin session. If it keeps happening, report it with the correlation id below.';
    case 'widget':
      return 'Retry this block, refresh it softly, or report the issue if it keeps happening.';
    default:
      return 'Retry this page section, refresh it softly, or report the issue if it keeps happening.';
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return 'Unexpected error';
}

function buildIssueMailtoUrl(payload: ReportIssuePayload): string {
  const subject = `[Gupio Admin] Issue report ${payload.correlationId}`;
  const bodyLines = [
    `Correlation ID: ${payload.correlationId}`,
    `Surface: ${payload.boundaryName ?? 'unknown'}`,
    `Boundary level: ${payload.level}`,
    '',
    `Error: ${payload.error.name}: ${payload.error.message}`,
    '',
    'Component stack:',
    payload.componentStack || 'Unavailable',
    '',
    'Stack:',
    payload.error.stack || 'Unavailable',
  ];

  return `mailto:${encodeURIComponent(
    'support@gupio.com',
  )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    bodyLines.join('\n'),
  )}`;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = INITIAL_STATE;

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const correlationId = this.state.correlationId ?? createCorrelationId();

    console.error(`[AdminErrorBoundary:${correlationId}]`, {
      correlationId,
      surface: this.props.boundaryName ?? 'admin-boundary',
      level: this.props.level ?? 'feature',
      componentStack: info.componentStack ?? '',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });

    this.setState({
      correlationId,
      componentStack: info.componentStack ?? '',
    });
  }

  private resetBoundary = async () => {
    try {
      await this.props.onRetry?.();
    } finally {
      this.setState((currentState) => ({
        ...INITIAL_STATE,
        resetCounter: currentState.resetCounter + 1,
      }));
    }
  };

  private softRefresh = async () => {
    if (!this.props.onSoftRefresh) {
      return;
    }

    try {
      await this.props.onSoftRefresh();
    } finally {
      this.setState((currentState) => ({
        ...INITIAL_STATE,
        resetCounter: currentState.resetCounter + 1,
      }));
    }
  };

  private reportIssue = async () => {
    const { error, correlationId, componentStack } = this.state;

    if (!error || !correlationId) {
      return;
    }

    this.setState({ reporting: true });

    try {
      const payload: ReportIssuePayload = {
        correlationId,
        error,
        componentStack,
        level: this.props.level ?? 'feature',
        boundaryName: this.props.boundaryName,
      };

      if (this.props.onReportIssue) {
        await this.props.onReportIssue(payload);
        return;
      }

      window.location.assign(buildIssueMailtoUrl(payload));
    } finally {
      this.setState({ reporting: false });
    }
  };

  render() {
    const { children, level = 'feature' } = this.props;
    const { error, correlationId, reporting, resetCounter } = this.state;

    if (!error) {
      return (
        <React.Fragment key={`admin-boundary-reset-${resetCounter}`}>
          {children}
        </React.Fragment>
      );
    }

    const appLevel = level === 'app';
    const shellClass = appLevel
      ? 'min-h-screen bg-[var(--bg)]'
      : 'min-h-[420px]';

    return (
      <div
        className={`flex w-full items-center justify-center px-4 py-8 text-white ${shellClass}`}
      >
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-white/45">
            {appLevel
              ? 'App fallback'
              : level === 'widget'
                ? 'Widget fallback'
                : 'Feature fallback'}
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
            {this.props.fallbackTitle ?? getDefaultTitle(level)}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
            {this.props.fallbackMessage ?? getDefaultMessage(level)}
          </p>

          <div className="mt-6 rounded-2xl border border-white/8 bg-black/30 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/40">
              Correlation ID
            </div>
            <div className="mt-2 break-all text-sm font-semibold text-white">
              {correlationId ?? 'Pending...'}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/8 bg-black/30 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/40">
              Error
            </div>
            <div className="mt-2 text-sm leading-6 text-white/80">
              {getErrorMessage(error)}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => void this.resetBoundary()}>Retry</Button>
            {!appLevel && this.props.onSoftRefresh ? (
              <Button
                variant="secondary"
                onClick={() => void this.softRefresh()}
              >
                Soft refresh section
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => void this.reportIssue()}
              disabled={reporting}
            >
              {reporting ? 'Opening report...' : 'Report issue'}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
