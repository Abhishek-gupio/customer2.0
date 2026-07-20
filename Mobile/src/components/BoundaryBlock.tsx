import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import type { BoundaryLevel } from '../lib/sentry';

interface BoundaryBlockProps {
  children: React.ReactNode;
  boundaryName: string;
  fallbackTitle: string;
  fallbackMessage: string;
  level?: BoundaryLevel;
  onRetry?: () => void | Promise<void>;
  onSoftRefresh?: () => void | Promise<void>;
}

export default function BoundaryBlock({
  children,
  boundaryName,
  fallbackTitle,
  fallbackMessage,
  level = 'widget',
  onRetry,
  onSoftRefresh,
}: BoundaryBlockProps) {
  const [resetKey, setResetKey] = React.useState(0);

  const refresh = React.useCallback(() => {
    setResetKey(current => current + 1);
  }, []);

  return (
    <ErrorBoundary
      level={level}
      boundaryName={boundaryName}
      fallbackTitle={fallbackTitle}
      fallbackMessage={fallbackMessage}
      onRetry={onRetry}
      onSoftRefresh={onSoftRefresh ?? refresh}
    >
      <React.Fragment key={resetKey}>{children}</React.Fragment>
    </ErrorBoundary>
  );
}
