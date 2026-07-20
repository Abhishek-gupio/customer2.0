import { subscribe } from './eventBus';
import { useAgentStateStore } from './stateStore';
import { isRouteFocused, navigateTo, navigationRef } from '../navigation/navigationRef';

let initialized = false;

/**
 * Default, app-wide handling for the event types every screen can rely on without subscribing
 * itself: `open_view` (navigate only if the target isn't already focused — an already-open
 * screen gets patched in place instead of re-navigated) and `update_state` (apply to the keyed
 * draft store). Call once from the app root. Events like `highlight`/`focus_input`/`speak` have
 * no default handler here — they're only meaningful to a specific screen, which subscribes to
 * them directly via `eventBus.subscribe`.
 */
export function initAgentEventHandlers(): void {
    if (initialized) return;
    initialized = true;

    subscribe('open_view', (event) => {
        if (event.type !== 'open_view') return;
        if (isRouteFocused(event.view)) return;
        navigateTo(event.view, event.params);
    });

    subscribe('update_state', (event) => {
        if (event.type !== 'update_state') return;
        useAgentStateStore.getState().patchDraft(event.draftKey, event.fields, event.missingFields, event.status);
    });

    subscribe('navigate_back', () => {
        if (navigationRef.isReady() && navigationRef.canGoBack()) {
            navigationRef.goBack();
        }
    });
}
