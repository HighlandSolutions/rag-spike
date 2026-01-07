/**
 * Query Processing Service for RAG Search
 * Implements query expansion, rewriting, and understanding to improve retrieval quality
 */

import { getLLMResponse } from '@/lib/agent/llm-client';
import { logError, logInfo } from '@/lib/utils/logger';
import type { UserContext } from '@/types/domain';
import type { ChatMessage } from '@/types/chat';

/**
 * Query processing configuration
 */
export interface QueryProcessingConfig {
  enabled: boolean;
  enableExpansion: boolean; // Generate related terms and synonyms
  enableRewriting: boolean; // Generate multiple query variations
  enableUnderstanding: boolean; // Parse query intent and extract entities
  maxExpansions: number; // Maximum number of expansion terms to generate
  maxRewrites: number; // Maximum number of query variations to generate
  enableCache: boolean;
  cacheMaxSize: number;
  cacheTTL: number; // milliseconds
}

/**
 * Default query processing configuration
 */
const DEFAULT_CONFIG: QueryProcessingConfig = {
  enabled: process.env.ENABLE_QUERY_PROCESSING === 'true',
  enableExpansion: process.env.ENABLE_QUERY_EXPANSION === 'true',
  enableRewriting: process.env.ENABLE_QUERY_REWRITING === 'true',
  enableUnderstanding: process.env.ENABLE_QUERY_UNDERSTANDING === 'true',
  maxExpansions: parseInt(process.env.QUERY_MAX_EXPANSIONS || '5', 10),
  maxRewrites: parseInt(process.env.QUERY_MAX_REWRITES || '3', 10),
  enableCache: true,
  cacheMaxSize: 500,
  cacheTTL: 60 * 60 * 1000, // 1 hour
};

/**
 * Query intent types
 */
export type QueryIntent = 
  | 'factual' // Seeking factual information
  | 'how-to' // How-to or procedural question
  | 'comparison' // Comparing multiple things
  | 'definition' // Definition or explanation
  | 'list' // Requesting a list
  | 'unknown'; // Unknown or mixed intent

/**
 * Query understanding result
 */
export interface QueryUnderstanding {
  intent: QueryIntent;
  entities: string[]; // Key entities and concepts extracted
  keyTerms: string[]; // Important terms for search
  requiredContentTypes?: string[]; // Suggested content types based on query
}

/**
 * Processed query with variations
 */
export interface ProcessedQuery {
  originalQuery: string;
  expandedQuery?: string; // Query with expanded terms
  rewrittenQueries: string[]; // Multiple query variations
  understanding?: QueryUnderstanding;
}

/**
 * Cache entry for processed queries
 */
interface QueryCacheEntry {
  processed: ProcessedQuery;
  timestamp: number;
}

/**
 * In-memory cache for processed queries
 * Key: query text (normalized) + user context hash
 */
const queryCache = new Map<string, QueryCacheEntry>();

/**
 * Generate cache key for query processing
 */
const getCacheKey = (query: string, userContext?: UserContext): string => {
  const normalizedQuery = query.trim().toLowerCase();
  const contextHash = userContext 
    ? `${userContext.role || ''}_${userContext.level || ''}` 
    : '';
  return `${normalizedQuery}:${contextHash}`;
};

/**
 * Get cached processed query
 */
const getCachedQuery = (
  query: string,
  userContext: UserContext | undefined,
  ttl: number
): ProcessedQuery | null => {
  const key = getCacheKey(query, userContext);
  const entry = queryCache.get(key);

  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now - entry.timestamp > ttl) {
    queryCache.delete(key);
    return null;
  }

  return entry.processed;
};

/**
 * Store processed query in cache
 */
const setCachedQuery = (
  query: string,
  userContext: UserContext | undefined,
  processed: ProcessedQuery,
  maxSize: number
): void => {
  // Evict oldest entries if cache is full
  if (queryCache.size >= maxSize) {
    const firstKey = queryCache.keys().next().value;
    if (firstKey) {
      queryCache.delete(firstKey);
    }
  }

  const key = getCacheKey(query, userContext);
  queryCache.set(key, {
    processed,
    timestamp: Date.now(),
  });
};

/**
 * Clear the query processing cache
 */
export const clearQueryCache = (): void => {
  queryCache.clear();
};

