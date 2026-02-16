import { GoogleGenerativeAI } from "@google/generative-ai";
import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { env } from "../config/env";
// import { Prisma } from "@prisma/client";

// Initialize AI clients
const genAI = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;
const db = dbInstances as any;

/**
 * Service to handle Vector Embeddings using Google Gemini and pgvector
 */
export const vectorService = {
    /**
     * Generate embedding vector for a given text
     * Uses Gemini 004 (768 dimensions)
     */
    async generateEmbedding(text: string): Promise<number[] | null> {
        if (!genAI || !text) return null;

        try {
            // Using embedding-001 model for broader regional availability vs 004
            const model = genAI.getGenerativeModel({ model: "embedding-001" });

            const result = await model.embedContent(text);
            const embedding = result.embedding;

            return embedding.values;
        } catch (error) {
            logger.error({ error }, "Failed to generate embedding");
            return null;
        }
    },

    /**
     * Store embedding for an entity (Expense, Document, etc.)
     */
    async storeEmbedding(input: {
        customerId: string;
        entityId: string;
        entityType: "EXPENSE" | "DOCUMENT" | "VEHICLE";
        content: string;
    }) {
        const vector = await this.generateEmbedding(input.content);
        if (!vector) return;

        try {
            // 1. Delete existing embedding for this entity
            await db.documentEmbedding.deleteMany({
                where: { entityId: input.entityId }
            });

            // 2. Insert new embedding (using raw query for vector support)
            // Note: Prisma 5+ supports typed raw queries, but vector is unsupported type
            const vectorString = `[${vector.join(",")}]`;

            await db.$executeRawUnsafe(
                `INSERT INTO "customer"."DocumentEmbedding" ("id", "customerId", "entityId", "entityType", "content", "vector", "createdAt") 
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::vector, NOW())`,
                input.customerId,
                input.entityId,
                input.entityType,
                input.content,
                vectorString
            );

            logger.info({ entityId: input.entityId, type: input.entityType }, "Embedding stored successfully");
        } catch (error) {
            logger.error({ error, entityId: input.entityId }, "Failed to store embedding");
        }
    },

    /**
     * Search for similar documents using Cosine Similarity
     */
    async searchSimilar(customerId: string, queryText: string, limit = 5): Promise<any[]> {
        const queryVector = await this.generateEmbedding(queryText);
        if (!queryVector) return [];

        try {
            const vectorString = `[${queryVector.join(",")}]`;

            // Query using pgvector's <=> operator (cosine distance)
            // Note: 1 - distance = similarity (roughly)
            const results = await db.$queryRawUnsafe(
                `SELECT id, "entityId", "entityType", content, 1 - (vector <=> $1::vector) as similarity
                 FROM "customer"."DocumentEmbedding"
                 WHERE "customerId" = $2
                 ORDER BY vector <=> $1::vector ASC
                 LIMIT $3`,
                vectorString,
                customerId,
                limit
            );

            return results as any[];
        } catch (error) {
            logger.error({ error }, "Vector search failed");
            return [];
        }
    }
};
