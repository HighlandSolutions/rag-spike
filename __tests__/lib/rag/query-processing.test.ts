/**
 * Unit tests for query processing service
 */

// Mock dependencies before imports
jest.mock('@/lib/agent/llm-client');

import { processQuery, getQueryVariations, clearQueryCache, type QueryProcessingConfig } from '@/lib/rag/query-processing';
import { getLLMResponse } from '@/lib/agent/llm-client';
import type { UserContext } from '@/types/domain';
import type { ChatMessage } from '@/types/chat';

describe('rag/query-processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearQueryCache();
  });

  describe('processQuery', () => {
    it('should return original query when processing is disabled', async () => {
      const config: Partial<QueryProcessingConfig> = {
        enabled: false,
      };

      const result = await processQuery('test query', config);

      expect(result.originalQuery).toBe('test query');
      expect(result.expandedQuery).toBeUndefined();
      expect(result.rewrittenQueries).toEqual([]);
      expect(result.understanding).toBeUndefined();
      expect(getLLMResponse).not.toHaveBeenCalled();
    });

    it('should process query with expansion when enabled', async () => {
      (getLLMResponse as jest.Mock).mockResolvedValue('term1, term2, term3');

      const config: Partial<QueryProcessingConfig> = {
        enabled: true,
        enableExpansion: true,
        enableRewriting: false,
        enableUnderstanding: false,
        maxExpansions: 3,
      };

      const result = await processQuery('test query', config);

      expect(result.originalQuery).toBe('test query');
      expect(result.expandedQuery).toContain('test query');
      expect(result.expandedQuery).toContain('term1');
      expect(result.rewrittenQueries).toEqual([]);
      expect(getLLMResponse).toHaveBeenCalled();
    });

    it('should process query with rewriting when enabled', async () => {
      (getLLMResponse as jest.Mock).mockResolvedValue('test query variation 1\ntest query variation 2');

      const config: Partial<QueryProcessingConfig> = {
        enabled: true,
        enableExpansion: false,
        enableRewriting: true,
        enableUnderstanding: false,
        maxRewrites: 2,
      };

      const result = await processQuery('test query', config);

      expect(result.originalQuery).toBe('test query');
      expect(result.expandedQuery).toBeUndefined();
      expect(result.rewrittenQueries.length).toBeGreaterThan(0);
      expect(getLLMResponse).toHaveBeenCalled();
    });

    it('should process query with understanding when enabled', async () => {
      (getLLMResponse as jest.Mock).mockResolvedValue(
        JSON.stringify({
          intent: 'factual',
          entities: ['entity1', 'entity2'],
          keyTerms: ['term1', 'term2'],
        })
      );

      const config: Partial<QueryProcessingConfig> = {
        enabled: true,
        enableExpansion: false,
        enableRewriting: false,
        enableUnderstanding: true,
      };

      const result = await processQuery('test query', config);

      expect(result.originalQuery).toBe('test query');
      expect(result.understanding).toBeDefined();
      expect(result.understanding?.intent).toBe('factual');
      expect(result.understanding?.entities).toEqual(['entity1', 'entity2']);
      expect(getLLMResponse).toHaveBeenCalled();
    });

    it('should enhance query with conversation context', async () => {
      const conversationHistory: ChatMessage[] = [
        {
          id: 'msg1',
          role: 'user',
          content: 'What is React?',
          timestamp: new Date(),
        },
        {
          id: 'msg2',
          role: 'assistant',
          content: 'React is a JavaScript library...',
          timestamp: new Date(),
        },
        {
          id: 'msg3',
          role: 'user',
          content: 'How do I use it?',
          timestamp: new Date(),
        },
      ];

      const config: Partial<QueryProcessingConfig> = {
        enabled: false, // Disable processing to test context enhancement only
      };

      const result = await processQuery('it', config, undefined, conversationHistory);

      // Query should be enhanced with context
      expect(result.originalQuery).toBe('it');
    });

    it('should use cache when enabled', async () => {
      (getLLMResponse as jest.Mock).mockResolvedValue('term1, term2');

      const config: Partial<QueryProcessingConfig> = {
        enabled: true,
        enableExpansion: true,
        enableRewriting: false,
        enableUnderstanding: false,
        enableCache: true,
        cacheTTL: 1000 * 60 * 60, // 1 hour
      };

      // First call
      const result1 = await processQuery('test query', config);
      expect(getLLMResponse).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await processQuery('test query', config);
      expect(getLLMResponse).toHaveBeenCalledTimes(1); // Still 1, not 2

      expect(result1.expandedQuery).toEqual(result2.expandedQuery);
    });

    it('should handle LLM errors gracefully', async () => {
      (getLLMResponse as jest.Mock).mockRejectedValue(new Error('LLM API error'));

      const config: Partial<QueryProcessingConfig> = {
        enabled: true,
        enableExpansion: true,
        enableRewriting: true,
        enableUnderstanding: true,
      };

      const result = await processQuery('test query', config);

      // Should return original query even on error
      expect(result.originalQuery).toBe('test query');
      expect(result.expandedQuery).toBeUndefined();
      expect(result.rewrittenQueries).toEqual([]);
      expect(result.understanding).toBeUndefined();
    });

    it('should incorporate user context in processing', async () => {
      (getLLMResponse as jest.Mock).mockResolvedValue('term1, term2');

      const userContext: UserContext = {
        role: 'engineer',
        level: 'senior',
      };

      const config: Partial<QueryProcessingConfig> = {
        enabled: true,
        enableExpansion: true,
        enableRewriting: false,
        enableUnderstanding: false,
      };

      await processQuery('test query', config, userContext);

      // Check that user context was included in LLM prompt
      const callArgs = (getLLMResponse as jest.Mock).mock.calls[0][0];
      expect(callArgs).toContain('engineer');
      expect(callArgs).toContain('senior');
    });
  });

  describe('getQueryVariations', () => {
    it('should return only original query when no processing', () => {
      const processed = {
        originalQuery: 'test query',
        rewrittenQueries: [],
      };

      const variations = getQueryVariations(processed);

      expect(variations).toEqual(['test query']);
    });

    it('should include expanded query in variations', () => {
      const processed = {
        originalQuery: 'test query',
        expandedQuery: 'test query term1 term2',
        rewrittenQueries: [],
      };

      const variations = getQueryVariations(processed);

      expect(variations).toContain('test query');
      expect(variations).toContain('test query term1 term2');
      expect(variations.length).toBe(2);
    });

    it('should include rewritten queries in variations', () => {
      const processed = {
        originalQuery: 'test query',
        rewrittenQueries: ['variation 1', 'variation 2'],
      };

      const variations = getQueryVariations(processed);

      expect(variations).toContain('test query');
      expect(variations).toContain('variation 1');
      expect(variations).toContain('variation 2');
      expect(variations.length).toBe(3);
    });

    it('should deduplicate variations', () => {
      const processed = {
        originalQuery: 'test query',
        expandedQuery: 'test query',
        rewrittenQueries: ['test query', 'variation 1'],
      };

      const variations = getQueryVariations(processed);

      // Should not include duplicates
      expect(variations.filter((v) => v === 'test query').length).toBe(1);
      expect(variations).toContain('variation 1');
    });

    it('should combine all variations', () => {
      const processed = {
        originalQuery: 'test query',
        expandedQuery: 'test query expanded',
        rewrittenQueries: ['variation 1', 'variation 2'],
      };

      const variations = getQueryVariations(processed);

      expect(variations.length).toBe(4);
      expect(variations).toContain('test query');
      expect(variations).toContain('test query expanded');
      expect(variations).toContain('variation 1');
      expect(variations).toContain('variation 2');
    });
  });

  describe('clearQueryCache', () => {
    it('should clear the query cache', async () => {
      (getLLMResponse as jest.Mock).mockResolvedValue('term1, term2');

      const config: Partial<QueryProcessingConfig> = {
        enabled: true,
        enableExpansion: true,
        enableRewriting: false,
        enableUnderstanding: false,
        enableCache: true,
      };

      // Process query to populate cache
      await processQuery('test query', config);
      expect(getLLMResponse).toHaveBeenCalledTimes(1);

      // Clear cache
      clearQueryCache();

      // Process same query again - should call LLM again
      await processQuery('test query', config);
      expect(getLLMResponse).toHaveBeenCalledTimes(2);
    });
  });
});




