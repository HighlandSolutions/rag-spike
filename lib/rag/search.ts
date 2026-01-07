/**
 * RAG Search Service
 * Implements hybrid search combining keyword (full-text) and vector (semantic) search
 */

import { getSupabaseServerClient } from '@/lib/supabase/client';
import { generateEmbedding } from '@/lib/ingestion/embeddings';
import type { SearchRequest, SearchResponse, SearchResult, DocumentChunk, ChunkMetadata } from '@/types/domain';
import type { ChunkRow } from '@/types/database';

/**
 * Type for match_chunks RPC function return value
 */
type MatchChunksResult = ChunkRow & { similarity: number };

/**
 * Convert database row to domain DocumentChunk
 */
const rowToChunk = (row: ChunkRow): DocumentChunk => ({
  id: row.id,
  tenantId: row.tenant_id,
  documentId: row.document_id,
  chunkText: row.chunk_text,
  chunkMetadata: (row.chunk_metadata || {}) as ChunkMetadata,
  contentType: row.content_type,
  embedding: row.embedding,
  createdAt: new Date(row.created_at),
});

/**
 * Hybrid search configuration
 */
interface HybridSearchConfig {
  keywordWeight: number; // Weight for keyword search scores (0-1)
  vectorWeight: number; // Weight for vector search scores (0-1)
  keywordLimit: number; // Number of keyword results to fetch
  vectorLimit: number; // Number of vector results to fetch
}

const DEFAULT_CONFIG: HybridSearchConfig = {
  keywordWeight: 0.3,
  vectorWeight: 0.7,
  keywordLimit: 20,
  vectorLimit: 20,
};

/**
 * Perform keyword search using PostgreSQL full-text search
 */
const performKeywordSearch = async (
  query: string,
  tenantId: string,
  contentTypeFilters: string[] | null,
  limit: number
): Promise<Array<{ chunk: DocumentChunk; score: number }>> => {
  const supabase = getSupabaseServerClient();

  // Build base query
  let queryBuilder = supabase
    .from('chunks')
    .select('*')
    .eq('tenant_id', tenantId)
    .not('chunk_text', 'is', null);

  // Apply content type filters if provided
  if (contentTypeFilters && contentTypeFilters.length > 0) {
    queryBuilder = queryBuilder.in('content_type', contentTypeFilters);
  }

  // Use text search with ilike for keyword matching
  // Split query into words and search for each
  const queryWords = query.trim().split(/\s+/).filter((word) => word.length > 0);
  
  if (queryWords.length === 0) {
    return [];
  }

  // Build a pattern that matches any of the words
  const pattern = `%${queryWords.join('%')}%`;
  const { data, error } = await queryBuilder.ilike('chunk_text', pattern).limit(limit * 2);

  if (error) {
    throw new Error(`Keyword search failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Score results based on keyword match frequency and position
  const scoredResults = data.map((row) => {
    const chunk = rowToChunk(row);
    const text = chunk.chunkText.toLowerCase();
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/).filter((word) => word.length > 0);

    // Calculate match score
    let matchCount = 0;
    let totalWords = 0;

    for (const word of words) {
      const occurrences = (text.match(new RegExp(word, 'gi')) || []).length;
      matchCount += occurrences;
      totalWords += 1;
    }

    // Score based on: (1) word match ratio, (2) total occurrences
    const wordMatchRatio = words.length > 0 ? matchCount / (words.length * 2) : 0;
    const occurrenceScore = Math.min(matchCount / 10, 1.0); // Normalize occurrence count
    const score = (wordMatchRatio * 0.7 + occurrenceScore * 0.3);

    return { chunk, score: Math.min(score, 1.0) };
  });

  // Sort by score and take top results
  scoredResults.sort((a, b) => b.score - a.score);
  return scoredResults.slice(0, limit);
};

/**
 * Perform vector search using pgvector cosine similarity
 */
const performVectorSearch = async (
  queryEmbedding: number[],
  tenantId: string,
  contentTypeFilters: string[] | null,
  limit: number
): Promise<Array<{ chunk: DocumentChunk; score: number }>> => {
  const supabase = getSupabaseServerClient();

  // Pass embedding as array - Supabase will convert it to vector type
  // The array format is: [1.0, 2.0, 3.0, ...]
  const embeddingArray = queryEmbedding;

  // Use the match_chunks RPC function for vector similarity search
  // Type assertion needed because custom RPC functions aren't in the generated types
  const { data, error } = (await supabase.rpc('match_chunks', {
    query_embedding: embeddingArray,
    match_threshold: 0.0,
    match_count: limit,
    tenant_id_filter: tenantId,
    content_types: contentTypeFilters && contentTypeFilters.length > 0 ? contentTypeFilters : null,
  } as any)) as { data: MatchChunksResult[] | null; error: { message: string } | null };

  if (error) {
    throw new Error(`Vector search failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row: MatchChunksResult) => {
    const chunk = rowToChunk(row);
    // Cosine similarity: 1 - distance (distance is 0-2, similarity is 0-1)
    // Ensure score is between 0 and 1
    const score = Math.max(0, Math.min(row.similarity || 0, 1.0));
    return { chunk, score };
  });
};

