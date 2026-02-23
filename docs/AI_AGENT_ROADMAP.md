# AI Agent Roadmap for Gupio

This document maps your **existing Gupio codebase** to the 5-stage AI agent development plan and shows how each stage helps your project.

---

## Summary: Can You Implement This? **Yes — You Already Have Most of It**

Your project **Gupio** (vehicle + expense tracking with receipt/voice/SMS input) already implements:

- **Chat API** with session memory and RAG over expenses/documents/vehicles  
- **Gemini** for LLM + embeddings (vector search via pgvector)  
- **Tool calling** (add/update expense, vehicle status, spending summary, document status, maintenance advisor, savings tips)  
- **Ingestion pipeline** that feeds new expenses/documents/vehicles into vector memory  

The roadmap below shows **what you have**, **what’s missing**, and **concrete next steps** for each stage.

---

## Stage 1: Learning & Exploration (Month 1–3)

| Item | Your status | How it helps Gupio |
|------|-------------|--------------------|
| Study Python, ML, NLP, transformers | Optional for your stack (you use TypeScript + Gemini) | Deepens prompt design and when to use RAG vs tools |
| Read docs: OpenAI, Hugging Face, **LangChain** | You use **Gemini API** directly; LangChain not required | LangChain/LangGraph useful if you add a **multi-step agent loop** later |
| Mini-projects: fine-tune classifier, generate text | You already do **prompt-based parsing** (e.g. `parseExpenseNotification`, document OCR) | Solid foundation for “AI that understands Indian SMS/UPI and documents” |

**Next steps**

- Keep using Gemini docs + your existing prompts as the main learning source.  
- If you plan a **ReAct-style loop** (Stage 3), skim LangChain/LangGraph for the “graph of nodes” pattern; you can still implement the loop with Gemini + your own orchestration.

---

## Stage 2: Prototype a Basic Chatbot (Month 4–5)

| Item | Your status | How it helps Gupio |
|------|-------------|--------------------|
| Minimal agent: user input → LLM with static prompt | ✅ **Done** — `ai.service.chat()` + Gemini + system instruction | Core of your in-app “assistant” |
| Rule-based layer (greetings, FAQs) | ⚠️ **Optional** | Saves LLM calls for “Hi”, “What can you do?” — can add keyword triggers in `chat.controller` or before calling `aiService.chat` |
| Framework (e.g. LangChain ConversationChain) | ✅ **Custom equivalent** — session in DB, last 10 messages in prompt | You have conversation continuity without LangChain |
| Test with users | Your decision | Use Mobile chat screen + internal testers to find gaps |

**Next steps**

- Add a **simple rule layer**: if `message` matches greetings/FAQs (e.g. “hi”, “help”), return a fixed response and skip `aiService.chat`.  
- Document 5–10 example prompts (e.g. “Add 500 fuel at Shell”, “How much did I spend this month?”) and run them manually to confirm tool calls and RAG.

---

## Stage 3: Build Core Components (Month 6–9)

### 3.1 LLM and Prompting

| Your status | Notes |
|-------------|--------|
| ✅ System + user prompts | `getOrUpdateCache()` holds system instruction; user gets RAG context + history + message |
| ✅ Model choice | `gemini-1.5-flash-002` for chat (with caching); `gemini-2.0-flash` for OCR/parsing |
| ⚠️ Temperature / “stronger for complex” | Not explicitly set; you can add `temperature: 0.2` for stable tool use and `0.7` for creative tips |

**Next steps**

- In `ai.service.ts`, set `generationConfig: { temperature: 0.2 }` (or similar) for the cached model.  
- If you add a “complex reasoning” path later, consider a separate call with a stronger model (e.g. Gemini 1.5 Pro) and higher temperature only when needed.

### 3.2 Memory

| Type | Your status | How it helps Gupio |
|------|-------------|--------------------|
| **Conversational** | ✅ Last 10 messages per session in prompt | User can say “Update that one to 600” and the model has context |
| **Long-term RAG** | ✅ `vectorService.searchSimilar()` + `ingestionService` (expenses, documents, vehicles) | “How much did I spend on my Brezza?” uses ingested data |

**Next steps**

- Ensure every **new expense/document/vehicle** is ingested (you already call `ingestionService.ingestExpense` on create).  
- Optionally add **summary memory** (e.g. weekly digest or user preferences) as another embeddable chunk for RAG.

