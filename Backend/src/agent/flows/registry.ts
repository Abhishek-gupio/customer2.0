import { Flow } from "../types";

const registry = new Map<string, Flow>();

export function registerFlow(flow: Flow): void {
  registry.set(flow.key, flow);
}

export function getFlow(key: string): Flow | undefined {
  return registry.get(key);
}

export function listFlows(): Flow[] {
  return Array.from(registry.values());
}

/** Cheap keyword/regex routing pass, checked before falling back to the LLM intent classifier. */
export function matchFlow(utterance: string): Flow | undefined {
  return listFlows().find((flow) => flow.matches(utterance));
}
