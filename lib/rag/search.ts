/**
 * RAG Search Service
 * Implements hybrid search combining keyword (full-text) and vector (semantic) search
 */

import { getSupabaseServerClient } from '@/lib/supabase/client';
import { generateEmbedding } from '@/lib/ingestion/embeddings';
import { logError, logInfo } from '@/lib/utils/logger';
import { rerank, type RerankingConfig } from '@/lib/rag/reranking';
import { processQuery, getQueryVariations, type QueryProcessingConfig } from '@/lib/rag/query-processing';
import type { SearchRequest, SearchResponse, SearchResult, DocumentChunk, ChunkMetadata, ContentType } from '@/types/domain';
import type { ChunkRow } from '@/types/database';
import type { ChatMessage } from '@/types/chat';

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

    for (const word of words) {
      const occurrences = (text.match(new RegExp(word, 'gi')) || []).length;
      matchCount += occurrences;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase.rpc as any)('match_chunks', {
    query_embedding: embeddingArray,
    match_threshold: 0.0,
    match_count: limit,
    tenant_id_filter: tenantId,
    content_types: contentTypeFilters && contentTypeFilters.length > 0 ? contentTypeFilters : null,
  })) as { data: MatchChunksResult[] | null; error: { message: string } | null };

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

  // Calculate hybrid scores using weighted combination
  // Default weights: 30% keyword, 70% vector (favor semantic similarity)
  // This balances exact matches with conceptual relevance
  const mergedResults = Array.from(chunkMap.values()).map((item) => {
    // Weighted average: combines both scores based on configuration
    const hybridScore =
      item.keywordScore * config.keywordWeight + item.vectorScore * config.vectorWeight;

    // Determine match type for transparency and debugging
    // Hybrid matches (appearing in both) are typically the most relevant
    let matchType: 'keyword' | 'vector' | 'hybrid';
    if (item.keywordScore > 0 && item.vectorScore > 0) {
      matchType = 'hybrid'; // Best: appears in both keyword and vector results
    } else if (item.keywordScore > 0) {
      matchType = 'keyword'; // Only found via keyword search
    } else {
      matchType = 'vector'; // Only found via vector search
    }

    return {
      chunk: item.chunk,
      score: hybridScore,
      matchType,
    };
  });

  // Sort by hybrid score descending (highest relevance first)
  mergedResults.sort((a, b) => b.score - a.score);

  return mergedResults;
};

/**
 * Merge results from multiple query variations
 * Combines results from different query variations, deduplicates, and boosts scores
 */
const mergeVariationResults = (
  allResults: Array<Array<{ chunk: DocumentChunk; score: number; matchType: 'keyword' | 'vector' | 'hybrid' }>>
): Array<{ chunk: DocumentChunk; score: number; matchType: 'keyword' | 'vector' | 'hybrid' }> => {
  const chunkMap = new Map<string, {
    chunk: DocumentChunk;
    scores: number[];
    matchTypes: Set<'keyword' | 'vector' | 'hybrid'>;
  }>();

  // Collect all results from all variations
  for (const variationResults of allResults) {
    for (const result of variationResults) {
      const existing = chunkMap.get(result.chunk.id);
      if (existing) {
        existing.scores.push(result.score);
        existing.matchTypes.add(result.matchType);
      } else {
        chunkMap.set(result.chunk.id, {
          chunk: result.chunk,
          scores: [result.score],
          matchTypes: new Set([result.matchType]),
        });
      }
    }
  }

  // Calculate final scores: max score with boost for appearing in multiple variations
  const mergedResults = Array.from(chunkMap.values()).map((item) => {
    // Use max score as base, with boost for multiple matches
    const maxScore = Math.max(...item.scores);
    const variationCount = item.scores.length;
    // Boost: +0.1 per additional variation (capped at +0.3)
    const boost = Math.min((variationCount - 1) * 0.1, 0.3);
    const finalScore = Math.min(maxScore + boost, 1.0);

    // Determine match type: prefer hybrid, then vector, then keyword
    let matchType: 'keyword' | 'vector' | 'hybrid' = 'keyword';
    if (item.matchTypes.has('hybrid')) {
      matchType = 'hybrid';
    } else if (item.matchTypes.has('vector')) {
      matchType = 'vector';
    }

    return {
      chunk: item.chunk,
      score: finalScore,
      matchType,
    };
  });

  // Sort by score descending
  mergedResults.sort((a, b) => b.score - a.score);

  return mergedResults;
};

