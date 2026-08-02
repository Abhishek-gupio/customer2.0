import { GoogleGenerativeAI } from "@google/generative-ai";
import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { env } from "../config/env";
import { callAI, isAIConfigured } from "./ai-provider.service";

const genAI = env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
  : null;
const db = dbInstances as any;

const EMBED_MODEL = "gemini-embedding-001";
const GEMINI_TEXT_MODEL = env.GEMINI_TEXT_MODEL;

/** PostgreSQL error code for undefined_column */
const PG_UNDEFINED_COLUMN = "42703";

function isVectorColumnMissing(error: unknown): boolean {
  const err = error as { meta?: { driverAdapterError?: { cause?: { originalCode?: string; originalMessage?: string } } }; message?: string };
  const code = err?.meta?.driverAdapterError?.cause?.originalCode;
  const msg = err?.meta?.driverAdapterError?.cause?.originalMessage ?? err?.message ?? "";
  return code === PG_UNDEFINED_COLUMN || /column\s+["']?vector["']?\s+does not exist/i.test(String(msg));
}

let vectorColumnEnsured = false;

/** Create pgvector extension and add vector column if missing. Safe to call multiple times. */
async function ensureVectorColumn(): Promise<void> {
  if (vectorColumnEnsured) return;
  try {
    await db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public`);
    await db.$executeRawUnsafe(
      `ALTER TABLE "customer"."DocumentEmbedding" ADD COLUMN IF NOT EXISTS "vector" vector(3072)`,
    );
    vectorColumnEnsured = true;
    logger.info("DocumentEmbedding.vector column ensured (pgvector)");
  } catch (e) {
    logger.warn({ error: e }, "Could not add vector column (pgvector may be unavailable)");
  }
}
const EMBED_API = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
const EMBED_TIMEOUT_MS = 10_000;

/**
 * Minimum cosine similarity for a row to count as relevant. Tuned conservatively: high enough to
 * drop unrelated records, low enough not to discard a genuine paraphrase match. Revisit once
 * there is real indexed data to measure against — see the note in `searchSimilar`.
 */
const MIN_SIMILARITY = 0.5;

/**
 * Minimum `ts_rank_cd` for the lexical leg. Low by design — cover-density ranks are small numbers
 * — but enough to exclude a row matched on one incidental term. Tune alongside MIN_SIMILARITY once
 * there is real indexed data to measure against.
 */
const MIN_TEXT_RANK = 0.01;

/**
 * Generate embedding via Gemini REST API (embed endpoint).
 * SDK getGenerativeModel().embedContent() often 404s for embedding models; REST is reliable.
 */
async function embedViaRest(text: string): Promise<number[] | null> {
  const key = env.GEMINI_API_KEY;
  if (!key || !text) return null;
  try {
    const res = await fetch(
      `${EMBED_API}?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
        }),
        // Retrieval runs on the chat request path; an unbounded embed call would hold the whole
        // turn open. Failing fast is correct here since callers already treat null as "no RAG".
        signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${errText.slice(0, 200)}`);
    }
    const data = (await res.json()) as { embedding?: { values?: number[] } };
    const values = data.embedding?.values;
    return values?.length ? values : null;
  } catch (err) {
    logger.error({ error: err }, "Failed to generate embedding (REST)");
    return null;
  }
}

/**
 * VECTOR SERVICE — Enhanced with Hybrid Search + AI Reranking
 * ============================================================
 * Uses Google Gemini embeddings + pgvector for semantic search,
 * PostgreSQL full-text for keyword search, and Reciprocal Rank Fusion
 * to combine both. Optional AI reranking for top accuracy.
 */
export const vectorService = {
  /**
   * Generate embedding vector for a given text.
   * Uses Gemini REST embedContent (gemini-embedding-001, 3072 dims).
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    const fromRest = await embedViaRest(text);
    if (fromRest) return fromRest;
    if (!genAI) return null;
    try {
      const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
      const result = await model.embedContent(text);
      return result.embedding?.values ?? null;
    } catch (err) {
      logger.error({ error: err }, "Failed to generate embedding");
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

    const doInsert = async () => {
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
    };

    try {
      await doInsert();
      logger.info(
        { entityId: input.entityId, type: input.entityType },
        "Embedding stored successfully",
      );
    } catch (error) {
      if (isVectorColumnMissing(error)) {
        await ensureVectorColumn();
        try {
          await doInsert();
          logger.info(
            { entityId: input.entityId, type: input.entityType },
            "Embedding stored successfully (after adding vector column)",
          );
        } catch (retryErr) {
          logger.error(
            { error: retryErr, entityId: input.entityId },
            "Failed to store embedding",
          );
        }
      } else {
        logger.error(
          { error, entityId: input.entityId },
          "Failed to store embedding",
        );
      }
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

    const doSearch = async () => {
      const vectorString = `[${queryVector.join(",")}]`;
      return db.$queryRawUnsafe(
        // The similarity floor is not cosmetic. Without it the top-N rows are returned no matter
        // how unrelated they are, and the caller injects them under a "RELEVANT RECORDS" heading
        // — which invites the model to answer confidently from records that have nothing to do
        // with the question. Returning nothing is the correct answer to "no good match".
        `SELECT id, "entityId", "entityType", content, 1 - (vector <=> $1::vector) as similarity
                 FROM "customer"."DocumentEmbedding"
                 WHERE "customerId" = $2
                   AND 1 - (vector <=> $1::vector) >= $4
                 ORDER BY vector <=> $1::vector ASC
                 LIMIT $3`,
        vectorString,
        customerId,
        limit,
        MIN_SIMILARITY,
      ) as Promise<any[]>;
    };

    try {
      return await doSearch();
    } catch (error) {
      if (isVectorColumnMissing(error)) {
        await ensureVectorColumn();
        try {
          return await doSearch();
        } catch {
          logger.error({ error }, "Vector search failed");
          return [];
        }
      }
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
      // Convert user query to tsquery format. Terms are OR-ed (`|`), not AND-ed — the comment
      // here used to claim the opposite. OR is the right call for a recall-oriented lexical leg
      // feeding RRF, but it does mean a single common term can match loosely-related rows, so
      // precision has to come from the vector leg's similarity floor (see MIN_SIMILARITY).
      const tsQuery = queryText
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
        .filter(Boolean)
        .join(" | ");

      if (!tsQuery) return [];

      const results = await db.$queryRawUnsafe(
        // Rank floor matters here as much as the vector leg's similarity floor. Terms are OR-ed,
        // so `@@` alone matches a row that shares a single incidental word with the query — and
        // because `hybridSearch` fuses these into the same result set that gets injected into the
        // prompt as "RELEVANT RECORDS", one shared word was enough to feed the model an unrelated
        // record. Requiring a minimum rank drops single-weak-term matches.
        `SELECT id, "entityId", "entityType", content,
                ts_rank_cd(to_tsvector('english', content), to_tsquery('english', $1)) as rank
         FROM "customer"."DocumentEmbedding"
         WHERE "customerId" = $2
           AND to_tsvector('english', content) @@ to_tsquery('english', $1)
           AND ts_rank_cd(to_tsvector('english', content), to_tsquery('english', $1)) >= $4
         ORDER BY rank DESC
         LIMIT $3`,
        tsQuery,
        customerId,
        limit,
        MIN_TEXT_RANK,
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
    if (combined.length > 2 && isAIConfigured()) {
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
    if (!isAIConfigured() || documents.length <= 1) return documents;

    try {
      const docList = documents
        .map(
          (d, i) =>
            `[${i}] (${d.entityType}) ${d.content.substring(0, 200)}`,
        )
        .join("\n");

      const prompt = `Given the user query: "${query}"

Rerank these documents by relevance (most relevant first). Return ONLY the indices as a comma-separated list, e.g. "2,0,1,3".

Documents:
${docList}`;

      const response = (await callAI(prompt)).trim();
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
