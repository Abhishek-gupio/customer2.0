import { UIEvent } from './types';

type Listener = (event: UIEvent) => void;

const listenersByType = new Map<UIEvent['type'], Set<Listener>>();
const wildcardListeners = new Set<Listener>();

/**
 * The client-side half of the event bus (Layer 8): the agent runtime never touches UI directly,
 * it emits `UIEvent`s, and interested components subscribe to only the event types they care
 * about (Layer 9 — "every screen subscribes to only the events it cares about"). Default
 * handling for the common cases (open_view -> navigate-or-patch, update_state -> stateStore) is
 * wired once at the app root in `eventHandlers.ts`; screens can additionally subscribe directly
 * for things like `highlight`/`focus_input` that are naturally scoped to one screen.
 */
export function subscribe(type: UIEvent['type'], listener: Listener): () => void {
    const set = listenersByType.get(type) ?? new Set<Listener>();
    set.add(listener);
    listenersByType.set(type, set);
    return () => set.delete(listener);
}

export function subscribeAll(listener: Listener): () => void {
    wildcardListeners.add(listener);
    return () => wildcardListeners.delete(listener);
}

export function publish(event: UIEvent): void {
    listenersByType.get(event.type)?.forEach((listener) => listener(event));
    wildcardListeners.forEach((listener) => listener(event));
}

export function publishAll(events: UIEvent[]): void {
    events.forEach(publish);
}
