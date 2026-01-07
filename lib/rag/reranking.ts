/**
 * Re-ranking Service for RAG Search Results
 * Implements cross-encoder re-ranking and MMR (Maximal Marginal Relevance) for diversity
 */

// Import shim for Node.js environment (required for OpenAI SDK)
import 'openai/shims/node';
import { generateEmbedding } from '@/lib/ingestion/embeddings';
import { logError, logInfo, logApiUsage } from '@/lib/utils/logger';
import type { SearchResult, DocumentChunk } from '@/types/domain';

/**
 * Re-ranking configuration
 */
export interface RerankingConfig {
  enabled: boolean;
  topKCandidates: number; // Number of candidates to re-rank (e.g., 20-50)
  topKResults: number; // Number of final results after re-ranking (e.g., 8)
  useMMR: boolean; // Enable Maximal Marginal Relevance for diversity
  mmrLambda: number; // MMR lambda parameter (0-1): 0 = pure relevance, 1 = pure diversity
  enableCache: boolean;
  cacheMaxSize: number;
  cacheTTL: number; // milliseconds
}

/**
 * Default re-ranking configuration
 */
const DEFAULT_CONFIG: RerankingConfig = {
  enabled: process.env.ENABLE_RERANKING === 'true',
  topKCandidates: parseInt(process.env.RERANKING_TOP_K_CANDIDATES || '30', 10),
  topKResults: parseInt(process.env.RERANKING_TOP_K_RESULTS || '8', 10),
  useMMR: process.env.ENABLE_MMR === 'true',
  mmrLambda: parseFloat(process.env.MMR_LAMBDA || '0.5'),
  enableCache: true,
  cacheMaxSize: 1000,
  cacheTTL: 60 * 60 * 1000, // 1 hour
};

/**
 * Cache entry for re-ranking scores
 */
interface RerankingCacheEntry {
  scores: Map<string, number>; // chunkId -> score
  timestamp: number;
}

/**
 * In-memory cache for re-ranking scores
 * Key: query text (normalized)
 */
const rerankingCache = new Map<string, RerankingCacheEntry>();

/**
 * Calculate cosine similarity between two vectors
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
};

/**
 * Generate cache key for re-ranking
 */
const getRerankingCacheKey = (query: string): string => {
  return query.trim().toLowerCase();
};

/**
 * Get cached re-ranking scores
 */
const getCachedRerankingScores = (
  query: string,
  chunkIds: string[],
  ttl: number
): Map<string, number> | null => {
  const key = getRerankingCacheKey(query);
  const entry = rerankingCache.get(key);

  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now - entry.timestamp > ttl) {
    rerankingCache.delete(key);
    return null;
  }

  // Return scores for requested chunks only
  const scores = new Map<string, number>();
  for (const chunkId of chunkIds) {
    const score = entry.scores.get(chunkId);
    if (score !== undefined) {
      scores.set(chunkId, score);
    }
  }

  // If we have scores for all chunks, return them
  if (scores.size === chunkIds.length) {
    return scores;
  }

  return null;
};

/**
 * Store re-ranking scores in cache
 */
const setCachedRerankingScores = (
  query: string,
  scores: Map<string, number>,
  maxSize: number
): void => {
  // Evict oldest entries if cache is full
  if (rerankingCache.size >= maxSize) {
    const firstKey = rerankingCache.keys().next().value;
    if (firstKey) {
      rerankingCache.delete(firstKey);
    }
  }

  const key = getRerankingCacheKey(query);
  rerankingCache.set(key, {
    scores: new Map(scores),
    timestamp: Date.now(),
  });
};

/**
 * Clear the re-ranking cache
 */
export const clearRerankingCache = (): void => {
  rerankingCache.clear();
};

/**
 * Calculate relevance score using semantic similarity
 * This uses embeddings to compute query-chunk similarity
 * Can be replaced with actual cross-encoder model in the future
 */
const calculateRelevanceScore = async (
  query: string,
  chunk: DocumentChunk
): Promise<number> => {
  try {
    // Generate embeddings for query and chunk
    const [queryEmbedding, chunkEmbedding] = await Promise.all([
      generateEmbedding(query),
      chunk.embedding && chunk.embedding.length > 0
        ? Promise.resolve(chunk.embedding)
        : generateEmbedding(chunk.chunkText),
    ]);

    // Calculate cosine similarity as relevance score
    const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);

    // Normalize to 0-1 range (cosine similarity is already -1 to 1, but typically 0-1)
    return Math.max(0, Math.min(similarity, 1.0));
  } catch (error) {
    logError('Failed to calculate relevance score', error instanceof Error ? error : new Error(String(error)), {
      query: query.substring(0, 100),
      chunkId: chunk.id,
    });
    // Return a low score on error
    return 0;
  }
};

/**
 * Calculate Maximal Marginal Relevance (MMR) score
 * Balances relevance and diversity
 */
const calculateMMRScore = (
  relevanceScore: number,
  maxSimilarityToSelected: number,
  lambda: number
): number => {
  // MMR formula: lambda * relevance - (1 - lambda) * max_similarity_to_selected
  return lambda * relevanceScore - (1 - lambda) * maxSimilarityToSelected;
};

/**
 * Calculate similarity between two chunks using their embeddings
 */
