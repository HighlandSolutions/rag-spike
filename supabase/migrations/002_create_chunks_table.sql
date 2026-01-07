-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create chunks table
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_metadata JSONB DEFAULT '{}'::jsonb,
  content_type TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on document_id for document lookups
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);

-- Create index on tenant_id for multi-tenant support
CREATE INDEX IF NOT EXISTS idx_chunks_tenant_id ON chunks(tenant_id);

-- Create index on content_type for filtering
CREATE INDEX IF NOT EXISTS idx_chunks_content_type ON chunks(content_type);

-- Create vector similarity search index using HNSW (Hierarchical Navigable Small World)
-- This is optimized for cosine similarity search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_vector ON chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create full-text search index on chunk_text
CREATE INDEX IF NOT EXISTS idx_chunks_chunk_text_fts ON chunks
USING gin(to_tsvector('english', chunk_text));

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_chunks_created_at ON chunks(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE chunks IS 'Stores document chunks with embeddings for RAG search';
COMMENT ON COLUMN chunks.embedding IS 'Vector embedding for semantic search (1536 dimensions for OpenAI text-embedding-3-small)';
COMMENT ON COLUMN chunks.chunk_metadata IS 'JSON metadata (e.g., page number, row index, source location)';



