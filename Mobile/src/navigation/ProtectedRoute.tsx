import React from 'react';
import { useNavigation } from '../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../lib/react-navigation-native-stack';
import type { RootStackParamList } from './types';
import { useAppSelector } from '../store/hooks';
import type { RootState } from '../store';
import { useEffect } from 'react';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

/**
 * Wraps content that requires auth. Redirects to SigninFirst if not authenticated.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAppSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.replace('SigninFirst');
    }
  }, [isAuthenticated, navigation]);

  if (!isAuthenticated) {
    return null;
  }

  return <>{children ?? null}</>;
}
