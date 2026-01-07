/**
 * Unit tests for re-ranking service
 */

// Mock dependencies before imports
jest.mock('openai');
jest.mock('@/lib/ingestion/embeddings');

import { rerank, clearRerankingCache, type RerankingConfig } from '@/lib/rag/reranking';
import { generateEmbedding } from '@/lib/ingestion/embeddings';
import type { SearchResult, DocumentChunk } from '@/types/domain';

describe('rag/reranking', () => {
  const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());

  const createMockChunk = (id: string, text: string, embedding: number[] | null = mockEmbedding): DocumentChunk => ({
    id,
    tenantId: 'test-tenant',
    documentId: 'doc1',
    chunkText: text,
    chunkMetadata: {},
    contentType: 'policies',
    embedding,
    createdAt: new Date(),
  });

  const createMockSearchResult = (id: string, text: string, score: number, embedding: number[] | null = mockEmbedding): SearchResult => ({
    chunk: createMockChunk(id, text, embedding),
    score,
    matchType: 'hybrid',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    clearRerankingCache();
    (generateEmbedding as jest.Mock).mockResolvedValue(mockEmbedding);
  });

  describe('rerank', () => {
    it('should return top-k results when re-ranking is disabled', async () => {
      const candidates = [
        createMockSearchResult('chunk1', 'test content 1', 0.9),
        createMockSearchResult('chunk2', 'test content 2', 0.8),
        createMockSearchResult('chunk3', 'test content 3', 0.7),
      ];

      const config: Partial<RerankingConfig> = {
        enabled: false,
        topKResults: 2,
      };

      const result = await rerank('test query', candidates, config);

      expect(result.length).toBe(2);
      expect(result[0].chunk.id).toBe('chunk1');
      expect(result[1].chunk.id).toBe('chunk2');
      expect(generateEmbedding).not.toHaveBeenCalled();
    });

    it('should return all candidates if fewer than topKResults', async () => {
      const candidates = [
        createMockSearchResult('chunk1', 'test content 1', 0.9),
        createMockSearchResult('chunk2', 'test content 2', 0.8),
      ];

      const config: Partial<RerankingConfig> = {
        enabled: true,
        topKResults: 5,
      };

      const result = await rerank('test query', candidates, config);

      expect(result.length).toBe(2);
    });

    it('should return empty array for empty candidates', async () => {
      const config: Partial<RerankingConfig> = {
        enabled: true,
        topKResults: 5,
      };

      const result = await rerank('test query', [], config);

      expect(result).toEqual([]);
      expect(generateEmbedding).not.toHaveBeenCalled();
    });

    it('should re-rank candidates when enabled', async () => {
      const candidates = [
        createMockSearchResult('chunk1', 'test content 1', 0.5),
        createMockSearchResult('chunk2', 'test content 2', 0.6),
        createMockSearchResult('chunk3', 'test content 3', 0.7),
      ];

      const config: Partial<RerankingConfig> = {
        enabled: true,
        topKCandidates: 10,
        topKResults: 2,
      };

      const result = await rerank('test query', candidates, config);

      expect(result.length).toBe(2);
      expect(generateEmbedding).toHaveBeenCalled();
    });

    it('should use cache when available', async () => {
      const candidates = [
        createMockSearchResult('chunk1', 'test content 1', 0.5),
        createMockSearchResult('chunk2', 'test content 2', 0.6),
      ];

      const config: Partial<RerankingConfig> = {
        enabled: true,
        topKCandidates: 10,
        topKResults: 2,
        enableCache: true,
      };

      // First call - should generate embeddings
      await rerank('test query', candidates, config);
      expect(generateEmbedding).toHaveBeenCalledTimes(4); // query + 2 chunks

      // Clear mock call count
      jest.clearAllMocks();

      // Second call with same query - should use cache
      await rerank('test query', candidates, config);
      expect(generateEmbedding).not.toHaveBeenCalled();
    });

    it('should apply MMR when enabled', async () => {
      const candidates = [
        createMockSearchResult('chunk1', 'similar content', 0.9, mockEmbedding),
        createMockSearchResult('chunk2', 'similar content', 0.85, mockEmbedding), // Very similar to chunk1
        createMockSearchResult('chunk3', 'different content', 0.8, mockEmbedding.map((v) => v * 0.5)), // Different
      ];

      const config: Partial<RerankingConfig> = {
        enabled: true,
        topKCandidates: 10,
        topKResults: 2,
        useMMR: true,
        mmrLambda: 0.5,
      };

      const result = await rerank('test query', candidates, config);

      expect(result.length).toBe(2);
      // MMR should prefer diversity, so chunk3 (different content) might be selected
      expect(generateEmbedding).toHaveBeenCalled();
    });

    it('should handle errors gracefully and return fallback results', async () => {
      const candidates = [
        createMockSearchResult('chunk1', 'test content 1', 0.9),
        createMockSearchResult('chunk2', 'test content 2', 0.8),
      ];

      (generateEmbedding as jest.Mock).mockRejectedValue(new Error('Embedding error'));

      const config: Partial<RerankingConfig> = {
        enabled: true,
        topKCandidates: 10,
        topKResults: 2,
      };

      const result = await rerank('test query', candidates, config);

      // Should return top-k results as fallback
      expect(result.length).toBe(2);
      expect(result[0].chunk.id).toBe('chunk1');
      expect(result[1].chunk.id).toBe('chunk2');
    });

    it('should limit candidates to topKCandidates for re-ranking', async () => {
      const candidates = Array.from({ length: 50 }, (_, i) =>
        createMockSearchResult(`chunk${i}`, `test content ${i}`, 0.9 - i * 0.01)
      );

      const config: Partial<RerankingConfig> = {
        enabled: true,
        topKCandidates: 20,
        topKResults: 5,
      };

      const result = await rerank('test query', candidates, config);

      expect(result.length).toBe(5);
      // Should only generate embeddings for top 20 candidates + query
      expect(generateEmbedding).toHaveBeenCalledTimes(21); // query + 20 candidates
    });
  });

  describe('clearRerankingCache', () => {
    it('should clear the re-ranking cache', async () => {
      const candidates = [
        createMockSearchResult('chunk1', 'test content 1', 0.5),
      ];

      const config: Partial<RerankingConfig> = {
        enabled: true,
        topKCandidates: 10,
        topKResults: 1,
        enableCache: true,
      };

      // First call - populate cache
      await rerank('test query', candidates, config);
      expect(generateEmbedding).toHaveBeenCalled();

      // Clear cache
      clearRerankingCache();

      // Clear mock
      jest.clearAllMocks();

      // Second call - should regenerate (cache was cleared)
      await rerank('test query', candidates, config);
      expect(generateEmbedding).toHaveBeenCalled();
    });
  });
});

