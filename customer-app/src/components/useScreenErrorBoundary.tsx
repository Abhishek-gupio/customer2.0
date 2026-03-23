import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ErrorScreen } from './ErrorScreen';

/**
 * useScreenErrorBoundary - hook for local error boundary with navigation reset
 * Usage:
 *   const { error, triggerError, ErrorBoundaryUI } = useScreenErrorBoundary('TrackVehicle');
 *   if (error) return ErrorBoundaryUI;
 *   ...
 *   <Button onPress={triggerError} />
 */
export function useScreenErrorBoundary(routeName: string) {
  const [error, setError] = React.useState<Error | null>(null);
  const [prevRoute, setPrevRoute] = React.useState<string | null>(null);
  const navigation = useNavigation<StackNavigationProp<any>>();

  React.useEffect(() => {
    if (navigation && navigation.getState) {
      const state = navigation.getState();
      const idx = state.index;
      if (idx > 0) {
        setPrevRoute(state.routes[idx - 1]?.name || null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const triggerError = (err?: Error) => {
    setError(err || new Error('Screen error'));
  };

  const handleTryAgain = () => {
    setError(null);
    // Restore previous route in stack if available
    if (navigation && navigation.reset) {
      if (prevRoute && prevRoute !== routeName) {
        navigation.reset({
          index: 1,
          routes: [{ name: prevRoute as never }, { name: routeName as never }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: routeName as never }],
        });
      }
    }
  };

  const ErrorBoundaryUI = error ? (
    <ErrorScreen onTryAgain={handleTryAgain} />
  ) : null;

  return { error, triggerError, ErrorBoundaryUI };
}