### 3.3 Tools and Actions

| Your status | How it helps Gupio |
|-------------|--------------------|
| ✅ **Tools defined** | `toolRegistry`: add_expense, update_expense, get_vehicle_status, set_budget, get_expenses_summary, get_maintenance_advisor, get_document_status, get_smart_recommendations |
| ✅ **Secure interface** | Parameters and validation inside each `execute()`; customerId from auth |
| ✅ **Agent decides when to call** | Gemini native function calling in `ai.service.chat()` |

**Next steps**

- Add **rate limits or caps** (e.g. max expenses per day via tool) if needed.  
- Consider one more tool, e.g. **“list_my_vehicles”** (or ensure `get_vehicle_status` with no args is clearly described) so the model can list vehicles before acting.

### 3.4 Agent Logic (Loop)

| Your status | Gap |
|-------------|-----|
| ✅ **Single-turn tool use** | User message → RAG + history → LLM → **one** optional tool call → response |
| ❌ **ReAct-style loop** | No “Plan → Act (tool) → Evaluate → repeat” with multiple tool calls in one turn |

**How it helps Gupio**

- Current: “Add 500 fuel for my Brezza” → one `add_expense` call → done.  
- With a loop: “Compare my fuel spend with last month and set a budget” → `get_expenses_summary` (this month) → `get_expenses_summary` (last month) → `set_budget` → natural language summary.

**Next steps**

- **Option A (simplest):** Keep single-tool-per-turn; many flows already work.  
- **Option B (full agent):** In `ai.service.chat()`, after a tool call, **re-submit** to the model with the tool result and ask for the next step (or final answer); repeat until the model returns text with no function call (or max 3–5 steps). This gives a ReAct-style loop without LangGraph.  
- **Option C:** Introduce LangGraph (or similar) and represent the agent as a graph (prompt → tool → prompt) for clearer control and observability.

---

## Stage 4: Testing & Evaluation (Month 9–10)

| Item | Your status | How it helps Gupio |
|------|-------------|--------------------|
| Test suite (20–100 queries) | ❌ Not present | Prevents regressions when you change prompts or models |
| Automated checks | ❌ No test framework found in Backend | Catch broken tool calls or wrong categories |
| Metric tracking | ❌ | Track “correct expense added”, “correct document answer”, user satisfaction |
| Bias & safety | ❌ | Refuse off-topic or harmful requests; stay within vehicle/expense scope |

**Next steps**

1. **Curate 30–50 test prompts** covering:  
   - Add/update expense (voice-style), spending summary, vehicle status, document status, budget, savings tips.  
   - Edge cases: “I received 500” (should not add as expense), “What’s the weather?” (should decline or redirect).
2. **Define pass/fail**: e.g. “add 500 fuel at Shell” → expense exists with amount 500, category FUEL, merchant contains “Shell”.
3. **Implement a runner** (e.g. Node script or Jest) that calls `POST /api/v1/chat` (and optionally expense APIs) with test user + fixtures, then asserts on DB or response.
4. **Guardrails**: In system instruction or a pre-step, add: “Only answer questions about the user’s vehicles, expenses, documents, and driving. Refuse other topics politely.”

---

## Stage 5: Deployment & Scaling (Month 10–12+)

| Item | Your status | How it helps Gupio |
|------|-------------|--------------------|
| Containerization | ❌ No Dockerfile found | Consistent dev/staging/prod; easier scaling |
| Cloud deployment | Your choice (e.g. ECS, Cloud Run) | Host Backend + run jobs (weekly digest, ingestion) |
| API / UI | ✅ REST `POST /api/v1/chat`; Mobile can call it | Chat UI in app is the main interface |
| Monitoring & logging | ✅ `logger` in place | Add **tracing** (e.g. OpenTelemetry) for full request → RAG → LLM → tool flow |
| Scaling | Not verified | Per-user session and RAG are already isolated by `customerId` |
| Security | ✅ Auth, customer-scoped queries | Add per-tool audit log and keep secrets in env |

**Next steps**

