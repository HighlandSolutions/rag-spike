-- Create function for vector similarity search
-- This function enables efficient vector search using pgvector

CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.0,
  match_count int DEFAULT 10,
  tenant_id_filter text DEFAULT NULL,
  content_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  tenant_id text,
  document_id uuid,
  chunk_text text,
  chunk_metadata jsonb,
  content_type text,
  embedding vector(1536),
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    chunks.id,
    chunks.tenant_id,
    chunks.document_id,
    chunks.chunk_text,
    chunks.chunk_metadata,
    chunks.content_type,
    chunks.embedding,
    chunks.created_at,
    1 - (chunks.embedding <=> query_embedding) as similarity
  FROM chunks
  WHERE
    chunks.embedding IS NOT NULL
    AND (tenant_id_filter IS NULL OR chunks.tenant_id = tenant_id_filter)
    AND (content_types IS NULL OR chunks.content_type = ANY(content_types))
    AND (1 - (chunks.embedding <=> query_embedding)) >= match_threshold
  ORDER BY chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users (or anon if needed)
-- Adjust based on your RLS policies
GRANT EXECUTE ON FUNCTION match_chunks TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION match_chunks IS 'Performs vector similarity search on chunks table using cosine distance';

