import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import type { BoundaryLevel } from '../lib/sentry';

interface BoundaryOptions {
  boundaryName: string;
  fallbackTitle: string;
  fallbackMessage: string;
  level?: BoundaryLevel;
  onRetry?: () => void | Promise<void>;
  onSoftRefresh?: () => void | Promise<void>;
}

export function withErrorBoundary<P extends object>(
  ScreenComponent: React.ComponentType<P>,
  options: BoundaryOptions,
) {
  function WrappedScreen(props: P) {
    const [resetKey, setResetKey] = React.useState(0);

    const refresh = React.useCallback(() => {
      setResetKey(current => current + 1);
    }, []);

    return (
      <ErrorBoundary
        level={options.level ?? 'feature'}
        boundaryName={options.boundaryName}
        fallbackTitle={options.fallbackTitle}
        fallbackMessage={options.fallbackMessage}
        onRetry={options.onRetry}
        onSoftRefresh={options.onSoftRefresh ?? refresh}
      >
        <ScreenComponent key={resetKey} {...props} />
      </ErrorBoundary>
    );
  }

  WrappedScreen.displayName = `withErrorBoundary(${
    ScreenComponent.displayName || ScreenComponent.name || 'Screen'
  })`;

  return WrappedScreen;
}
