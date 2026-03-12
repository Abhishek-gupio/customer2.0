import { GoogleGenerativeAI } from "@google/generative-ai";
import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { env } from "../config/env";

const genAI = env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
  : null;
const db = dbInstances as any;

/**
 * VECTOR SERVICE — Enhanced with Hybrid Search + AI Reranking
 * ============================================================
 * Uses Google Gemini embeddings + pgvector for semantic search,
 * PostgreSQL full-text for keyword search, and Reciprocal Rank Fusion
 * to combine both. Optional AI reranking for top accuracy.
 */
export const vectorService = {
  /**
   * Generate embedding vector for a given text
   * Uses Gemini embedding-001 (768 dimensions)
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!genAI || !text) return null;

    try {
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      logger.error({ error }, "Failed to generate embedding");
      return null;
    }
  },

  /**
   * Store embedding for an entity (Expense, Document, Vehicle, etc.)
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
      await db.documentEmbedding.deleteMany({
        where: { entityId: input.entityId },
      });

      const vectorString = `[${vector.join(",")}]`;

      await db.$executeRawUnsafe(
        `INSERT INTO "customer"."DocumentEmbedding" ("id", "customerId", "entityId", "entityType", "content", "vector", "createdAt") 
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::vector, NOW())`,
        input.customerId,
        input.entityId,
        input.entityType,
        input.content,
        vectorString,
      );

      logger.info(
        { entityId: input.entityId, type: input.entityType },
        "Embedding stored successfully",
      );
    } catch (error) {
      logger.error(
        { error, entityId: input.entityId },
        "Failed to store embedding",
      );
    }
  },

  /**
   * Original: Search for similar documents using Cosine Similarity only
   */
  async searchSimilar(
    customerId: string,
    queryText: string,
    limit = 5,
  ): Promise<any[]> {
    const queryVector = await this.generateEmbedding(queryText);
    if (!queryVector) return [];

    try {
      const vectorString = `[${queryVector.join(",")}]`;

      const results = await db.$queryRawUnsafe(
        `SELECT id, "entityId", "entityType", content, 1 - (vector <=> $1::vector) as similarity
                 FROM "customer"."DocumentEmbedding"
                 WHERE "customerId" = $2
                 ORDER BY vector <=> $1::vector ASC
                 LIMIT $3`,
        vectorString,
        customerId,
        limit,
      );

      return results as any[];
    } catch (error) {
      logger.error({ error }, "Vector search failed");
      return [];
    }
  },

  // ==========================================================================
  // FEATURE 6: Hybrid Search — Vector + Full-Text, combined via RRF
  // ==========================================================================

  /**
   * Full-text keyword search using PostgreSQL tsvector
   */
  async fullTextSearch(
    customerId: string,
    queryText: string,
    limit = 10,
  ): Promise<any[]> {
    try {
      // Convert user query to tsquery format (split words and AND them)
      const tsQuery = queryText
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
        .filter(Boolean)
        .join(" | ");

      if (!tsQuery) return [];

      const results = await db.$queryRawUnsafe(
        `SELECT id, "entityId", "entityType", content,
                ts_rank_cd(to_tsvector('english', content), to_tsquery('english', $1)) as rank
         FROM "customer"."DocumentEmbedding"
         WHERE "customerId" = $2
           AND to_tsvector('english', content) @@ to_tsquery('english', $1)
         ORDER BY rank DESC
         LIMIT $3`,
        tsQuery,
        customerId,
        limit,
      );

      return results as any[];
    } catch (error) {
      logger.error({ error }, "Full-text search failed, falling back");
      return [];
    }
  },

  /**
   * Hybrid Search: Combines vector similarity + full-text via Reciprocal Rank Fusion (RRF)
   */
  async hybridSearch(
    customerId: string,
    queryText: string,
    limit = 5,
  ): Promise<any[]> {
    const k = 60; // RRF constant

    // Run both searches in parallel
    const [vectorResults, textResults] = await Promise.all([
      this.searchSimilar(customerId, queryText, limit * 2),
      this.fullTextSearch(customerId, queryText, limit * 2),
    ]);

    // Build RRF score map
    const scoreMap = new Map<string, { score: number; doc: any }>();

    vectorResults.forEach((doc: any, index: number) => {
      const rrfScore = 1 / (k + index + 1);
      const existing = scoreMap.get(doc.entityId);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(doc.entityId, { score: rrfScore, doc });
      }
    });

    textResults.forEach((doc: any, index: number) => {
      const rrfScore = 1 / (k + index + 1);
      const existing = scoreMap.get(doc.entityId);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(doc.entityId, { score: rrfScore, doc });
      }
    });

    // Sort by combined RRF score and take top results
    const combined = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => ({
        ...entry.doc,
        hybridScore: entry.score,
      }));

    // If we have enough results and AI is available, rerank
    if (combined.length > 2 && genAI) {
      return this.rerankWithAI(queryText, combined);
    }

    return combined;
  },

  /**
   * AI Reranking: Ask Gemini to reorder results by relevance
   */
  async rerankWithAI(
    query: string,
    documents: any[],
  ): Promise<any[]> {
    if (!genAI || documents.length <= 1) return documents;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const docList = documents
        .map(
          (d, i) =>
            `[${i}] (${d.entityType}) ${d.content.substring(0, 200)}`,
        )
        .join("\n");

      const result = await model.generateContent(
        `Given the user query: "${query}"

Rerank these documents by relevance (most relevant first). Return ONLY the indices as a comma-separated list, e.g. "2,0,1,3".

Documents:
${docList}`,
      );

      const response = result.response.text().trim();
      const indices = response
        .split(",")
        .map((s: string) => parseInt(s.trim()))
        .filter((n: number) => !isNaN(n) && n >= 0 && n < documents.length);

      if (indices.length === 0) return documents;

      // Reorder documents based on AI ranking
      const reranked = indices.map((i: number) => documents[i]);

      // Add any documents not mentioned in AI response
      for (const doc of documents) {
        if (!reranked.includes(doc)) {
          reranked.push(doc);
        }
      }

      return reranked;
    } catch (error) {
      logger.error({ error }, "AI reranking failed, using original order");
      return documents;
    }
  },
};