/**
 * Expand query with related terms and synonyms using LLM
 */
const expandQuery = async (
  query: string,
  userContext: UserContext | undefined,
  config: QueryProcessingConfig
): Promise<string | undefined> => {
  if (!config.enableExpansion) {
    return undefined;
  }

  try {
    const roleContext = userContext?.role 
      ? `The user is a ${userContext.role}. `
      : '';
    const levelContext = userContext?.level
      ? `The user is at ${userContext.level} level. `
      : '';

    const prompt = `You are a search query expansion assistant. Generate related terms, synonyms, and contextually relevant phrases for the given query.

${roleContext}${levelContext}
Original query: "${query}"

Generate ${config.maxExpansions} related terms, synonyms, or contextually relevant phrases that would help find relevant information. 
- Focus on domain-specific terminology
- Include technical terms if relevant
- Include common synonyms
- Keep terms concise (1-3 words each)

Return ONLY a comma-separated list of terms, nothing else. Example: "term1, term2, term3"`;

    const response = await getLLMResponse(prompt, {
      temperature: 0.7,
      maxTokens: 200,
      stream: false,
    });

    if (!response || response.trim().length === 0) {
      return undefined;
    }

    // Parse comma-separated terms
    const terms = response
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0)
      .slice(0, config.maxExpansions);

    if (terms.length === 0) {
      return undefined;
    }

    // Combine original query with expanded terms
    const expandedQuery = `${query} ${terms.join(' ')}`;
    return expandedQuery;
  } catch (error) {
    logError('Query expansion failed', error instanceof Error ? error : new Error(String(error)), {
      query: query.substring(0, 100),
    });
    return undefined;
  }
};

/**
 * Rewrite query in multiple ways using LLM
 */
const rewriteQuery = async (
  query: string,
  userContext: UserContext | undefined,
  config: QueryProcessingConfig
): Promise<string[]> => {
  if (!config.enableRewriting) {
    return [];
  }

  try {
    const roleContext = userContext?.role 
      ? `The user is a ${userContext.role}. `
      : '';
    const levelContext = userContext?.level
      ? `The user is at ${userContext.level} level. `
      : '';

    const prompt = `You are a search query rewriting assistant. Rewrite the given query in ${config.maxRewrites} different ways to improve search retrieval.

${roleContext}${levelContext}
Original query: "${query}"

Generate ${config.maxRewrites} alternative formulations of this query:
1. A more specific version
2. A more general version  
3. A question-to-statement conversion (or vice versa)
4. Additional variations as needed

Each variation should:
- Preserve the core intent
- Use different wording
- Be optimized for information retrieval
- Be concise (under 20 words)

Return ONLY the rewritten queries, one per line, with no numbering or labels. Example:
query variation 1
query variation 2
query variation 3`;

    const response = await getLLMResponse(prompt, {
      temperature: 0.8,
      maxTokens: 300,
      stream: false,
    });

    if (!response || response.trim().length === 0) {
      return [];
    }

    // Parse line-separated queries
    const rewrittenQueries = response
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.match(/^\d+[\.\)]/)) // Remove numbering
      .slice(0, config.maxRewrites);

    return rewrittenQueries;
  } catch (error) {
    logError('Query rewriting failed', error instanceof Error ? error : new Error(String(error)), {
      query: query.substring(0, 100),
    });
    return [];
  }
};

/**
 * Understand query intent and extract entities
 */
const understandQuery = async (
  query: string,
  userContext: UserContext | undefined,
  config: QueryProcessingConfig
): Promise<QueryUnderstanding | undefined> => {
  if (!config.enableUnderstanding) {
    return undefined;
  }

  try {
    const prompt = `You are a query understanding assistant. Analyze the given query to determine its intent and extract key information.

Query: "${query}"

Analyze the query and provide:
1. Intent type (one of: factual, how-to, comparison, definition, list, unknown)
2. Key entities and concepts (important nouns, topics, subjects)
3. Important search terms (keywords that should be prioritized)

Return your analysis in this exact JSON format:
{
  "intent": "factual|how-to|comparison|definition|list|unknown",
  "entities": ["entity1", "entity2"],
  "keyTerms": ["term1", "term2"],
  "requiredContentTypes": ["optional", "content", "types"]
}

Only return the JSON, nothing else.`;

    const response = await getLLMResponse(prompt, {
      temperature: 0.3,
      maxTokens: 300,
      stream: false,
    });

    if (!response || response.trim().length === 0) {
      return undefined;
    }

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return undefined;
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      intent?: string;
      entities?: string[];
      keyTerms?: string[];
      requiredContentTypes?: string[];
    };

    const intent = (parsed.intent as QueryIntent) || 'unknown';
    const entities = parsed.entities || [];
    const keyTerms = parsed.keyTerms || [];

    return {
      intent,
      entities,
      keyTerms,
      requiredContentTypes: parsed.requiredContentTypes,
    };
  } catch (error) {
    logError('Query understanding failed', error instanceof Error ? error : new Error(String(error)), {
      query: query.substring(0, 100),
    });
    return undefined;
  }
};

