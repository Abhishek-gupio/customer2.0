import { getRedis } from "../config/redis";
import { AgentMemory, ExecutionRecord } from "./types";

/**
 * Server-side session memory: which workflow (if any) is in progress, its slots, and a capped
 * history of completed actions. Per the architecture's memory principle, this must never live
 * only on the client — keyed by session so a follow-up turn works regardless of which
 * client/device continues the conversation.
 *
 * The key is scoped by customerId as well as sessionId. `sessionId` is supplied by the client, and
 * scoping on it alone meant a caller presenting someone else's session id would resume that
 * customer's pending workflow — including half-collected `verify_dl` / `verify_fastag` slots
 * (licence numbers, bank account details), with the paid verification result then landing on the
 * caller's own account. Every other store in this codebase scopes on `{ id, customerId }`; this
 * one now matches, so an unknown or borrowed session id simply reads as empty memory.
 */
const MEMORY_PREFIX = "agent:memory:";
const MEMORY_TTL_SEC = 15 * 60;
const MAX_HISTORY = 10;

const EMPTY_MEMORY: Omit<AgentMemory, "updatedAt"> = {
  workflow: null,
  step: null,
  slots: {},
  waitingFor: null,
  history: [],
};

/** In-memory fallback when Redis is not available (mirrors the pattern used by otpStore.ts). */
const memoryStore = new Map<string, { entry: AgentMemory; expiresAt: number }>();

function useMemorySet(key: string, entry: AgentMemory): void {
  memoryStore.set(key, { entry, expiresAt: Date.now() + MEMORY_TTL_SEC * 1000 });
}
function useMemoryGet(key: string): AgentMemory | null {
  const record = memoryStore.get(key);
  if (!record || Date.now() > record.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return record.entry;
}

/** Both identifiers are required — see the scoping note on MEMORY_PREFIX. */
function memoryKey(customerId: string, sessionId: string): string {
  return `${MEMORY_PREFIX}${customerId}:${sessionId}`;
}

export const agentMemoryStore = {
  async get(customerId: string, sessionId: string): Promise<AgentMemory> {
    const key = memoryKey(customerId, sessionId);
    const redis = getRedis();
    if (redis) {
      try {
        const raw = await redis.get(key);
        return raw ? (JSON.parse(raw) as AgentMemory) : { ...EMPTY_MEMORY, updatedAt: Date.now() };
      } catch {
        return useMemoryGet(key) ?? { ...EMPTY_MEMORY, updatedAt: Date.now() };
      }
    }
    return useMemoryGet(key) ?? { ...EMPTY_MEMORY, updatedAt: Date.now() };
  },

  async set(customerId: string, sessionId: string, entry: AgentMemory): Promise<void> {
    const key = memoryKey(customerId, sessionId);
    const redis = getRedis();
    if (redis) {
      try {
        await redis.setex(key, MEMORY_TTL_SEC, JSON.stringify(entry));
        return;
      } catch {
        useMemorySet(key, entry);
        return;
      }
    }
    useMemorySet(key, entry);
  },

  async clearWorkflow(customerId: string, sessionId: string): Promise<void> {
    const current = await this.get(customerId, sessionId);
    await this.set(customerId, sessionId, {
      ...current,
      workflow: null,
      step: null,
      slots: {},
      waitingFor: null,
      updatedAt: Date.now(),
    });
  },

  /**
   * Appends to the capped history without disturbing the current workflow state.
   *
   * Read-modify-write, so it is not atomic against a concurrent turn on the same session (a
   * double-tap, or voice and text arriving together). The narrow risk is a lost history entry —
   * acceptable, since history is advisory. What must *not* be clobbered is `workflow`/`slots`, so
   * this re-reads and preserves them rather than writing a whole snapshot captured earlier; a
   * caller that needs true atomicity on workflow state should use a Redis WATCH/MULTI or a lock.
   */
  async recordAction(customerId: string, sessionId: string, record: ExecutionRecord): Promise<void> {
    const current = await this.get(customerId, sessionId);
    const history = [record, ...current.history].slice(0, MAX_HISTORY);
    await this.set(customerId, sessionId, { ...current, history, updatedAt: Date.now() });
  },
};
