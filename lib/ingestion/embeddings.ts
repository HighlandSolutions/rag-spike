/**
 * Embeddings API client
 * Provides embedding generation with caching support
 */

// Import shim for Node.js environment (required for OpenAI SDK)
import 'openai/shims/node';
import OpenAI from 'openai';
import { logError, logApiUsage } from '@/lib/utils/logger';

/**
 * Embeddings configuration
 */
export interface EmbeddingsConfig {
  model: string;
  batchSize: number;
  maxRetries: number;
  retryDelay: number; // milliseconds
  enableCache?: boolean; // Enable caching for query embeddings
  cacheMaxSize?: number; // Maximum cache size (default: 1000)
  cacheTTL?: number; // Cache TTL in milliseconds (default: 1 hour)
}

/**
 * Cache entry for embeddings
 */
interface CacheEntry {
  embedding: number[];
  timestamp: number;
}

/**
 * In-memory cache for embeddings
 */
const embeddingCache = new Map<string, CacheEntry>();

/**
 * Default embeddings configuration
 */
const DEFAULT_CONFIG: EmbeddingsConfig = {
  model: process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-3-small',
  batchSize: 100, // Process in batches to handle rate limits
  maxRetries: 3,
  retryDelay: 1000,
  enableCache: true,
  cacheMaxSize: 1000,
  cacheTTL: 60 * 60 * 1000, // 1 hour
};

/**
 * Generate cache key from text and model
 */
const getCacheKey = (text: string, model: string): string => {
  return `${model}:${text}`;
};

/**
 * Get embedding from cache if available and not expired
 */
const getCachedEmbedding = (text: string, model: string, ttl: number): number[] | null => {
  const key = getCacheKey(text, model);
  const entry = embeddingCache.get(key);

  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now - entry.timestamp > ttl) {
    embeddingCache.delete(key);
    return null;
  }

  return entry.embedding;
};

/**
 * Store embedding in cache
 */
const setCachedEmbedding = (text: string, model: string, embedding: number[], maxSize: number): void => {
  // Evict oldest entries if cache is full
  if (embeddingCache.size >= maxSize) {
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey) {
      embeddingCache.delete(firstKey);
    }
  }

  const key = getCacheKey(text, model);
  embeddingCache.set(key, {
    embedding,
    timestamp: Date.now(),
  });
};

/**
 * Clear the embedding cache
 */
export const clearEmbeddingCache = (): void => {
  embeddingCache.clear();
};

/**
 * Initialize OpenAI client
 */
const getOpenAIClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey,
  });
};

/**
 * Generate embeddings for a batch of texts
 */
export const generateEmbeddings = async (
  texts: string[],
  config: Partial<EmbeddingsConfig> = {}
): Promise<number[][]> => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  if (texts.length === 0) {
    return [];
  }

  const client = getOpenAIClient();
  const embeddings: number[][] = [];

  // Process in batches to handle rate limits
  for (let i = 0; i < texts.length; i += finalConfig.batchSize) {
    const batch = texts.slice(i, i + finalConfig.batchSize);
    let retries = 0;
    let success = false;

    while (!success && retries < finalConfig.maxRetries) {
      try {
        const startTime = Date.now();
        const response = await client.embeddings.create({
          model: finalConfig.model,
          input: batch,
        });

        const batchEmbeddings = response.data.map((item) => item.embedding);
        embeddings.push(...batchEmbeddings);
        
        // Log API usage for cost monitoring
        const totalTokens = response.usage?.total_tokens || 0;
        if (totalTokens > 0) {
          // text-embedding-3-small pricing: $0.02 per 1M tokens
          const estimatedCost = (totalTokens / 1_000_000) * 0.02;
          logApiUsage('openai', 'embeddings', totalTokens, estimatedCost, {
            model: finalConfig.model,
            batchSize: batch.length,
            duration: Date.now() - startTime,
          });
        }
        
        success = true;
      } catch (error) {
        retries++;
        
        logError('Embedding generation failed', error instanceof Error ? error : new Error('Unknown error'), {
          model: finalConfig.model,
          batchSize: batch.length,
          retry: retries,
          maxRetries: finalConfig.maxRetries,
        });

        if (retries >= finalConfig.maxRetries) {
          throw new Error(
            `Failed to generate embeddings after ${finalConfig.maxRetries} retries: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }

        // Wait before retrying (exponential backoff)
        const delay = finalConfig.retryDelay * Math.pow(2, retries - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return embeddings;
};

/**
 * Generate embedding for a single text
 * Uses cache if enabled to avoid redundant API calls
 */
export const generateEmbedding = async (
  text: string,
  config: Partial<EmbeddingsConfig> = {}
): Promise<number[]> => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Check cache if enabled
  if (finalConfig.enableCache) {
    const cached = getCachedEmbedding(
      text,
      finalConfig.model,
      finalConfig.cacheTTL || 60 * 60 * 1000
    );

    if (cached) {
      return cached;
    }
  }

  // Generate embedding
  const embeddings = await generateEmbeddings([text], finalConfig);
  const embedding = embeddings[0] || [];

  // Store in cache if enabled
  if (finalConfig.enableCache && embedding.length > 0) {
    setCachedEmbedding(
      text,
      finalConfig.model,
      embedding,
      finalConfig.cacheMaxSize || 1000
    );
  }

  return embedding;
};