/**
 * Merge and deduplicate search results
 */
const mergeResults = (
  keywordResults: Array<{ chunk: DocumentChunk; score: number }>,
  vectorResults: Array<{ chunk: DocumentChunk; score: number }>,
  config: HybridSearchConfig
): Array<{ chunk: DocumentChunk; score: number; matchType: 'keyword' | 'vector' | 'hybrid' }> => {
  const chunkMap = new Map<string, { chunk: DocumentChunk; keywordScore: number; vectorScore: number }>();

  // Add keyword results
  for (const result of keywordResults) {
    const existing = chunkMap.get(result.chunk.id);
    if (existing) {
      existing.keywordScore = Math.max(existing.keywordScore, result.score);
    } else {
      chunkMap.set(result.chunk.id, {
        chunk: result.chunk,
        keywordScore: result.score,
        vectorScore: 0,
      });
    }
  }

  // Add vector results
  for (const result of vectorResults) {
    const existing = chunkMap.get(result.chunk.id);
    if (existing) {
      existing.vectorScore = Math.max(existing.vectorScore, result.score);
    } else {
      chunkMap.set(result.chunk.id, {
        chunk: result.chunk,
        keywordScore: 0,
        vectorScore: result.score,
      });
    }
  }

  // Calculate hybrid scores and determine match type
  const mergedResults = Array.from(chunkMap.values()).map((item) => {
    const hybridScore =
      item.keywordScore * config.keywordWeight + item.vectorScore * config.vectorWeight;

    let matchType: 'keyword' | 'vector' | 'hybrid';
    if (item.keywordScore > 0 && item.vectorScore > 0) {
      matchType = 'hybrid';
    } else if (item.keywordScore > 0) {
      matchType = 'keyword';
    } else {
      matchType = 'vector';
    }

    return {
      chunk: item.chunk,
      score: hybridScore,
      matchType,
    };
  });

  // Sort by hybrid score descending
  mergedResults.sort((a, b) => b.score - a.score);

  return mergedResults;
};

/**
 * Main search function implementing hybrid search
 */
export const search = async (request: SearchRequest): Promise<SearchResponse> => {
  const startTime = Date.now();
  const { tenantId, query, k = 8, filters } = request;

  if (!query || query.trim().length === 0) {
    return {
      chunks: [],
      totalCount: 0,
      queryTime: 0,
    };
  }

  // Determine content type filters
  const contentTypeFilters =
    filters?.contentType && filters.contentType !== 'all'
      ? Array.isArray(filters.contentType)
        ? filters.contentType
        : [filters.contentType]
      : null;

  // Apply document ID filters if provided
  const documentIdFilters = filters?.documentIds;

  const config = DEFAULT_CONFIG;

  try {
    // Perform keyword and vector searches in parallel
    const [keywordResults, queryEmbedding] = await Promise.all([
      performKeywordSearch(query, tenantId, contentTypeFilters, config.keywordLimit),
      generateEmbedding(query),
    ]);

    const vectorResults = await performVectorSearch(
      queryEmbedding,
      tenantId,
      contentTypeFilters,
      config.vectorLimit
    );

    // Merge and deduplicate results
    let mergedResults = mergeResults(keywordResults, vectorResults, config);

    // Apply document ID filter if provided
    if (documentIdFilters && documentIdFilters.length > 0) {
      mergedResults = mergedResults.filter((result) =>
        documentIdFilters.includes(result.chunk.documentId)
      );
    }

    // Take top-k results
    const topResults = mergedResults.slice(0, k);

    // Convert to SearchResult format
    const searchResults: SearchResult[] = topResults.map((result) => ({
      chunk: result.chunk,
      score: result.score,
      matchType: result.matchType,
    }));

    const queryTime = Date.now() - startTime;

    return {
      chunks: searchResults,
      totalCount: searchResults.length,
      queryTime,
    };
  } catch (error) {
    throw new Error(
      `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

