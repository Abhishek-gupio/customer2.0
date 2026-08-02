import { UIEvent } from "./types";

/** Adapts the legacy `{screen, params}` navigate shape into an `open_view` event. */
export function fromNavigate(navigate?: { screen: string; params?: Record<string, unknown> } | null): UIEvent[] {
  if (!navigate) return [];
  return [{ type: "open_view", view: navigate.screen, params: navigate.params }];
}

export function askUser(prompt: string): UIEvent {
  return { type: "ask_user", prompt };
}

export function updateState(
  draftKey: string,
  fields: Record<string, unknown>,
  missingFields?: string[],
  status: "pending" | "ready" | "error" = "ready",
): UIEvent {
  return { type: "update_state", draftKey, fields, missingFields, status };
}

/**
 * Same tool -> screen mapping `ai.service.ts`'s `buildNavigationActionsFromToolResults` already
 * uses to build tap-to-open suggestion chips for the general-chat path — mirrored here so a
 * directly-dispatched tool call (see executionEngine.ts) gets the same *auto*-open behavior a
 * flow gets, instead of silently doing nothing on screen. Keep this in sync with that function
 * if either changes; duplicated rather than shared because one drives chips (user must tap)
 * and this one drives immediate navigation (no tap needed) — different UX, same target map.
 */
function screenForToolResult(toolName: string, result: any): { view: string; params?: Record<string, unknown> } | null {
  if (!result || result.success === false) return null;
  switch (toolName) {
    case "get_challans":
    case "sync_challans":
      if (result.vehicle?.id && !result.summary) {
        return { view: "Challans", params: { vehicle: result.vehicle } };
      }
      return { view: "VehicleList" };
    case "list_my_vehicles":
    case "add_vehicle_to_garage":
    case "remove_vehicle_from_garage":
    case "get_vehicle_status":
      // The tool's own response shape doesn't include a vehicle id (just name/odometer/
      // fuel/health per vehicle), so there's nothing to deep-link a single VehicleDetails
      // screen to — VehicleList is the best available target, same as list_my_vehicles.
      return { view: "VehicleList" };
    case "get_driving_trips_summary":
      return result.vehicleId ? { view: "DrivingSummary" } : null;
    case "get_service_history":
      return result.vehicle?.id ? { view: "ServiceHistory" } : null;
    case "get_upcoming_service_parts":
    case "get_or_suggest_parts_interval":
    case "get_maintenance_advisor":
      return { view: "WarrantyStatus" };
    case "get_notifications":
      return { view: "Alerts" };
    case "get_expenses_summary":
      return { view: "Expenses" };
    case "get_profile":
    case "update_profile":
      return { view: "MyProfile" };
    case "list_documents":
    case "get_document_status":
      return { view: "DocumentList" };
    case "list_support_tickets":
      return { view: "TicketHistory" };
    case "get_current_trip_info":
      return { view: "TripExpense" };
    default:
      return null;
  }
}

/**
 * Stable discriminant attached to every tool result sent to the client, so the app can branch on
 * *what happened* without pattern-matching each tool's own result shape.
 *
 * This is load-bearing, not cosmetic: the mobile client gates its write-confirmation copy on
 * these values, and treats their absence as "the write did not happen" — so a tool that performs
 * a user-visible mutation and returns no `kind` makes a successful save report as a failure.
 * Add a case here when adding a mutating tool the client needs to confirm.
 */
export type ToolResultKind = "expense_created" | "profile_updated";

export function kindForToolResult(toolName: string, result: any): ToolResultKind | undefined {
  if (!result || result.success === false) return undefined;
  switch (toolName) {
    case "add_expense":
    case "update_expense":
      return "expense_created";
    case "update_profile":
      return "profile_updated";
    default:
      return undefined;
  }
}

/** A directly-dispatched (non-flow) tool call: patches its data into a draft (keyed by tool name, for any screen that cares to subscribe) and, where the tool maps to one, opens the relevant screen — same auto-navigate behavior a flow gets, not just a reply the user has to act on themselves. */
export function fromToolResult(toolName: string, result: unknown): UIEvent[] {
  const events: UIEvent[] = [{ type: "update_state", draftKey: `tool:${toolName}`, fields: { result }, status: "ready" }];
  const target = screenForToolResult(toolName, result);
  if (target) {
    events.unshift({ type: "open_view", view: target.view, params: target.params });
  }
  return events;
}
