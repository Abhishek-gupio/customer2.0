import { getRedis } from "../config/redis";
import { AgentMemory, ExecutionRecord } from "./types";

/**
 * Server-side session memory: which workflow (if any) is in progress, its slots, and a capped
 * history of completed actions. Per the architecture's memory principle, this must never live
 * only on the client — keyed by sessionId so a follow-up turn works regardless of which
 * client/device continues the conversation.
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

export const agentMemoryStore = {
  async get(sessionId: string): Promise<AgentMemory> {
    const key = `${MEMORY_PREFIX}${sessionId}`;
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

  async set(sessionId: string, entry: AgentMemory): Promise<void> {
    const key = `${MEMORY_PREFIX}${sessionId}`;
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

  async clearWorkflow(sessionId: string): Promise<void> {
    const current = await this.get(sessionId);
    await this.set(sessionId, { ...current, workflow: null, step: null, slots: {}, waitingFor: null, updatedAt: Date.now() });
  },

  /** Appends to the capped history without disturbing the current workflow state. */
  async recordAction(sessionId: string, record: ExecutionRecord): Promise<void> {
    const current = await this.get(sessionId);
    const history = [record, ...current.history].slice(0, MAX_HISTORY);
    await this.set(sessionId, { ...current, history, updatedAt: Date.now() });
  },
};