1. **Docker**: Add a `Dockerfile` for the Backend (Node, pnpm, run `server.ts`).  
2. **CI/CD**: Run lint + test suite on push; deploy to staging then prod.  
3. **Observability**: Add request IDs and log `sessionId`, `customerId`, tool name, and token/cost estimates so you can replay sessions and debug.  
4. **Kill switch**: Feature flag or env var to disable tool execution (e.g. return “Assistant is in read-only mode”) for emergencies.

---

## How the AI Agent Helps Your Project (Gupio)

| Area | How the agent helps |
|------|----------------------|
| **Expense logging** | User says “500 fuel at Shell” or pastes SMS → tool `add_expense` or parse API → one place to log. |
| **Discovery** | “How much did I spend on fuel?” → `get_expenses_summary` → answer in natural language. |
| **Vehicle health** | “Is my car okay for a long trip?” → `get_maintenance_advisor` + RAG → warranty, parts, next service. |
| **Documents** | “When does my RC expire?” → `get_document_status` → clear answer. |
| **Savings** | “How can I save?” → `get_smart_recommendations` + expense/vehicle context. |
| **Retention** | RAG over past expenses/documents makes answers **personalized** (e.g. “your Brezza”, “last month”). |
| **Voice** | You already have voice input (Mobile) and TTS (`voiceUrl`); the same agent powers voice and text. |

---

## Suggested Priority Order

1. **Stage 4 (Testing)** — Add a small test suite and guardrails so future changes don’t break the agent.  
2. **Stage 3.4 (Optional loop)** — If you want multi-step flows (“compare and set budget”), implement Option B (re-submit with tool result).  
3. **Stage 2 (Rule-based layer)** — Quick win to save LLM cost on greetings/FAQs.  
4. **Stage 5 (Docker + CI/CD + tracing)** — As you move to production and scale.

You can implement the full AI agent roadmap **inside this project**; most of the core is already there, and the stages above are a practical sequence to harden and extend it.

---

## What Else You Can Add (AI Agent–Related)

Ideas that fit Gupio and build on your existing chat, RAG, tools, and notifications. Ordered by impact vs effort.

### 1. Proactive / autonomous agents

| Idea | What it does | Where it plugs in |
|------|----------------|-------------------|
| **Smart reminder agent** | Instead of fixed “RC expires in 7 days” text, an agent generates one short, personalized message per user (e.g. “Your Brezza’s insurance expires on 15 Mar. Renew now to avoid a gap.”) using RAG + document status. | Reuse or extend `notificationService.checkExpiringDocuments()`; call Gemini with user context and get one paragraph per customer. |
| **Anomaly explainer** | When `expenseIntelligenceService.detectAnomalies` flags something, the agent writes a one-line explanation (e.g. “Your fuel spend is 2× usual because of 3 long trips last week.”). | After anomaly detection, call a small prompt with anomaly type + recent expenses; store in notification body or send as in-app message. |
| **Weekly digest narrator** | Turn the weekly digest (totals, vs last week, tips) into 2–3 natural-language sentences per user. | In `runWeeklyDigest()` (workers), pass digest payload to Gemini; replace or augment the current bullet list with agent-generated summary. |

These stay within your existing crons and queues; the “agent” is just a focused LLM call with context.

### 2. Conversational UX

| Idea | What it does | Where it plugs in |
|------|----------------|-------------------|
| **Multi-turn clarification** | User: “Add 500 fuel.” Agent: “Which vehicle – Brezza or i20?” User: “Brezza.” → then call `add_expense` with the right vehicleId. | Your current single-turn flow already has context; ensure `get_vehicle_status` (or a “list_vehicles” tool) is used when the user hasn’t specified a vehicle and you have multiple. Optionally add a “clarification” response type (no tool call, just ask). |
| **Suggested follow-ups** | After each assistant message, show 2–3 short buttons (e.g. “Add another expense”, “Show fuel summary”, “Document status”). | Backend: add an optional `suggestedReplies: string[]` to the chat API response (e.g. from a small Gemini call or rule-based list). Mobile: render as chips below the message. |
| **Session summary** | “What did we do this session?” → agent summarizes the last N messages (expenses added, questions answered). | New tool `summarize_session` that takes recent messages (or sessionId); LLM returns 2–3 sentences. Expose in chat or as a “Summary” button. |

### 3. Specialized sub-agents (routing)

