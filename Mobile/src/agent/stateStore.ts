import { create } from 'zustand';

export interface AgentDraft {
    fields: Record<string, unknown>;
    missingFields: string[];
    status: 'pending' | 'ready' | 'error';
    version: number;
    updatedAt: number;
}

interface AgentStateStoreState {
    drafts: Record<string, AgentDraft>;
    patchDraft: (
        draftKey: string,
        fields: Record<string, unknown>,
        missingFields?: string[],
        status?: 'pending' | 'ready' | 'error',
    ) => void;
    clearDraft: (draftKey: string) => void;
}

/**
 * Generalized, keyed version of the pattern already proven by `expenseStore.ts` (a global
 * version counter any screen can `.subscribe()` to). This one is keyed by `draftKey` so several
 * agent-driven screens can each hold their own in-progress state independently — e.g. a
 * "trip-plan" draft and a "budget" draft can update without stepping on each other, and a
 * screen only re-renders when *its* key changes, not on every agent event.
 */
export const useAgentStateStore = create<AgentStateStoreState>((set, get) => ({
    drafts: {},
    patchDraft: (draftKey, fields, missingFields, status = 'ready') => {
        set((state) => {
            const existing = state.drafts[draftKey];
            return {
                drafts: {
                    ...state.drafts,
                    [draftKey]: {
                        fields: { ...(existing?.fields ?? {}), ...fields },
                        missingFields: missingFields ?? existing?.missingFields ?? [],
                        status,
                        version: (existing?.version ?? 0) + 1,
                        updatedAt: Date.now(),
                    },
                },
            };
        });
    },
    clearDraft: (draftKey) => {
        set((state) => {
            const { [draftKey]: _removed, ...rest } = state.drafts;
            return { drafts: rest };
        });
    },
}));

export function getAgentDraft(draftKey: string): AgentDraft | undefined {
    return useAgentStateStore.getState().drafts[draftKey];
}
