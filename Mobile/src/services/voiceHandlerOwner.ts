/**
 * Tracks which surface last installed the shared speech-recognition handlers.
 *
 * `@react-native-voice/voice` exposes `onSpeechStart`/`onSpeechResults`/etc. as SETTER-ONLY
 * accessors (see its dist/index.js) — there are no getters, so reading them always yields
 * `undefined`. That makes the obvious "only clear the slot if it still holds my handler" check
 * impossible to write directly: the comparison can never be true.
 *
 * Two surfaces share those slots — the always-mounted HeyGupioOverlay and the AIAssistant screen —
 * and whichever assigns last owns them. Clearing them blindly on unmount is what left the other
 * surface's mic permanently dead. This module records ownership explicitly so a surface can clear
 * the slots only while it is still the owner.
 */
export type VoiceOwnerToken = symbol;

let currentOwner: VoiceOwnerToken | null = null;

/** Call immediately after assigning the Voice.on* handlers. */
export function claimVoiceHandlers(owner: VoiceOwnerToken): void {
    currentOwner = owner;
}

/**
 * Returns true only if `owner` still holds the handler slots, in which case the caller should
 * clear them. Returns false when another surface has since claimed them — then the caller must
 * leave them alone.
 */
export function releaseVoiceHandlers(owner: VoiceOwnerToken): boolean {
    if (currentOwner !== owner) return false;
    currentOwner = null;
    return true;
}