const calculateChunkSimilarity = (chunk1: DocumentChunk, chunk2: DocumentChunk): number => {
  if (!chunk1.embedding || !chunk2.embedding) {
    return 0;
  }

  if (chunk1.embedding.length === 0 || chunk2.embedding.length === 0) {
    return 0;
  }

  return cosineSimilarity(chunk1.embedding, chunk2.embedding);
};

/**
 * Re-rank search results using cross-encoder approach
 * Uses semantic similarity between query and chunks
 */
const rerankWithCrossEncoder = async (
  query: string,
  candidates: SearchResult[],
  config: RerankingConfig
): Promise<SearchResult[]> => {
  const startTime = Date.now();

  // Check cache first
  if (config.enableCache) {
    const chunkIds = candidates.map((c) => c.chunk.id);
    const cachedScores = getCachedRerankingScores(query, chunkIds, config.cacheTTL);

    if (cachedScores) {
      // Use cached scores
      const reranked = candidates
        .map((candidate) => ({
          ...candidate,
          score: cachedScores.get(candidate.chunk.id) || candidate.score,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, config.topKResults);

      const queryTime = Date.now() - startTime;
      logInfo('Re-ranking completed (cached)', {
        query: query.substring(0, 100),
        candidatesCount: candidates.length,
        resultsCount: reranked.length,
        queryTime,
      });

      return reranked;
    }
  }

  // Calculate relevance scores for all candidates
  const scores = new Map<string, number>();

  // Process in parallel batches to improve performance
  const batchSize = 10;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchPromises = batch.map(async (candidate) => {
      const score = await calculateRelevanceScore(query, candidate.chunk);
      scores.set(candidate.chunk.id, score);
    });

    await Promise.all(batchPromises);
  }

  // Store in cache
  if (config.enableCache) {
    setCachedRerankingScores(query, scores, config.cacheMaxSize);
  }

  // Re-rank by relevance scores
  const reranked = candidates
    .map((candidate) => ({
      ...candidate,
      score: scores.get(candidate.chunk.id) || candidate.score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, config.topKResults);

  const queryTime = Date.now() - startTime;
  logInfo('Re-ranking completed', {
    query: query.substring(0, 100),
    candidatesCount: candidates.length,
    resultsCount: reranked.length,
    queryTime,
  });

  logApiUsage('reranking', 'cross-encoder', undefined, undefined, {
    candidatesCount: candidates.length,
    resultsCount: reranked.length,
    queryTime,
  });

  return reranked;
};

/**
 * Apply MMR (Maximal Marginal Relevance) to ensure diversity
 */
const applyMMR = (
  candidates: SearchResult[],
  config: RerankingConfig
): SearchResult[] => {
  if (candidates.length === 0) {
    return [];
  }

  const selected: SearchResult[] = [];
  const remaining = [...candidates];

  // Always select the highest relevance score first
  if (remaining.length > 0) {
    remaining.sort((a, b) => b.score - a.score);
    const first = remaining.shift();
    if (first) {
      selected.push(first);
    }
  }

  // Select remaining items using MMR
  while (selected.length < config.topKResults && remaining.length > 0) {
    let bestMMRScore = -Infinity;
    let bestIndex = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];

      // Find maximum similarity to already selected chunks
      let maxSimilarity = 0;
      for (const selectedItem of selected) {
        const similarity = calculateChunkSimilarity(candidate.chunk, selectedItem.chunk);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      // Calculate MMR score
      const mmrScore = calculateMMRScore(candidate.score, maxSimilarity, config.mmrLambda);

      if (mmrScore > bestMMRScore) {
        bestMMRScore = mmrScore;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      const selectedItem = remaining.splice(bestIndex, 1)[0];
      selected.push(selectedItem);
    } else {
      break;
    }
  }

  return selected;
};

/**
 * Main re-ranking function
 * Re-ranks search results using cross-encoder approach and optionally applies MMR
 */
export const rerank = async (
  query: string,
  candidates: SearchResult[],
  config: Partial<RerankingConfig> = {}
): Promise<SearchResult[]> => {
  const finalConfig: RerankingConfig = { ...DEFAULT_CONFIG, ...config };

  // Early return if re-ranking is disabled
  if (!finalConfig.enabled) {
    return candidates.slice(0, finalConfig.topKResults);
  }

  // Early return if no candidates
  if (candidates.length === 0) {
    return [];
  }

  // If we have fewer candidates than topKResults, no need to re-rank
  if (candidates.length <= finalConfig.topKResults) {
    return candidates;
  }

  try {
    // Take top-k candidates for re-ranking (to limit computation)
    const topCandidates = candidates.slice(0, finalConfig.topKCandidates);

    // Re-rank using cross-encoder approach
    let reranked = await rerankWithCrossEncoder(query, topCandidates, finalConfig);

    // Apply MMR if enabled
    if (finalConfig.useMMR && reranked.length > 1) {
      reranked = applyMMR(reranked, finalConfig);
    }

    return reranked;
  } catch (error) {
    logError('Re-ranking failed', error instanceof Error ? error : new Error(String(error)), {
      query: query.substring(0, 100),
      candidatesCount: candidates.length,
    });

    // Fallback to original top-k results
    return candidates.slice(0, finalConfig.topKResults);
  }
};

