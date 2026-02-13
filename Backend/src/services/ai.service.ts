import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { vectorService } from "./vector.service";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAICacheManager } from "@google/generative-ai/server";
import { env } from "../config/env";
import { toolRegistry } from "./tools.service";
import { voiceService } from "./voice.service";

const db = dbInstances as any;

const genAI = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;
const cacheManager = env.GEMINI_API_KEY ? new GoogleAICacheManager(env.GEMINI_API_KEY) : null;

// Global singleton to store the current cache name
let activeCache: { name: string; expiry: number } | null = null;

export const aiService = {

    /**
     * Convert our tool registry to Gemini's native function declarations for Caching
     */
    getFunctionDeclarations() {
        return Object.values(toolRegistry).map(t => {
            // Basic mapping of string descriptions to JSON schema
            const properties: any = {};
            const required: string[] = [];

            for (const [key, desc] of Object.entries(t.parameters)) {
                const description = desc as string;
                const isRequired = description.toLowerCase().includes("required");
                const type = description.toLowerCase().includes("number") ? "NUMBER" : "STRING";

                properties[key] = {
                    type,
                    description: description.replace("(required)", "").trim()
                };
                if (isRequired) required.push(key);
            }

            return {
                name: t.name,
                description: t.description,
                parameters: {
                    type: "OBJECT",
                    properties,
                    required: required.length > 0 ? required : undefined
                }
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
        if (activeCache && activeCache.expiry > now + 300000) { // 5 mins buffer
            return activeCache.name;
        }

        logger.info("Creating new Gemini Context Cache for Gupio Tools...");
        const declarations = this.getFunctionDeclarations();

        const cache = await cacheManager.create({
            model: "models/gemini-1.5-flash-002", // Stable model for Caching
            displayName: "gupio-base-logic",
            systemInstruction: `You are an intelligent automotive assistant for 'Gupio'. 
            Always reply in the user's language. Be concise and proactive.`,
            contents: [], // Required by SDK
            tools: [{ functionDeclarations: declarations } as any],
            ttlSeconds: 3600 // 1 hour cache
        });

        activeCache = {
            name: cache.name!,
            expiry: now + (3600 * 1000)
        };

        return cache.name!;
    },

    async chat(customerId: string, message: string, sessionId?: string) {
        // 🚀 SPEED UP #1: Get Cache + Session + Vector in Parallel
        const [cacheName, sessionData, contextDocs] = await Promise.all([
            this.getOrUpdateCache(),
            sessionId
                ? db.chatSession.findUnique({
                    where: { id: sessionId, customerId },
                    include: { messages: { orderBy: { createdAt: "asc" } } }
                })
                : db.chatSession.create({
                    data: {
                        customerId,
                        title: message.substring(0, 50),
                        messages: { create: [] }
                    },
                    include: { messages: true }
                }),
            vectorService.searchSimilar(customerId, message, 5)
        ]);

        const session = sessionData as any;
        const finalSessionId = session.id;

        // 2. Prepare Context (Since Rules & Tools are in Cache)
        const contextText = contextDocs.map(doc => `[${doc.entityType}] ${doc.content}`).join("\n\n");
        const chatHistory = (session.messages || []).slice(-10).map((m: any) =>
            `${m.role.toUpperCase()}: ${m.content}`
        ).join("\n");

        if (!genAI) throw new Error("AI not configured");

        // 🚀 COST SAVER: Use Cached Model
        const model = genAI.getGenerativeModel(
            { model: "gemini-1.5-flash-002", cachedContent: cacheName } as any,
            { apiVersion: "v1beta" }
        );

        // Dynamic prompt part
        const userPrompt = `
            USER CONTEXT (RELEVANT RECORDS):
            ${contextText ? contextText : "No specific records found."}

            RECENT CONVERSATION:
            ${chatHistory ? chatHistory : "No history."}

            USER MESSAGE: ${message}
        `;

        try {
            const result = await model.generateContent(userPrompt);
            let responseText = result.response.text();
            let toolExecutionResult = null;

            // 4. Handle Native Function Calls
            const firstCandidate = result.response.candidates?.[0];
            const functionCalls = firstCandidate?.content.parts.filter(p => p.functionCall);

            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0].functionCall!;
                const tool = toolRegistry[call.name as keyof typeof toolRegistry];
                if (tool) {
                    logger.info({ tool: call.name, args: call.args }, "Executing Native Tool");
                    toolExecutionResult = await tool.execute(customerId, call.args);
                    const res = toolExecutionResult as any;
                    responseText = res?.message || `Performed ${call.name} successfully.`;
                }
            }

            // 🚀 SIDE-EFFECTS
            (async () => {
                const voiceUrl = await voiceService.generateSpeechUrl(responseText);
                await db.$transaction([
                    db.chatMessage.create({ data: { sessionId: finalSessionId, role: "user", content: message } }),
                    db.chatMessage.create({
                        data: {
                            sessionId: finalSessionId,
                            role: "assistant",
                            content: responseText,
                            metadata: { ...(toolExecutionResult ? { toolResult: toolExecutionResult } : {}), voiceUrl }
                        }
                    })
                ]);
            })().catch(err => logger.error({ err }, "Background chat logging failed"));

            const immediateVoiceUrl = await voiceService.generateSpeechUrl(responseText);

            return {
                sessionId: finalSessionId,
                message: responseText,
                voiceUrl: immediateVoiceUrl,
                contextUsed: contextDocs.length,
                toolResult: toolExecutionResult
            };

        } catch (error) {
            logger.error({ error }, "AI Chat generation failed");
            throw new Error("Failed to generate response");
        }
    },

    async getHistory(customerId: string, sessionId: string) {
        return db.chatSession.findUnique({
            where: { id: sessionId, customerId },
            include: { messages: { orderBy: { createdAt: "asc" } } }
        });
    },

    async listSessions(customerId: string) {
        return db.chatSession.findMany({
            where: { customerId, isActive: true },
            orderBy: { updatedAt: "desc" },
            select: { id: true, title: true, updatedAt: true }
        });
    }
};