| Idea | What it does | Where it plugs in |
|------|----------------|-------------------|
| **Intent router** | First call: classify intent (e.g. expense | documents | vehicle_health | savings | trip | other). Then call one “sub-agent” (e.g. expense-focused system prompt + expense tools only) for better accuracy and smaller context. | Before `ai.service.chat()`, add a lightweight classifier (Gemini or a small model); then call chat with a role-specific system prompt and tool subset. |
| **Trip planner agent** | “I’m driving Delhi to Mumbai next week.” → Agent uses tools: fuel cost estimate (distance + vehicle), toll estimate, document check (“Is my insurance valid?”), and optional “suggest fuel stops by ADR.” | New tools: e.g. `estimate_trip_fuel`, `estimate_toll`, plus existing `get_document_status` and `get_vehicle_status`. One dedicated prompt: “You are a trip planner; use these tools to give a short plan.” |

### 4. Memory and personalization

| Idea | What it does | Where it plugs in |
|------|----------------|-------------------|
| **User preferences memory** | Remember “preferred language: Hindi”, “default vehicle: Brezza”, “notify me when budget hits 80%”. | Store in DB (e.g. `Customer.preferences` or a small table). Inject into RAG (e.g. “User prefers Hindi”) or into system prompt. Optionally embed preferences as a retrievable chunk. |
| **Goal memory** | User says “I want to cut fuel spend by 20%.” Later, when they ask “How can I save?” or when weekly digest runs, agent references this goal. | Store “goals” (e.g. in DB or as a dedicated embedding). In RAG query for savings/digest, include goals so the model can say “You wanted to cut fuel by 20%; here’s progress…” |
| **Long-term summary** | Periodically (e.g. monthly) summarize expense/vehicle history into a short “user story” and store as an embedding. Use for “Tell me about my car” or to keep context window small. | Cron job: for each customer, build a text summary of the month (totals, top categories, major events); call `vectorService.storeEmbedding` with entityType e.g. `USER_SUMMARY` and a time range. |

### 5. Safety, guardrails, and feedback

| Idea | What it does | Where it plugs in |
|------|----------------|-------------------|
| **Chat guardrails** | Refuse off-topic (e.g. medical, legal, generic advice). Stay within vehicle, expense, documents, and driving. | In system instruction (or a pre-step): “Only answer about the user’s vehicles, expenses, documents, and driving. Politely decline other topics.” Add a post-step: if the reply is off-topic, replace with a short “I can only help with vehicle and expense topics.” |
| **Feedback on messages** | Thumbs up/down or “Was this helpful?” on assistant messages. | New API: e.g. `POST /api/v1/chat/messages/:messageId/feedback` with `{ helpful: boolean, comment?: string }`. Store on `ChatMessage` or a `ChatFeedback` table. Use for prompt/model tuning and to detect bad tool calls. |
| **Audit log for tools** | Log every tool call (name, args, customerId, result success/failure) for safety and debugging. | In `ai.service.chat()` where you call `tool.execute()`, write to a table (e.g. `AgentToolAudit`) or structured logs. Enables “replay” and “kill switch” (disable certain tools by name or for a user). |

### 6. New surfaces (same agent, more entry points)

| Idea | What it does | Where it plugs in |
|------|----------------|-------------------|
| **WhatsApp / Telegram bot** | Same chat API; user sends message to bot, you call `aiService.chat()`, respond in the channel. Optional: “Add expense from WhatsApp” with a quick-reply. | Backend: small webhook route that receives WhatsApp/Telegram payload, maps to customerId (e.g. by phone or linking flow), calls `aiService.chat()`, returns reply. Reuse existing tools and RAG. |
| **Email-to-expense agent** | User forwards a bank/payment email; agent parses and suggests an expense (with “Confirm” / “Ignore”). | New endpoint: e.g. `POST /api/v1/expenses/parse/email` with raw body or attachment. Use existing `parseExpenseText` or a dedicated Gemini prompt for email; return suggested expense and let user confirm. |

### 7. Domain-specific agents

