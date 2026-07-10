import { Flow, UIEvent } from "../types";

export interface FlowTurnResult {
  message: string;
  events: UIEvent[];
  /** True once nothing further needs to be asked — the caller clears workflow memory when true. */
  done: boolean;
  flowKey: string;
  /** Merged slot values so far — persisted to server-side memory when `done` is false. */
  knownValues: Record<string, any>;
  /** The slot currently being asked about, or null once nothing's outstanding. */
  waitingForSlot: string | null;
  /** True if this turn ended the flow because commit failed, not because it finished cleanly. */
  failed: boolean;
}

/**
 * Runs one turn of a flow: extract -> (ask again if a required slot is still missing) ->
 * commit -> (auto-re-ask about any still-missing optional slot without blocking on it).
 * Safe to call repeatedly for the same flow — `commit` is expected to handle being invoked
 * again with refined values (see plan-trip.flow.ts's create-then-refresh pattern).
 */
export async function runFlowTurn(
  customerId: string,
  flow: Flow,
  utterance: string,
  knownValues: Record<string, any>,
): Promise<FlowTurnResult> {
  const missingSlotsHint = flow.slots.map((s) => s.name).filter((name) => knownValues[name] == null);
  const extracted = await flow.extract(customerId, utterance, knownValues, missingSlotsHint);

  const missingRequired = extracted.missingSlots.filter(
    (name) => flow.slots.find((s) => s.name === name)?.required !== false,
  );
  const requiresConfirmation = missingRequired.length > 0 || extracted.confidence !== "HIGH";

  if (requiresConfirmation) {
    const nextSlot = extracted.missingSlots.length > 0
      ? flow.slots.find((s) => s.name === extracted.missingSlots[0])
      : null;
    const askPrompt = nextSlot?.askPrompt ?? "Could you clarify that?";
    return {
      message: askPrompt,
      events: [{ type: "ask_user", prompt: askPrompt }],
      done: false,
      flowKey: flow.key,
      knownValues: extracted.values,
      waitingForSlot: nextSlot?.name ?? null,
      failed: false,
    };
  }

  const commitResult = await flow.commit(customerId, extracted.values);
  if (!commitResult.success) {
    // A failed commit ends the flow rather than looping forever on bad input — the user can
    // just say the command again, which starts fresh.
    return {
      message: commitResult.message,
      events: [],
      done: true,
      flowKey: flow.key,
      knownValues: extracted.values,
      waitingForSlot: null,
      failed: true,
    };
  }

  // Only optional slots can still be missing here (required ones were checked above). The
  // engine — not the flow — authors every event; a flow can redirect *where* via
  // `viewOverride` but never constructs a UIEvent itself.
  const target = commitResult.viewOverride ?? { view: flow.view, params: commitResult.data ?? {} };
  const events: UIEvent[] = [
    { type: "open_view", view: target.view, params: target.params },
    {
      type: "update_state",
      draftKey: flow.draftKey,
      fields: commitResult.data ?? {},
      missingFields: extracted.missingSlots,
      status: "ready",
    },
  ];

  const nextSlot = extracted.missingSlots.length > 0 ? flow.slots.find((s) => s.name === extracted.missingSlots[0]) : null;
  if (nextSlot) {
    events.push({ type: "ask_user", prompt: nextSlot.askPrompt });
  }

  return {
    message: nextSlot ? `${commitResult.message} ${nextSlot.askPrompt}` : commitResult.message,
    events,
    done: !nextSlot,
    flowKey: flow.key,
    knownValues: extracted.values,
    waitingForSlot: nextSlot?.name ?? null,
    failed: false,
  };
}
