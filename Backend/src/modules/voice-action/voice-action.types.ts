export type VoiceActionConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface VoiceActionSlot {
  /** Key used in `values`/`knownValues` — e.g. "category". */
  name: string;
  /** Spoken/displayed question asked when this slot is missing. */
  askPrompt: string;
}

export interface VoiceActionExtractResult {
  /** Merged known + newly-extracted values. Never drop a value already present in knownValues. */
  values: Record<string, any>;
  /** Slot names still missing from `values`, in the action's declared ask-order. */
  missingSlots: string[];
  confidence: VoiceActionConfidence;
}

export interface VoiceActionCommitResult {
  success: boolean;
  message: string;
  data?: any;
  /** Params to hand the target screen so it can display what was just committed. */
  navigateParams?: Record<string, unknown>;
  skipped?: boolean;
  reason?: string;
}

export interface VoiceAction {
  key: string;
  /** Ask-order matters — the framework always asks about missingSlots[0]. */
  slots: VoiceActionSlot[];
  targetScreen: string;
  /**
   * Extracts slot values from `newReplyText` only — must treat `knownValues` as authoritative
   * and never overwrite a slot that's already resolved, even if the model re-derives a
   * different value for it from later context.
   */
  extract(
    customerId: string,
    newReplyText: string,
    knownValues: Record<string, any>,
    missingSlotsHint: string[],
  ): Promise<VoiceActionExtractResult>;
  /** Re-validates `values` server-side (never trust a client-echoed draft wholesale) and commits. */
  commit(customerId: string, values: Record<string, any>): Promise<VoiceActionCommitResult>;
}
