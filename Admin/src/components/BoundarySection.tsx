import * as React from 'react';
import ErrorBoundary, { type BoundaryLevel } from './ErrorBoundary';

interface BoundarySectionProps {
  children: React.ReactNode;
  boundaryName: string;
  fallbackTitle: string;
  fallbackMessage: string;
  level?: BoundaryLevel;
}

export default function BoundarySection({
  children,
  boundaryName,
  fallbackTitle,
  fallbackMessage,
  level = 'widget',
}: BoundarySectionProps) {
  const [resetKey, setResetKey] = React.useState(0);

  const refresh = React.useCallback(() => {
    setResetKey((current) => current + 1);
  }, []);

  return (
    <ErrorBoundary
      level={level}
      boundaryName={boundaryName}
      fallbackTitle={fallbackTitle}
      fallbackMessage={fallbackMessage}
      onRetry={refresh}
      onSoftRefresh={refresh}
    >
      <React.Fragment key={resetKey}>{children}</React.Fragment>
    </ErrorBoundary>
  );
}
