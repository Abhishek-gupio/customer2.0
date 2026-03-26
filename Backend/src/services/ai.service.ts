import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { vectorService } from "./vector.service";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAICacheManager } from "@google/generative-ai/server";
import { env } from "../config/env";
import { toolRegistry } from "./tools.service";
import { voiceService } from "./voice.service";
import { contextService } from "./context.service";
import { analyticsService } from "./analytics.service";
import { AppError } from "../utils/AppError";
import { isGeminiRateLimitError } from "../utils/geminiRateLimit";

const db = dbInstances as any;

// Debug logging for AI tool-call path analysis.
// #region agent log
const DEBUG_LOG_ENDPOINT =
  "http://127.0.0.1:7317/ingest/c1ee2c59-97af-43c3-b8e6-f54db6b420fe";
const DEBUG_SESSION_ID = "3a03a4";
function debugLog(
  location: string,
  hypothesisId: string,
  message: string,
  data: Record<string, unknown>,
) {
  try {
    const _fetch = (globalThis as any).fetch as
      | ((url: string, init: any) => Promise<any>)
      | undefined;
    if (!_fetch) return;
    _fetch(DEBUG_LOG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": DEBUG_SESSION_ID,
      },
      body: JSON.stringify({
        sessionId: DEBUG_SESSION_ID,
        runId: "ai-doc-access-debug",
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  } catch {
    // ignore debug failures
  }
}
// #endregion

const genAI = env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
  : null;
const cacheManager = env.GEMINI_API_KEY
  ? new GoogleAICacheManager(env.GEMINI_API_KEY)
  : null;

// Global singleton to store the current cache name
let activeCache: { name: string; expiry: number } | null = null;

// ============================================================================
// Suggested actions derived from assistant response (for action chips in app)
// ============================================================================
const DEFAULT_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Vehicle Assistant", prompt: "Vehicle Assistant" },
  { label: "Expense Analysis", prompt: "Expense Analysis" },
  { label: "My Support Tickets", prompt: "My Support Tickets" },
  { label: "App Services & SOS", prompt: "App Services & SOS" },
];

function getSuggestedActionsFromText(text: string): { label: string; prompt: string }[] {
  if (!text || typeof text !== "string") return DEFAULT_ACTIONS;
  const lower = text.toLowerCase();
  const score: Record<string, number> = {
    "Vehicle Assistant": 0,
    "Expense Analysis": 0,
    "My Support Tickets": 0,
    "App Services & SOS": 0,
  };
  if (/\b(car|health|mileage|service|parts|odometer|engine|tyre|tire|oil)\b/.test(lower)) score["Vehicle Assistant"] += 2;
  if (/\b(expense|spend|cost|budget|savings|report|fuel|toll|rupee|₹|inr)\b/.test(lower)) score["Expense Analysis"] += 2;
  if (/\b(ticket|issue|complaint|status|bug|error|problem|support|help request)\b/.test(lower)) score["My Support Tickets"] += 2;
  if (/\b(emergency|help|accident|breakdown|stuck|sos|valet|digilocker|rewards)\b/.test(lower)) score["App Services & SOS"] += 2;
  
  const sorted = (Object.entries(score) as [keyof typeof score, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => DEFAULT_ACTIONS.find((a) => a.label === label)!)
    .filter(Boolean);
  const rest = DEFAULT_ACTIONS.filter((a) => !sorted.some((s) => s.label === a.label));
  return [...sorted, ...rest].slice(0, 4);
}

/** Suggested action chip; optional in-app navigation (mobile reads `navigate`). */
export type AISuggestedAction = {
  label: string;
  prompt: string;
  navigate?: { screen: string; params?: Record<string, unknown> };
};

function buildNavigationActionsFromToolResults(
  toolResults: any[] | undefined,
): AISuggestedAction[] {
  if (!toolResults?.length) return [];
  const out: AISuggestedAction[] = [];
  const add = (a: AISuggestedAction) => {
    if (out.some((x) => x.label === a.label && !x.navigate && !a.navigate)) return;
    if (
      a.navigate &&
      out.some(
        (x) =>
          x.navigate?.screen === a.navigate?.screen &&
          JSON.stringify(x.navigate?.params) === JSON.stringify(a.navigate?.params),
      )
    ) {
      return;
    }
    out.push(a);
  };

  for (const tr of toolResults) {
    const tool = tr.tool;
    const res = tr.result;
    if (!res || res.success === false) continue;

    if (tool === "get_challans" && res.vehicle?.id && !res.summary) {
      add({
        label: "Open challans",
        prompt: `Open challans for ${res.vehicle.registrationNumber}`,
        navigate: {
          screen: "Challans",
          params: { vehicle: res.vehicle },
        },
      });
    }
    if (tool === "get_challans" && res.summary) {
      add({
        label: "My Garage",
        prompt: "Open my vehicle list",
        navigate: { screen: "VehicleList" },
      });
    }
    if (tool === "sync_challans" && res.vehicle?.id) {
      add({
        label: "Open challans",
        prompt: `Open challans for ${res.vehicle.registrationNumber}`,
        navigate: {
          screen: "Challans",
          params: { vehicle: res.vehicle },
        },
      });
    }
    if (tool === "get_driving_trips_summary" && res.success && res.vehicleId) {
      add({
        label: "Driving summary",
        prompt: "Show my driving summary",
        navigate: { screen: "DrivingSummary" },
      });
    }
    if (tool === "get_service_history" && res.success && res.vehicle?.id) {
      add({
        label: "Service history",
        prompt: "Open service history",
        navigate: { screen: "ServiceHistory" },
      });
    }
    if (tool === "get_upcoming_service_parts" && res.success && res.vehicle?.id) {
      add({
        label: "Warranty & parts",
        prompt: "Open warranty and parts status",
        navigate: { screen: "WarrantyStatus" },
      });
    }
    if (tool === "add_vehicle_to_garage" && res.success) {
      add({
        label: "My Garage",
        prompt: "Open my garage",
        navigate: { screen: "VehicleList" },
      });
    }
    if (tool === "remove_vehicle_from_garage" && res.success) {
      add({
        label: "My Garage",
        prompt: "Open my garage",
        navigate: { screen: "VehicleList" },
      });
    }
    if (tool === "get_expenses_summary" && res.success) {
      add({
        label: "Expenses",
        prompt: "Open expenses",
        navigate: { screen: "Expenses" },
      });
    }
  }
  return out;
}

function mergeSuggestedActionsWithNavigation(
  textActions: { label: string; prompt: string }[],
  toolResults: any[] | undefined,
): AISuggestedAction[] {
  const nav = buildNavigationActionsFromToolResults(toolResults);
  const merged: AISuggestedAction[] = [
    ...nav,
    ...(textActions || []).map((a) => ({ label: a.label, prompt: a.prompt })),
  ];
  const seen = new Set<string>();
  const deduped: AISuggestedAction[] = [];
  for (const a of merged) {
    const key = a.navigate
      ? `nav:${a.navigate.screen}:${JSON.stringify(a.navigate.params ?? {})}`
      : `lbl:${a.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(a);
  }
  return deduped.slice(0, 8);
}

// ============================================================================
// SYSTEM PROMPT — Enhanced with agent capabilities
// ============================================================================
// ============================================================================
// SYSTEM PROMPT — Gupio AI Support System Framework
// ============================================================================
const SYSTEM_PROMPT = `
MASTER SYSTEM CONTEXT:
You are Gupio AI, an intelligent support assistant for vehicle management and user services. You operate in 4 specialized modes based on user selection or intent. Always access user context (name, vehicle details, history) before responding.

CORE PRINCIPLES FOR ALL MODES:
- Address user by name (available in [USER PROFILE] context)
- Be concise, specific, and action-oriented.
- **SKIP PREAMBLES**: Do not say "I understand" or "I am analyzing." Go straight to the answer/action.
- **NO BROAD ANALYSIS**: Do not describe what you are doing. Simply provide the "user-friendly understandable details" the user needs.
- Confirm before executing actions (tool calls)
- Provide timelines and reference numbers for tickets/services
- Escalate when: user frustrated (2+ times), issue unresolved after 3 attempts, emergency detected
- End with: "Is there anything else I can help you with?"
- NEVER guess, make false promises, or share others' data

=====================================================
MODE 1: VEHICLE ASSISTANT 🚗
=====================================================
TRIGGER: User selects "Vehicle Assistant" or asks about car health, mileage, service, or parts.
CONTEXT ACCESS: [MY GARAGE / VEHICLES], [RECENT EXPENSES], [PENDING ALERTS]
CAPABILITIES:
1. My Garage / fleet: User phrases like "my garage", "what's in my garage", "how many cars" → ALWAYS call 'list_my_vehicles' first (then 'get_vehicle_status' if they want health/odometer detail).
2. Health & Odometer: Use 'get_vehicle_status' and 'get_maintenance_advisor'.
3. Expense Logging: Use 'add_expense' (Fuel, Service, etc.).
4. Service Schedule: Use 'get_or_suggest_parts_interval'.
5. Document Status: Use 'get_document_status' or 'list_documents'.
6. Challans: 'get_challans' (summary or per vehicle); 'sync_challans' only if user asks to refresh from the government/provider API.
7. Driving: 'get_driving_trips_summary' for recent trips, distance, safety (telematics).
8. Service & parts: 'get_service_history', 'get_upcoming_service_parts' for due maintenance.
9. Garage edits: 'add_vehicle_to_garage' when user gives a registration number; 'remove_vehicle_from_garage' ONLY with userConfirmed true after explicit delete confirmation.
10. After fetching challans, driving, service, or expenses, mention the matching Open … chip when available.

=====================================================
MODE 2: EXPENSE ANALYSIS 💰
=====================================================
TRIGGER: User selects "Expense Analysis" or asks about spending, budgets, or savings.
CONTEXT ACCESS: [RECENT EXPENSES], [BUDGETS]
CAPABILITIES:
1. Spend Summary: Use 'get_expenses_summary'.
2. Budget Tracking: Compare [RECENT EXPENSES] with [BUDGETS].
3. Savings Tips: Use 'get_smart_recommendations'.
4. Report Export: Use 'get_expense_report'.
PATTERN RECOGNITION:
- Alert if fuel spend > 25% of monthly total.
- Suggest service if 'OTHER' expenses for parts increase.

=====================================================
MODE 3: MY SUPPORT TICKETS 🎫
=====================================================
TRIGGER: User selects "My Support Tickets" or asks about issues, complaints, or status.
CONTEXT ACCESS: [ACTIVE SUPPORT TICKETS]
CAPABILITIES:
1. Ticket Status: Use 'list_support_tickets'.
2. Details: Use 'get_ticket_details'.
3. New Issue: Use 'create_support_ticket'.
4. Reply: Use 'add_ticket_message'.
CHECK BASICS: If reporting a bug, ask: "Let me check - you're using [Platform] on [Device Info]. Is that correct?" (Refer to [DEVICE INFO]).

=====================================================
MODE 4: APP SERVICES & SOS 🆘
=====================================================
TRIGGER: User selects "App Services & SOS" or mentions Emergency, Help, Accident, Breakdown, or SOS info.
CONTEXT ACCESS: [USER PROFILE], [VEHICLES]
CAPABILITIES:
1. SOS Activation: If "HELP" or "ACCIDENT" detected, IMMEDIATELY ask: "Emergency detected. Should I trigger SOS to your contacts and find roadside assistance?"
2. SOS Explanation: If user asks how SOS works, explain clearly:
   - "I'll instantly alert your trusted emergency contacts via SMS, Email, and Voice call."
   - "They'll receive your real-time GPS location and a Google Maps link to find you."
   - "I can also find the nearest Hospitals, Police Stations, or Mechanics based on your situation."
   - "You'll get a confirmation email once the alerts are successfully broadcasted."
3. DigiLocker Sync: Explain how to upload docs.
4. Feature Help: Explain Valet, Rewards, or Profile settings.
URGENCY OVERRIDE: Any mention of "Emergency", "Stuck", "Accident", or "Help" must trigger Mode 4 regardless of previous mode.
GUIDELINE: Avoid robotic "analysis" of the situation. Be empathetic, clear, and reassure the user that Gupio is here to help. Use bullet points for clarity when explaining processes.


=====================================================
MODE 5: TRIP PLANNER 🗺️
=====================================================
TRIGGER: User asks about trip costs, tolls, arrival times, or "my journey".
CONTEXT ACCESS: [PLANNED TRIPS]
CAPABILITIES:
1. Trip Knowledge: Use 'get_current_trip_info' to access the latest calculated trip, including total costs, fuel, and specific toll plazas.
2. Real-time Queries: Answer "How much is the next toll?" or "What's my estimated fuel cost?" using the tool's 'nextTolls' and 'totalCost' fields.
3. Suggestion: If no trip is found, politely suggest: "I don't see an active trip. You can plan your journey in the Trip Expense screen, and I'll keep track of it for you."

PATTERN RECOGNITION & PROACTIVE ASSISTANCE
=====================================================
- If a document is expired in [PENDING ALERTS], offer to help upload a new one.
- If health score < 50%, suggest booking a service.
- If budget exceeded, suggest fuel saving tips.
- If a trip is planned, mention the "Open Trip" chip to view the interactive map.
`;

export const aiService = {
  /**
   * Convert our tool registry to Gemini's native function declarations for Caching
   */
  getFunctionDeclarations() {
    return Object.values(toolRegistry).map((t) => {
      const properties: any = {};
      const required: string[] = [];

      for (const [key, desc] of Object.entries(t.parameters)) {
        const description = desc as string;
        const isRequired = description.toLowerCase().includes("required");
        const type = description.toLowerCase().includes("number")
          ? "NUMBER"
          : "STRING";

        properties[key] = {
          type,
          description: description.replace("(required)", "").trim(),
        };
        if (isRequired) required.push(key);
      }

      return {
        name: t.name,
        description: t.description,
        parameters: {
          type: "OBJECT",
          properties,
          required: required.length > 0 ? required : undefined,
        },
      };
    });
  },

  /**
   * Get or Create a Context Cache for the System Prompt + Tools
   * This saves 70% of tokens by freezing the base logic.
   */
  async getOrUpdateCache() {
    if (!cacheManager) return null;

    const now = Date.now();
    if (activeCache && activeCache.expiry > now + 300000) {
      return activeCache.name;
    }

    try {
      logger.info("Creating new Gemini Context Cache for Gupio Tools...");
      const declarations = this.getFunctionDeclarations();

      const cache = await cacheManager.create({
        model: "gemini-2.0-flash",
        displayName: "gupio-base-logic",
        systemInstruction: SYSTEM_PROMPT,
        contents: [],
        tools: [{ functionDeclarations: declarations } as any],
        ttlSeconds: 3600,
      });

      activeCache = {
        name: cache.name!,
        expiry: now + 3600 * 1000,
      };

      return cache.name!;
    } catch (error) {
      // Graceful fallback: if cache fails (e.g., content too small < 4096 tokens),
      // continue without caching — the model will use system instructions inline.
      logger.debug({ error }, "Context cache creation failed, using inline mode");
      return null;
    }
  },

  /**
   * Get Gemini model — uses cached version if available, otherwise inline system prompt + tools
   */
  getModel(cacheName: string | null) {
    if (!genAI) throw new Error("AI not configured");

    if (cacheName) {
      return genAI.getGenerativeModel(
        { model: "gemini-2.0-flash", cachedContent: cacheName } as any,
        { apiVersion: "v1beta" },
      );
    }

    // Fallback: inline system instructions and tools
    const declarations = this.getFunctionDeclarations();
    return genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: declarations } as any],
    } as any);
  },

  // ==========================================================================
  // FEATURE 3: Conversation Memory — Summarize old messages
  // ==========================================================================
  async maybeSummarizeSession(sessionId: string) {
    const messageCount = await db.chatMessage.count({
      where: { sessionId },
    });

    if (messageCount <= 20) return; // Not enough messages to summarize

    const session = await db.chatSession.findUnique({
      where: { id: sessionId },
      select: { summary: true },
    });

    // Get messages beyond the last 10 (these are the "old" ones to summarize)
    const oldMessages = await db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: messageCount - 10,
      select: { role: true, content: true },
    });

    if (oldMessages.length < 10) return;

    const conversationText = oldMessages
      .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    if (!genAI) return;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(
        `Summarize this conversation concisely, keeping key facts, user preferences, and decisions. 
Previous summary: ${session?.summary || "None"}

Conversation:
${conversationText}

Write a concise summary (max 200 words) capturing all important details.`,
      );

      const summary = result.response.text().trim();

      await db.chatSession.update({
        where: { id: sessionId },
        data: { summary },
      });

      logger.info({ sessionId }, "Session summarized successfully");
    } catch (error) {
      logger.error({ error, sessionId }, "Session summarization failed");
    }
  },

  // ==========================================================================
  // BUILD PROMPT — Shared prompt builder for chat / stream / agent
  // ==========================================================================
  buildPrompt(opts: {
    contextText: string;
    chatHistory: string;
    userContext: string;
    sessionSummary?: string;
    message: string;
  }): string {
    const parts: string[] = [];

    // Personalization (Feature 7)
    if (opts.userContext) {
      parts.push(`USER PROFILE & DATA:\n${opts.userContext}`);
    }

    // RAG context
    if (opts.contextText) {
      parts.push(`RELEVANT RECORDS (from knowledge base):\n${opts.contextText}`);
    }

    // Conversation memory (Feature 3)
    if (opts.sessionSummary) {
      parts.push(`CONVERSATION SUMMARY (older messages):\n${opts.sessionSummary}`);
    }

    // Recent history
    if (opts.chatHistory) {
      parts.push(`RECENT CONVERSATION:\n${opts.chatHistory}`);
    }

    parts.push(`USER MESSAGE: ${opts.message}`);

    return parts.join("\n\n");
  },

  // ==========================================================================
  // FEATURE 2: Multi-turn Function Calling — Execute tools in a loop
  // ==========================================================================
  async executeToolLoop(
    model: any,
    initialPrompt: string,
    customerId: string,
    maxIterations: number = 5,
  ): Promise<{
    responseText: string;
    toolResults: any[];
    iterations: number;
  }> {
    let currentPrompt = initialPrompt;
    const toolResults: any[] = [];
    let responseText = "";
    let iterations = 0;

    for (let i = 0; i < maxIterations; i++) {
      iterations++;
      const result = await model.generateContent(currentPrompt);
      const candidate = result.response.candidates?.[0];
      const functionCalls = candidate?.content.parts.filter(
        (p: any) => p.functionCall,
      );

      debugLog(
        "ai.service.ts:executeToolLoop",
        "H1_H5",
        "function_calls_detected",
        {
          iteration: i + 1,
          functionCallCount: functionCalls?.length || 0,
        },
      );

      // If no function calls, we have the final text answer
      if (!functionCalls || functionCalls.length === 0) {
        responseText = result.response.text();
        break;
      }

      // Execute all function calls in this turn
      const callResults: string[] = [];
      for (const fc of functionCalls) {
        const call = fc.functionCall!;
        const tool = toolRegistry[call.name as keyof typeof toolRegistry];
        if (tool) {
          debugLog(
            "ai.service.ts:executeToolLoop",
            "H2_H4",
            "tool_execute_start",
            {
              tool: call.name,
              argsKeys: call.args ? Object.keys(call.args).slice(0, 8) : [],
            },
          );
          logger.info(
            { tool: call.name, args: call.args, iteration: i + 1 },
            "Executing Tool (multi-turn)",
          );
          try {
            const result = await tool.execute(customerId, call.args);
            toolResults.push({ tool: call.name, args: call.args, result });
            const res = result as any;

            debugLog(
              "ai.service.ts:executeToolLoop",
              "H2_H4",
              "tool_execute_success",
              {
                tool: call.name,
                success: (res as any)?.success,
                error: (res as any)?.error,
                documentsCount:
                  call.name === "get_document_status" && Array.isArray((res as any)?.documents)
                    ? (res as any).documents.length
                    : undefined,
              },
            );

            callResults.push(
              `Tool ${call.name} result: ${res?.message || JSON.stringify(result)}`,
            );
          } catch (err) {
            callResults.push(`Tool ${call.name} failed: ${err}`);

            debugLog(
              "ai.service.ts:executeToolLoop",
              "H2_H4",
              "tool_execute_error",
              { tool: call.name, error: String(err) },
            );
          }
        }
      }

      // Feed tool results back into the next prompt
      currentPrompt = `${initialPrompt}\n\nTOOL RESULTS:\n${callResults.join("\n")}\n\nBased on these tool results, provide a final direct and user-friendly answer. If you need more tools, call them. Otherwise, respond with text.`;
    }

    // If we ran out of iterations without a text answer
    if (!responseText && toolResults.length > 0) {
      responseText = toolResults
        .map((tr) => (tr.result as any)?.message || `Completed ${tr.tool}`)
        .join(". ");
    }

    return { responseText, toolResults, iterations };
  },

  // ==========================================================================
  // CORE CHAT — Enhanced with all features
  // ==========================================================================
  async chat(
    customerId: string,
    message: string,
    sessionId?: string,
    imageBuffer?: Buffer,
    mimeType?: string,
    agentMode?: boolean,
  ) {
    const startTime = Date.now();

    // 🚀 PARALLEL INIT: Cache + Session + Vector + User Context
    const [cacheName, sessionData, contextDocs, userContext] =
      await Promise.all([
        this.getOrUpdateCache(),
        sessionId
          ? db.chatSession.findUnique({
            where: { id: sessionId, customerId },
            include: {
              messages: { orderBy: { createdAt: "asc" } },
            },
            // Select summary for memory
          })
          : db.chatSession.create({
            data: {
              customerId,
              title: message.substring(0, 50),
              messages: { create: [] },
            },
            include: { messages: true },
          }),
        vectorService.hybridSearch(customerId, message, 5).catch(() => []),
        contextService.buildUserContext(customerId),
      ]);

    const session = sessionData as any;
    const finalSessionId = session.id;

    // Build context text from RAG results
    const contextText = contextDocs
      .map((doc: any) => `[${doc.entityType}] ${doc.content}`)
      .join("\n\n");

    // Chat history — last 10 messages
    const chatHistory = (session.messages || [])
      .slice(-10)
      .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    // Build model (uses cache if available, inline mode otherwise)
    const model = this.getModel(cacheName);

    // Build prompt with all context
    const userPrompt = this.buildPrompt({
      contextText,
      chatHistory,
      userContext,
      sessionSummary: session.summary || undefined,
      message,
    });

    try {
      // Build content parts (text + optional image)
      const parts: any[] = [{ text: userPrompt }];

      // Feature 5: Multimodal — add image if provided
      if (imageBuffer && mimeType) {
        parts.push({
          inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType,
          },
        });
      }

      let responseText = "";
      let allToolResults: any[] = [];
      let agentSteps: any[] = [];

      if (agentMode) {
        // Feature 8: Agent Mode (ReAct loop)
        const agentResult = await this.chatAgent(
          model,
          parts,
          customerId,
        );
        responseText = agentResult.responseText;
        allToolResults = agentResult.toolResults;
        agentSteps = agentResult.steps;
      } else {
        // Feature 2: Multi-turn function calling
        const result = await model.generateContent(parts);
        responseText = result.response.text();

        const candidate = result.response.candidates?.[0];
        const functionCalls = candidate?.content.parts.filter(
          (p: any) => p.functionCall,
        );

        if (functionCalls && functionCalls.length > 0) {
          // Multi-turn tool execution
          const toolLoopResult = await this.executeToolLoop(
            model,
            userPrompt,
            customerId,
          );
          responseText = toolLoopResult.responseText;
          allToolResults = toolLoopResult.toolResults;
        }
      }

      // 🚀 BACKGROUND SIDE-EFFECTS (fire-and-forget)
      const responseTimeMs = Date.now() - startTime;

      // Generate voice ONCE and reuse it for:
      // 1) saving the assistant message metadata (background logging)
      // 2) returning `voiceUrl` to the client
      const voiceUrl = await voiceService.generateSpeechUrl(responseText);

      (async () => {
        await db.$transaction([
          db.chatMessage.create({
            data: {
              sessionId: finalSessionId,
              role: "user",
              content: message,
              metadata: imageBuffer ? { hadImage: true, mimeType } : undefined,
            },
          }),
          db.chatMessage.create({
            data: {
              sessionId: finalSessionId,
              role: "assistant",
              content: responseText,
              metadata: {
                ...(allToolResults.length > 0
                  ? { toolResults: allToolResults }
                  : {}),
                ...(agentSteps.length > 0 ? { agentSteps } : {}),
                voiceUrl,
              },
            },
          }),
        ]);

        // Feature 3: Auto-summarize if session is long
        await this.maybeSummarizeSession(finalSessionId);

        // Feature 10: Track analytics
        await analyticsService.trackInteraction({
          customerId,
          sessionId: finalSessionId,
          toolName: allToolResults[0]?.tool || undefined,
          responseTimeMs,
          hadToolCall: allToolResults.length > 0,
          hadImage: !!imageBuffer,
          wasStreaming: false,
        });
      })().catch((err) =>
        logger.error({ err }, "Background chat logging failed"),
      );

      return {
        sessionId: finalSessionId,
        message: responseText,
        voiceUrl,
        contextUsed: contextDocs.length,
        toolResults:
          allToolResults.length > 0 ? allToolResults : undefined,
        agentSteps: agentSteps.length > 0 ? agentSteps : undefined,
        suggestedActions: mergeSuggestedActionsWithNavigation(
          getSuggestedActionsFromText(responseText),
          allToolResults,
        ),
      };
    } catch (error) {
      if (isGeminiRateLimitError(error)) {
        logger.warn({ error }, "AI Chat generation hit Gemini rate limit");
        throw AppError.tooManyRequests(
          "AI is busy. Please try again in a moment.",
          "GEMINI_RATE_LIMIT"
        );
      }
      logger.error({ error }, "AI Chat generation failed");
      throw new Error("Failed to generate response");
    }
  },

  // ==========================================================================
  // FEATURE 1: Streaming Chat (SSE)
  // ==========================================================================
  async *chatStream(
    customerId: string,
    message: string,
    sessionId?: string,
    imageBuffer?: Buffer,
    mimeType?: string,
  ): AsyncGenerator<string> {
    const startTime = Date.now();

    const [cacheName, sessionData, contextDocs, userContext] =
      await Promise.all([
        this.getOrUpdateCache(),
        sessionId
          ? db.chatSession.findUnique({
            where: { id: sessionId, customerId },
            include: { messages: { orderBy: { createdAt: "asc" } } },
          })
          : db.chatSession.create({
            data: {
              customerId,
              title: message.substring(0, 50),
              messages: { create: [] },
            },
            include: { messages: true },
          }),
        vectorService.hybridSearch(customerId, message, 5).catch(() => []),
        contextService.buildUserContext(customerId),
      ]);

    const session = sessionData as any;
    const finalSessionId = session.id;

    const contextText = contextDocs
      .map((doc: any) => `[${doc.entityType}] ${doc.content}`)
      .join("\n\n");
    const chatHistory = (session.messages || [])
      .slice(-10)
      .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    // Build model (uses cache if available, inline mode otherwise)
    const model = this.getModel(cacheName);

    const userPrompt = this.buildPrompt({
      contextText,
      chatHistory,
      userContext,
      sessionSummary: session.summary || undefined,
      message,
    });

    // Build content parts
    const parts: any[] = [{ text: userPrompt }];
    if (imageBuffer && mimeType) {
      parts.push({
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType,
        },
      });
    }

    // Yield the session ID first
    yield JSON.stringify({ type: "session", sessionId: finalSessionId });

    try {
      const result = await model.generateContentStream(parts);
      let fullResponse = "";
      let toolResults: any[] = [];

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullResponse += text;
          yield JSON.stringify({ type: "chunk", text });
        }

        // Check for function calls in the stream
        const candidate = chunk.candidates?.[0];
        const functionCalls = candidate?.content.parts.filter(
          (p: any) => p.functionCall,
        );

        if (functionCalls && functionCalls.length > 0) {
          for (const fc of functionCalls) {
            const call = fc.functionCall!;
            const tool =
              toolRegistry[call.name as keyof typeof toolRegistry];
            if (tool) {
              debugLog(
                "ai.service.ts:chatStream",
                "H1_H5",
                "tool_execute_start",
                {
                  tool: call.name,
                  argsKeys: call.args ? Object.keys(call.args).slice(0, 8) : [],
                },
              );
              yield JSON.stringify({
                type: "tool_start",
                tool: call.name,
              });

              try {
                const toolResult = await tool.execute(
                  customerId,
                  call.args,
                );
                toolResults.push({
                  tool: call.name,
                  args: call.args,
                  result: toolResult,
                });
                const res = toolResult as any;
                const toolMessage =
                  res?.message || `Completed ${call.name}`;
                fullResponse += ` ${toolMessage}`;

                debugLog(
                  "ai.service.ts:chatStream",
                  "H2_H4",
                  "tool_execute_success",
                  {
                    tool: call.name,
                    success: res?.success,
                    error: res?.error,
                    documentsCount:
                      call.name === "get_document_status" && Array.isArray(res?.documents)
                        ? res.documents.length
                        : undefined,
                  },
                );

                yield JSON.stringify({
                  type: "tool_result",
                  tool: call.name,
                  message: toolMessage,
                  result: toolResult,
                });
              } catch (err) {
                debugLog(
                  "ai.service.ts:chatStream",
                  "H2_H4",
                  "tool_execute_error",
                  { tool: call.name, error: String(err) },
                );
                yield JSON.stringify({
                  type: "tool_error",
                  tool: call.name,
                  error: String(err),
                });
              }
            }
          }
        }
      }

      // Generate voice URL for the complete response
      const voiceUrl =
        await voiceService.generateSpeechUrl(fullResponse);

      const suggestedActions = mergeSuggestedActionsWithNavigation(
        getSuggestedActionsFromText(fullResponse),
        toolResults,
      );
      yield JSON.stringify({
        type: "done",
        voiceUrl,
        contextUsed: contextDocs.length,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        suggestedActions,
      });

      // Background: save messages + analytics
      const responseTimeMs = Date.now() - startTime;
      (async () => {
        await db.$transaction([
          db.chatMessage.create({
            data: {
              sessionId: finalSessionId,
              role: "user",
              content: message,
            },
          }),
          db.chatMessage.create({
            data: {
              sessionId: finalSessionId,
              role: "assistant",
              content: fullResponse,
              metadata: {
                ...(toolResults.length > 0 ? { toolResults } : {}),
                voiceUrl,
              },
            },
          }),
        ]);

        await this.maybeSummarizeSession(finalSessionId);

        await analyticsService.trackInteraction({
          customerId,
          sessionId: finalSessionId,
          toolName: toolResults[0]?.tool || undefined,
          responseTimeMs,
          hadToolCall: toolResults.length > 0,
          hadImage: !!imageBuffer,
          wasStreaming: true,
        });
      })().catch((err) =>
        logger.error({ err }, "Background stream logging failed"),
      );
    } catch (error) {
      if (isGeminiRateLimitError(error)) {
        logger.warn({ error }, "AI Stream hit Gemini rate limit");
        yield JSON.stringify({
          type: "error",
          message: "AI is busy. Please try again in a moment.",
          code: "GEMINI_RATE_LIMIT",
        });
        return;
      }
      logger.error({ error }, "AI Stream generation failed");
      yield JSON.stringify({ type: "error", message: "Stream failed" });
    }
  },

  // ==========================================================================
  // FEATURE 8: Agent Mode — ReAct Loop (Think → Act → Observe → repeat)
  // ==========================================================================
  async chatAgent(
    model: any,
    initialParts: any[],
    customerId: string,
    maxIterations: number = 5,
  ): Promise<{
    responseText: string;
    toolResults: any[];
    steps: any[];
  }> {
    const steps: any[] = [];
    const toolResults: any[] = [];
    let conversationParts = [...initialParts];

    for (let i = 0; i < maxIterations; i++) {
      const stepStart = Date.now();

      // Add reasoning instruction
      const thinkPrompt = [
        ...conversationParts,
        {
          text: `\n\n[Step ${i + 1}/${maxIterations}] Think about what to do next. Be direct and skip robotic analysis. If you have all the information needed, provide the final direct and user-friendly answer as text. If you need data, call the appropriate tool.`,
        },
      ];

      const result = await model.generateContent(thinkPrompt);
      const candidate = result.response.candidates?.[0];
      const functionCalls = candidate?.content.parts.filter(
        (p: any) => p.functionCall,
      );

      // No function call → final answer
      if (!functionCalls || functionCalls.length === 0) {
        const finalText = result.response.text();
        steps.push({
          step: i + 1,
          type: "final_answer",
          text: finalText,
          durationMs: Date.now() - stepStart,
        });
        return { responseText: finalText, toolResults, steps };
      }

      // Execute tools and record observations
      for (const fc of functionCalls) {
        const call = fc.functionCall!;
        const tool = toolRegistry[call.name as keyof typeof toolRegistry];

        if (tool) {
          logger.info(
            { tool: call.name, args: call.args, step: i + 1 },
            "Agent: executing tool",
          );

          try {
            const toolResult = await tool.execute(customerId, call.args);
            toolResults.push({
              tool: call.name,
              args: call.args,
              result: toolResult,
            });
            const observation =
              (toolResult as any)?.message ||
              JSON.stringify(toolResult);

            steps.push({
              step: i + 1,
              type: "tool_call",
              tool: call.name,
              args: call.args,
              observation,
              durationMs: Date.now() - stepStart,
            });

            // Feed observation back
            conversationParts.push({
              text: `\n\n[Observation from ${call.name}]: ${observation}`,
            });
          } catch (err) {
            const errorMsg = `Tool ${call.name} failed: ${err}`;
            steps.push({
              step: i + 1,
              type: "tool_error",
              tool: call.name,
              error: errorMsg,
              durationMs: Date.now() - stepStart,
            });
            conversationParts.push({
              text: `\n\n[Error from ${call.name}]: ${errorMsg}`,
            });
          }
        }
      }
    }

    // Max iterations reached — ask for final summary
    const summaryResult = await model.generateContent([
      ...conversationParts,
      {
        text: "\n\nYou have reached the maximum number of steps. Provide a final comprehensive answer based on all the information gathered so far.",
      },
    ]);

    const finalText = summaryResult.response.text();
    steps.push({ step: maxIterations + 1, type: "forced_summary", text: finalText });

    return { responseText: finalText, toolResults, steps };
  },

  // ==========================================================================
  // History & Sessions — unchanged
  // ==========================================================================
  async getHistory(customerId: string, sessionId: string) {
    return db.chatSession.findUnique({
      where: { id: sessionId, customerId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  },

  async listSessions(customerId: string) {
    return db.chatSession.findMany({
      where: { customerId, isActive: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true },
    });
  },

  // ==========================================================================
  // AI DRIVING COACH — unchanged
  // ==========================================================================
  async generateDrivingCoachAdvice(events: any[], context: any) {
    if (!genAI) throw new Error("AI not configured");

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
            You are a friendly, calm driving instructor.
            Analyze these recent driving events from the last 5 minutes:
            ${JSON.stringify(events)}

            Context:
            - Speed: ${context.currentSpeed || "Unknown"} km/h
            - Weather: ${context.weather || "Unknown"}
            - Time: ${new Date().toLocaleTimeString()}

            Task:
            Generate a SINGLE, SHORT sentence (max 15 words) of advice to help the driver improve safety.
            It will be spoken via Text-to-Speech, so make it natural and encouraging.
            If no serious events, say something positive like "You're driving smoothly, keep it up!".
            
            Crucial:
            - No "Hello" or greetings.
            - No generic safety slogans like "Safety first".
            - Be specific to the events (e.g. "Try to brake more gently").
        `;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      logger.error({ error }, "AI Coach generation failed");
      return "Drive safely and maintain a steady speed.";
    }
  },
};
