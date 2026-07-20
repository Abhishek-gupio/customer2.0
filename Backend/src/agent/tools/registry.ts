import { toolRegistry } from "../../services/tools.service";
import { ToolDefinition } from "../types";

/**
 * A Layer-6 "Tool Layer" view over the existing tool registry in services/tools.service.ts —
 * deliberately a thin wrapper, not a copy. `ai.service.ts`'s Gemini function-calling loop reads
 * `toolRegistry` directly and is unmodified in this pass; duplicating every tool's business
 * logic into a second registry here would create two sources of truth for the same 23
 * capabilities. This file only adds what Layer 6 needs on top: a category per tool and a cheap
 * keyword-based shortlist, both derived from the one real registry.
 */
const CATEGORY_BY_TOOL: Record<string, string> = {
  add_expense: "expense",
  update_expense: "expense",
  set_budget: "expense",
  get_expenses_summary: "expense",
  get_expense_report: "expense",
  get_vehicle_status: "vehicle",
  list_my_vehicles: "vehicle",
  add_vehicle_to_garage: "vehicle",
  remove_vehicle_from_garage: "vehicle",
  get_maintenance_advisor: "maintenance",
  get_or_suggest_parts_interval: "maintenance",
  get_service_history: "maintenance",
  get_upcoming_service_parts: "maintenance",
  get_document_status: "document",
  list_documents: "document",
  get_smart_recommendations: "insights",
  get_profile: "profile",
  update_profile: "profile",
  get_notifications: "notification",
  mark_notification_read: "notification",
  get_current_trip_info: "trip",
  list_support_tickets: "support",
  get_ticket_details: "support",
  create_support_ticket: "support",
  add_ticket_message: "support",
  get_challans: "compliance",
  sync_challans: "compliance",
  get_driving_trips_summary: "telematics",
  get_trip_detail_by_id: "telematics",
};

export const TOOLS: ToolDefinition[] = Object.values(toolRegistry).map((tool) => ({
  ...tool,
  category: CATEGORY_BY_TOOL[tool.name] ?? "general",
}));

const toolByName = new Map(TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): ToolDefinition | undefined {
  return toolByName.get(name);
}

/**
 * Pragmatic "dynamic discovery": rather than every prompt enumerating all tools, shortlist by
 * keyword overlap between the query and each tool's name/description/category. Cheap, no
 * embedding infra required, good enough at ~30 tools — revisit with real embedding-based
 * retrieval only once the catalog grows much larger.
 */
export function shortlistTools(query: string, max = 8): ToolDefinition[] {
  const terms = query.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  if (terms.length === 0) return TOOLS.slice(0, max);

  const scored = TOOLS.map((tool) => {
    const haystack = `${tool.name} ${tool.description} ${tool.category}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (term.length < 3) continue;
      if (haystack.includes(term)) score += 1;
    }
    return { tool, score };
  });

  const withScore = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  if (withScore.length === 0) return TOOLS.slice(0, max);
  return withScore.slice(0, max).map((s) => s.tool);
}