/**
 * Incorporate conversation context into query
 */
const enhanceWithContext = (
  query: string,
  conversationHistory: ChatMessage[] | undefined
): string => {
  if (!conversationHistory || conversationHistory.length === 0) {
    return query;
  }

  // Get recent user messages for context (last 3 messages)
  const recentMessages = conversationHistory
    .filter((msg) => msg.role === 'user')
    .slice(-3)
    .map((msg) => msg.content);

  if (recentMessages.length === 0) {
    return query;
  }

  // Simple context enhancement: prepend context if query is short or contains pronouns
  const hasPronouns = /\b(it|they|this|that|these|those|he|she|them)\b/i.test(query);
  const isShort = query.split(/\s+/).length < 5;

  if (hasPronouns || isShort) {
    const context = recentMessages.join(' ');
    return `${context} ${query}`;
  }

  return query;
};

/**
 * Process query with expansion, rewriting, and understanding
 */
export const processQuery = async (
  query: string,
  config: Partial<QueryProcessingConfig> = {},
  userContext?: UserContext,
  conversationHistory?: ChatMessage[]
): Promise<ProcessedQuery> => {
  const finalConfig: QueryProcessingConfig = { ...DEFAULT_CONFIG, ...config };

  // Early return if processing is disabled
  if (!finalConfig.enabled) {
    return {
      originalQuery: query,
      rewrittenQueries: [],
    };
  }

  // Enhance query with conversation context
  const enhancedQuery = enhanceWithContext(query, conversationHistory);

  // Check cache first
  if (finalConfig.enableCache) {
    const cached = getCachedQuery(enhancedQuery, userContext, finalConfig.cacheTTL);
    if (cached) {
      logInfo('Query processing completed (cached)', {
        query: enhancedQuery.substring(0, 100),
      });
      return cached;
    }
  }

  const startTime = Date.now();

  // Process query in parallel where possible
  const [expandedQuery, rewrittenQueries, understanding] = await Promise.all([
    expandQuery(enhancedQuery, userContext, finalConfig),
    rewriteQuery(enhancedQuery, userContext, finalConfig),
    understandQuery(enhancedQuery, userContext, finalConfig),
  ]);

  const processed: ProcessedQuery = {
    originalQuery: query,
    expandedQuery,
    rewrittenQueries,
    understanding,
  };

  // Store in cache
  if (finalConfig.enableCache) {
    setCachedQuery(enhancedQuery, userContext, processed, finalConfig.cacheMaxSize);
  }

  const queryTime = Date.now() - startTime;
  logInfo('Query processing completed', {
    query: enhancedQuery.substring(0, 100),
    hasExpansion: !!expandedQuery,
    rewriteCount: rewrittenQueries.length,
    hasUnderstanding: !!understanding,
    queryTime,
  });

  return processed;
};

/**
 * Generate all query variations for search
 * Returns array of queries to search with (original + expanded + rewritten)
 */
export const getQueryVariations = (processed: ProcessedQuery): string[] => {
  const variations: string[] = [processed.originalQuery];

  // Add expanded query if available
  if (processed.expandedQuery && processed.expandedQuery !== processed.originalQuery) {
    variations.push(processed.expandedQuery);
  }

  // Add rewritten queries
  for (const rewritten of processed.rewrittenQueries) {
    if (rewritten !== processed.originalQuery && !variations.includes(rewritten)) {
      variations.push(rewritten);
    }
  }

  return variations;
};

