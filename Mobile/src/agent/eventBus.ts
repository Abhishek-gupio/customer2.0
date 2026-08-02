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

/**
 * Delivery is isolated per listener: one screen's bad handler must not stop the remaining
 * subscribers from seeing the event, and must not surface as a failure of the agent turn that
 * emitted it. Errors are reported rather than swallowed silently.
 */
function deliver(listener: Listener, event: UIEvent): void {
    try {
        listener(event);
    } catch (error) {
        console.error(`[agent/eventBus] listener for "${event.type}" threw`, error);
    }
}

export function publish(event: UIEvent): void {
    // Snapshot before iterating: a listener that unsubscribes (or subscribes) during delivery
    // would otherwise mutate the Set mid-iteration.
    const typed = listenersByType.get(event.type);
    if (typed) [...typed].forEach((listener) => deliver(listener, event));
    [...wildcardListeners].forEach((listener) => deliver(listener, event));
}

export function publishAll(events: UIEvent[]): void {
    events.forEach(publish);
}