| Idea | What it does | Where it plugs in |
|------|----------------|-------------------|
| **Resale / value agent** | “What’s my car worth?” → Agent uses make/model/year, odometer, service history (from your DB), and optionally fetches market range (e.g. from an API or a static table). Returns a short answer with caveats. | New tool `estimate_resale_value` (and optionally a small “resale” system prompt). Inputs: vehicleId; call prediction + warranty/expense data; optional external API. |
| **Claim assistant** | “I had an accident; what do I do?” → Agent returns a short checklist (documents, insurer contact, do’s and don’ts) and optionally “Upload photos” linking to your document flow. | Mostly prompt + RAG over document types; optional tool “get_my_insurance_details” that returns policy number and insurer from `CustomerDocument`. No legal advice disclaimer in copy. |
| **Driving coach (proactive)** | You already have `generateDrivingCoachAdvice` for real-time events. Extend: “Weekly driving summary” (e.g. based on telematics) with 1–2 agent-generated tips. | New job: weekly (or post-trip) aggregate events; call Gemini with summary; send as in-app or push notification. |

### 8. Observability and tuning

| Idea | What it does | Where it plugs in |
|------|----------------|-------------------|
| **Trace per request** | One trace ID for: request → RAG retrieval → LLM call → tool call(s) → response. Log token counts and latency. | Add OpenTelemetry (or similar); create a span for the whole chat and child spans for RAG, generateContent, and each tool. Store trace ID in response header and in logs. |
| **Prompt A/B tests** | Run 10% of traffic with a variant system prompt (e.g. “Be more concise” vs “Be more detailed”) and compare feedback or success metrics. | Store “prompt_version” in config or DB; in `getOrUpdateCache()` or in the chat path, choose system instruction by version; log version with each request for later analysis. |
| **Cost and usage dashboard** | Per-customer or per-session: token usage, number of tool calls, cache hit rate. | Log token usage (Gemini response metadata) and tool calls; aggregate in DB or a analytics store. Surface in an internal dashboard to spot heavy users and optimize. |

---

### Suggested order to add

1. **Quick wins:** Guardrails in system prompt, suggested follow-ups (rule-based), and feedback API + DB column.  
2. **Proactive agents:** Digest narrator and anomaly explainer (reuse existing jobs).  
3. **One sub-agent:** Trip planner (new tools + one prompt).  
4. **New surface:** WhatsApp or Telegram webhook reusing `POST /api/v1/chat`.  
5. **Memory:** User preferences and goal memory, then long-term summary.  
6. **Observability:** Trace ID + token/tool logging, then A/B and cost dashboard.

---

## LangChain and n8n: Do You Need Them?

Short answer: **LangChain** — optional; only consider it if you want a standard “agent loop” or LangGraph. **n8n** — optional; useful for non-developer automations and external integrations, not for core app logic.

### LangChain

**What it is:** A library for building LLM apps: chains (prompt + model + output parser), memory (buffer, summary), RAG (loaders, splitters, vector stores), and agents (ReAct, tool-calling). LangGraph adds graph-based agent workflows (nodes + edges, cycles).

**What you already have without LangChain:**

| Capability | Your stack |
|------------|------------|
| LLM calls | `@google/generative-ai` (Gemini) directly |
| System + user prompt | `getOrUpdateCache()` + `userPrompt` in `ai.service.chat()` |
| RAG | `vectorService.searchSimilar()` (pgvector) + `ingestionService` |
| Conversation memory | Last 10 messages from DB in the prompt |
| Tools | `toolRegistry` + Gemini native `functionDeclarations` |
| Caching | Gemini Context Caching (system + tools) |

**Where LangChain could help:**

| Use case | How LangChain helps | Your alternative |
|----------|----------------------|------------------|
| **Multi-step agent loop** | LangGraph: define nodes (prompt → tool → prompt) and cycles; built-in “run until no more tool calls.” | Implement a small loop in `ai.service.chat()`: after a tool call, re-call Gemini with the tool result and repeat until the model returns text only (see Stage 3.4 in this doc). |
| **Swapping LLM provider** | Unified interface (e.g. `ChatGoogleGenerativeAI`, `ChatOpenAI`); change provider by swapping the model. | You’re committed to Gemini and use its cache; swapping is rare. If needed, abstract behind a thin `llmService.generate()` that calls Gemini. |
| **RAG pipeline** | Loaders (PDF, web), text splitters, vector-store abstractions. | You already have: ingestion → embed (Gemini) → pgvector. LangChain doesn’t add much unless you add many new document types. |
| **Observability** | LangSmith: trace chains and agents in a UI. | Add OpenTelemetry (or similar) + your own logging; you keep full control and no extra vendor. |