/**
 * Main search function implementing hybrid search with optional query processing and re-ranking
 * Optimized with query result caching and improved error handling
 */
export const search = async (
  request: SearchRequest,
  rerankingConfig?: Partial<RerankingConfig>,
  queryProcessingConfig?: Partial<QueryProcessingConfig>,
  conversationHistory?: ChatMessage[]
): Promise<SearchResponse> => {
  const startTime = Date.now();
  const { tenantId, query, k = 8, filters, userContext } = request;

  if (!query || query.trim().length === 0) {
    return {
      chunks: [],
      totalCount: 0,
      queryTime: 0,
    };
  }

  // Content type filtering removed - always search all content
  const contentTypeFilters = null;

  // Apply document ID filters if provided
  const documentIdFilters = filters?.documentIds;

  const config = DEFAULT_CONFIG;

  try {
    // Process query (expansion, rewriting, understanding) if enabled
    const processedQuery = await processQuery(
      query,
      queryProcessingConfig,
      userContext,
      conversationHistory
    );

    // Get all query variations to search with
    const queryVariations = getQueryVariations(processedQuery);
    
    // Content type filtering removed - always use null (search all content)
    const finalContentTypeFilters = null;

    logInfo('Searching with query variations', {
      originalQuery: query.substring(0, 100),
      variationCount: queryVariations.length,
      variations: queryVariations.map((q) => q.substring(0, 50)),
    });

    // Search with each query variation in parallel
    const searchPromises = queryVariations.map(async (variation) => {
      const normalizedVariation = variation.trim().toLowerCase();
      
      // Perform keyword and vector searches in parallel
      const [keywordResults, queryEmbedding] = await Promise.all([
        performKeywordSearch(normalizedVariation, tenantId, finalContentTypeFilters, config.keywordLimit),
        generateEmbedding(variation), // Use variation for embedding
      ]);

      // Vector search uses the embedding
      const vectorResults = await performVectorSearch(
        queryEmbedding,
        tenantId,
        finalContentTypeFilters,
        config.vectorLimit
      );

      // Merge results for this variation
      return mergeResults(keywordResults, vectorResults, config);
    });

    // Wait for all searches to complete
    const allVariationResults = await Promise.all(searchPromises);

    // Merge results from all variations
    let mergedResults = mergeVariationResults(allVariationResults);

    // Apply document ID filter if provided
    if (documentIdFilters && documentIdFilters.length > 0) {
      mergedResults = mergedResults.filter((result) =>
        documentIdFilters.includes(result.chunk.documentId)
      );
    }

    // Convert to SearchResult format for re-ranking
    const candidateResults: SearchResult[] = mergedResults.map((result) => ({
      chunk: result.chunk,
      score: result.score,
      matchType: result.matchType,
    }));

    // Apply re-ranking if enabled
    // Re-ranking will take top-k candidates and return top-k results
    const rerankingConfigWithDefaults: Partial<RerankingConfig> = {
      topKResults: k,
      ...rerankingConfig,
    };

    const finalResults = await rerank(query, candidateResults, rerankingConfigWithDefaults);

    const queryTime = Date.now() - startTime;

    // Log performance metrics in development
    if (process.env.NODE_ENV === 'development' && queryTime > 1000) {
      console.warn(`Search query took ${queryTime}ms - consider optimization`);
    }

    return {
      chunks: finalResults,
      totalCount: finalResults.length,
      queryTime,
    };
  } catch (error) {
    const queryTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log error with context
    logError('Search failed', error instanceof Error ? error : new Error(errorMessage), {
      query: query.substring(0, 100),
      tenantId,
      filters: contentTypeFilters,
      queryTime,
    });

    throw new Error(`Search failed: ${errorMessage}`);
  }
};

