import { VoiceAction } from "./voice-action.types";

const registry = new Map<string, VoiceAction>();

export function registerVoiceAction(action: VoiceAction): void {
  registry.set(action.key, action);
}

export function getVoiceAction(key: string): VoiceAction | undefined {
  return registry.get(key);
}

export function listVoiceActionKeys(): string[] {
  return Array.from(registry.keys());
}
