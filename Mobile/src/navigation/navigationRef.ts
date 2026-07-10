import { createNavigationContainerRef } from '../lib/react-navigation-native';
import type { RootStackParamList } from './types';

/**
 * A module-level ref so non-component code (the agent event handlers, in particular — the
 * runtime emits events, it doesn't hold a React navigation prop) can navigate without needing
 * to be a screen component. Wired to the root `NavigationContainer` in App.tsx.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function isRouteFocused(routeName: string): boolean {
    if (!navigationRef.isReady()) return false;
    return navigationRef.getCurrentRoute()?.name === routeName;
}

export function navigateTo(name: string, params?: Record<string, unknown>): void {
    if (!navigationRef.isReady()) return;
    // The screen name is a runtime string (from a UIEvent, not a RootStackParamList literal),
    // so this can't satisfy React Navigation's tuple-based `navigate` overloads statically —
    // same escape hatch already used at every other dynamic-screen navigate() call site in
    // this codebase (e.g. HeyGupioOverlay.tsx's `rootNavigation.navigate(screen as any, ...)`).
    (navigationRef.navigate as any)(name, params);
}