**Recommendation:**

- **Don’t refactor** your current chat/RAG/tools to LangChain just for the sake of it. You’d lose Gemini Context Caching and add a layer that doesn’t match your “single model + custom tools” design.
- **Consider LangChain/LangGraph only if** you introduce a proper multi-step agent (Plan → Act → Evaluate, multiple tool calls per turn) and want a standard graph abstraction and tool execution loop. Even then, you can implement the loop in ~50 lines in `ai.service.chat()` without LangGraph.
- **If you use it:** Prefer `@langchain/google-genai` (or community package for Gemini) and use LangGraph only for the agent graph; keep RAG and ingestion in your existing `vectorService` / `ingestionService` so you don’t duplicate logic.

**Current state:** LangChain is in `Backend/package.json` but **not used** anywhere in the codebase. You can remove `langchain`, `@langchain/core`, and `@langchain/openai` to reduce bundle size if you don’t plan to use them.

---

### n8n

**What it is:** Low-code workflow automation (like Zapier/Make). You build flows in a UI: triggers (webhook, schedule, email) → steps (HTTP, DB, AI, conditionals) → actions (email, Slack, etc.). Self-hosted or cloud.

**Where n8n could help in your project:**

| Use case | How n8n helps | Your alternative |
|----------|----------------|-------------------|
| **Marketing / ops flows** | “When a user signs up, add to Mailchimp and send welcome email.” Or: “Every Monday, send a report to Slack with last week’s signups.” | Implement in Backend: cron + `notificationService` or a small script; or use your existing BullMQ workers. |
| **External integrations** | “When a row is added in Google Sheet, call our API to create an expense.” Or: “When WhatsApp receives a message, POST to `/api/v1/chat` and reply.” | Backend webhook (e.g. WhatsApp/Telegram route that calls `aiService.chat()`). n8n can sit in front as the HTTP receiver and then call your API. |
| **Non-developer automations** | Product or support can change “when X then Y” without code. | Good if your team will own many ad-hoc automations. If only engineers touch the backend, BullMQ + code is simpler and version-controlled. |
| **One-off or experimental flows** | Try “parse this email and create a draft expense” without committing code. | Quick to prototype in n8n; once stable, move logic into Backend (e.g. `POST /api/v1/expenses/parse/email`). |

**Where n8n does *not* fit:**

- **Core product logic** — Chat, RAG, expense creation, document expiry, weekly digest belong in your Backend and workers. n8n is not a replacement for Express, BullMQ, or your DB.
- **Low-latency user flows** — User sends a message in the app → your API must respond in milliseconds. n8n is better for async, triggered workflows (scheduled, webhook, event).
- **Complex auth and context** — Your chat needs `customerId`, session, and RAG. Doing that inside n8n (e.g. “fetch user, then call LLM, then call tools”) is possible but gets messy; keeping it in Backend is cleaner.

**Recommendation:**

- **Optional.** Use n8n only if you want:
  - Non-developers to build or change automations (e.g. “when document expires in 7 days, send this email template”).
  - A single place to wire third-party triggers (Google Sheets, Typeform, WhatsApp Business API) to your existing APIs (e.g. `POST /api/v1/chat`, `POST /api/v1/expenses/parse/text`).
- **If you don’t use it:** Your current design (Express + BullMQ + cron) is enough for scheduled jobs (digest, document expiry, health score). For WhatsApp/Telegram, add a webhook route in Backend that calls `aiService.chat()`; no n8n required.
- **If you use it:** Run n8n as a separate service (self-hosted or cloud). Use it for “trigger → call Gupio API” and “trigger → external tool”; keep all agent/RAG/tool logic inside your Backend.

---

### Summary

| Tool | Use in Gupio? | When to consider |
|------|----------------|-------------------|
| **LangChain** | Optional | You want a standard agent framework or LangGraph for a multi-step agent; otherwise stay with direct Gemini + your own loop. |
| **n8n** | Optional | You want UI-built automations or non-developers to connect external triggers to your APIs; otherwise stay with Backend + BullMQ. |

Your project does not *depend* on either. You can add value with guardrails, proactive agents, and new tools entirely within your current stack.
