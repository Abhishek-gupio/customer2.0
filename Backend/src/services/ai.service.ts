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

const db = dbInstances as any;

const genAI = env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
  : null;
const cacheManager = env.GEMINI_API_KEY
  ? new GoogleAICacheManager(env.GEMINI_API_KEY)
  : null;

// Global singleton to store the current cache name
let activeCache: { name: string; expiry: number } | null = null;

// ============================================================================
// SYSTEM PROMPT — Enhanced with agent capabilities
// ============================================================================
const SYSTEM_PROMPT = `You are an intelligent automotive assistant for 'Gupio'.
Always reply in the user's language. Be concise and proactive.
When the user asks a compound question requiring multiple actions, call each relevant tool.
When reasoning about complex queries, think step by step.
If you call a tool, wait for the result before responding.
If the user uploads an image (receipt, document, damage photo), analyze it and extract all relevant information.`;

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
        model: "models/gemini-2.0-flash",
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
      logger.warn({ error }, "Context cache creation failed, using inline mode");
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
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
          logger.info(
            { tool: call.name, args: call.args, iteration: i + 1 },
            "Executing Tool (multi-turn)",
          );
          try {
            const result = await tool.execute(customerId, call.args);
            toolResults.push({ tool: call.name, args: call.args, result });
            const res = result as any;
            callResults.push(
              `Tool ${call.name} result: ${res?.message || JSON.stringify(result)}`,
            );
          } catch (err) {
            callResults.push(`Tool ${call.name} failed: ${err}`);
          }
        }
      }

      // Feed tool results back into the next prompt
      currentPrompt = `${initialPrompt}\n\nTOOL RESULTS:\n${callResults.join("\n")}\n\nBased on these tool results, provide a final comprehensive answer to the user. If you need more tools, call them. Otherwise, respond with text.`;
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
        vectorService.hybridSearch(customerId, message, 5),
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

      (async () => {
        const voiceUrl = await voiceService.generateSpeechUrl(responseText);
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

      const immediateVoiceUrl =
        await voiceService.generateSpeechUrl(responseText);

      return {
        sessionId: finalSessionId,
        message: responseText,
        voiceUrl: immediateVoiceUrl,
        contextUsed: contextDocs.length,
        toolResults:
          allToolResults.length > 0 ? allToolResults : undefined,
        agentSteps: agentSteps.length > 0 ? agentSteps : undefined,
      };
    } catch (error) {
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
        vectorService.hybridSearch(customerId, message, 5),
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

                yield JSON.stringify({
                  type: "tool_result",
                  tool: call.name,
                  message: toolMessage,
                  result: toolResult,
                });
              } catch (err) {
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

      yield JSON.stringify({
        type: "done",
        voiceUrl,
        contextUsed: contextDocs.length,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
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
          text: `\n\n[Step ${i + 1}/${maxIterations}] Think about what to do next. If you have all the information needed, provide the final answer as text. If you need data, call the appropriate tool.`,
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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
