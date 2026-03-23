-- Enable pgvector extension (creates vector type in public)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Add vector column to DocumentEmbedding (3072 dims for gemini-embedding-001)
ALTER TABLE "customer"."DocumentEmbedding"
ADD COLUMN IF NOT EXISTS "vector" vector(3072);
