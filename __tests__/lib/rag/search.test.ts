/**
 * Unit tests for RAG search (keyword, vector, and hybrid search)
 */

import { search } from '@/lib/rag/search';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import { generateEmbedding } from '@/lib/ingestion/embeddings';
import type { SearchRequest } from '@/types/domain';

// Mock dependencies
jest.mock('@/lib/supabase/client');
jest.mock('@/lib/ingestion/embeddings');
jest.mock('@/lib/rag/reranking', () => ({
  rerank: jest.fn((query, candidates, config) => {
    // Default behavior: return top-k candidates (re-ranking disabled by default)
    const topK = config?.topKResults || 8;
    return Promise.resolve(candidates.slice(0, topK));
  }),
}));

describe('rag/search', () => {
  const mockSupabaseClient = {
    from: jest.fn(),
    rpc: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    (generateEmbedding as jest.Mock).mockResolvedValue(Array.from({ length: 1536 }, () => Math.random()));
  });

  describe('search', () => {
    const baseRequest: SearchRequest = {
      tenantId: 'test-tenant',
      query: 'test query',
      k: 8,
    };

    it('should return empty results for empty query', async () => {
      const request: SearchRequest = {
        ...baseRequest,
        query: '',
      };

      const result = await search(request);

      expect(result.chunks).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('should return empty results for whitespace-only query', async () => {
      const request: SearchRequest = {
        ...baseRequest,
        query: '   ',
      };

      const result = await search(request);

      expect(result.chunks).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    describe('keyword search', () => {
      it('should perform keyword search', async () => {
        const mockChunks = [
          {
            id: 'chunk1',
            tenant_id: 'test-tenant',
            document_id: 'doc1',
            chunk_text: 'test query content',
            chunk_metadata: {},
            content_type: 'policies',
            embedding: null,
            created_at: new Date().toISOString(),
          },
        ];

        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: mockChunks, error: null }),
        };
        // Ensure ilike returns the builder so limit can be chained
        mockQueryBuilder.ilike.mockReturnValue(mockQueryBuilder);

        mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);

        const result = await search(baseRequest);

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('chunks');
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'test-tenant');
        expect(result.queryTime).toBeDefined();
      });

      it('should handle keyword search with no results', async () => {
        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
        mockQueryBuilder.ilike.mockReturnValue(mockQueryBuilder);

        mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);

        const result = await search(baseRequest);

        expect(result.chunks).toEqual([]);
      });

      it('should apply content type filters in keyword search', async () => {
        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
        // Ensure method chaining works
        mockQueryBuilder.in.mockReturnValue(mockQueryBuilder);
        mockQueryBuilder.ilike.mockReturnValue(mockQueryBuilder);

        mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);

        const request: SearchRequest = {
          ...baseRequest,
          filters: { contentType: 'policies' },
        };

        await search(request);

        expect(mockQueryBuilder.in).toHaveBeenCalledWith('content_type', ['policies']);
      });
    });

    describe('vector search', () => {
      it('should perform vector search', async () => {
        const mockVectorResults = [
          {
            id: 'chunk1',
            tenant_id: 'test-tenant',
            document_id: 'doc1',
            chunk_text: 'test content',
            chunk_metadata: {},
            content_type: 'policies',
            embedding: Array.from({ length: 1536 }, () => Math.random()),
            created_at: new Date().toISOString(),
            similarity: 0.85,
          },
        ];

        mockSupabaseClient.rpc.mockResolvedValue({
          data: mockVectorResults,
          error: null,
        });

        const result = await search(baseRequest);

        expect(generateEmbedding).toHaveBeenCalledWith('test query');
        expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
          'match_chunks',
          expect.objectContaining({
            query_embedding: expect.any(Array),
            tenant_id_filter: 'test-tenant',
          })
        );
        expect(result.queryTime).toBeDefined();
      });

      it('should handle vector search with no results', async () => {
        mockSupabaseClient.rpc.mockResolvedValue({
          data: [],
          error: null,
        });

        const result = await search(baseRequest);

        expect(result.chunks).toEqual([]);
      });

      it('should apply content type filters in vector search', async () => {
        mockSupabaseClient.rpc.mockResolvedValue({
          data: [],
          error: null,
        });

        const request: SearchRequest = {
          ...baseRequest,
          filters: { contentType: ['policies', 'learning_content'] },
        };

        await search(request);

        expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
          'match_chunks',
          expect.objectContaining({
            content_types: ['policies', 'learning_content'],
          })
        );
      });
    });

    describe('hybrid search', () => {
      it('should combine keyword and vector search results', async () => {
        const mockKeywordChunks = [
          {
            id: 'chunk1',
            tenant_id: 'test-tenant',
            document_id: 'doc1',
            chunk_text: 'test query keyword match',
            chunk_metadata: {},
            content_type: 'policies',
            embedding: null,
            created_at: new Date().toISOString(),
          },
        ];

        const mockVectorResults = [
          {
            id: 'chunk2',
            tenant_id: 'test-tenant',
            document_id: 'doc2',
            chunk_text: 'semantic content',
            chunk_metadata: {},
            content_type: 'policies',
            embedding: Array.from({ length: 1536 }, () => Math.random()),
            created_at: new Date().toISOString(),
            similarity: 0.9,
          },
        ];

        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: mockKeywordChunks, error: null }),
        };

        mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
        mockSupabaseClient.rpc.mockResolvedValue({
          data: mockVectorResults,
          error: null,
        });

        const result = await search(baseRequest);

        expect(result.chunks.length).toBeGreaterThan(0);
        expect(result.chunks.some((c) => c.matchType === 'keyword')).toBe(true);
        expect(result.chunks.some((c) => c.matchType === 'vector')).toBe(true);
      });

      it('should deduplicate results from both searches', async () => {
        const mockChunk = {
          id: 'chunk1',
          tenant_id: 'test-tenant',
          document_id: 'doc1',
          chunk_text: 'test content',
          chunk_metadata: {},
          content_type: 'policies',
          embedding: Array.from({ length: 1536 }, () => Math.random()),
          created_at: new Date().toISOString(),
        };

        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [mockChunk], error: null }),
        };

        mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
        mockSupabaseClient.rpc.mockResolvedValue({
          data: [{ ...mockChunk, similarity: 0.8 }],
          error: null,
        });

        const result = await search(baseRequest);

        // Should have hybrid match type for chunks found in both searches
        const hybridChunks = result.chunks.filter((c) => c.matchType === 'hybrid');
        expect(hybridChunks.length).toBeGreaterThan(0);
      });

      it('should return top-k results', async () => {
        const mockChunks = Array.from({ length: 20 }, (_, i) => ({
          id: `chunk${i}`,
          tenant_id: 'test-tenant',
          document_id: `doc${i}`,
          chunk_text: `content ${i}`,
          chunk_metadata: {},
          content_type: 'policies',
          embedding: null,
          created_at: new Date().toISOString(),
        }));

        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: mockChunks, error: null }),
        };

        mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
        mockSupabaseClient.rpc.mockResolvedValue({
          data: [],
          error: null,
        });

        const request: SearchRequest = {
          ...baseRequest,
          k: 5,
        };

        const result = await search(request);

        expect(result.chunks.length).toBeLessThanOrEqual(5);
      });
    });

    describe('error handling', () => {
      it('should handle keyword search errors', async () => {
        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
        };

        mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);

        await expect(search(baseRequest)).rejects.toThrow('Search failed');
      });

      it('should handle vector search errors', async () => {
        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        };

        mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
        mockSupabaseClient.rpc.mockResolvedValue({
          data: null,
          error: { message: 'RPC error' },
        });

        await expect(search(baseRequest)).rejects.toThrow('Search failed');
      });

      it('should handle embedding generation errors', async () => {
        (generateEmbedding as jest.Mock).mockRejectedValue(new Error('Embedding error'));

        await expect(search(baseRequest)).rejects.toThrow('Search failed');
      });
    });

    describe('document ID filtering', () => {
      it('should filter results by document IDs', async () => {
        const mockChunks = [
          {
            id: 'chunk1',
            tenant_id: 'test-tenant',
            document_id: 'doc1',
            chunk_text: 'content',
            chunk_metadata: {},
            content_type: 'policies',
            embedding: null,
            created_at: new Date().toISOString(),
          },
          {
            id: 'chunk2',
            tenant_id: 'test-tenant',
            document_id: 'doc2',
            chunk_text: 'content',
            chunk_metadata: {},
            content_type: 'policies',
            embedding: null,
            created_at: new Date().toISOString(),
          },
        ];

        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: mockChunks, error: null }),
        };

        mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
        mockSupabaseClient.rpc.mockResolvedValue({
          data: [],
          error: null,
        });

        const request: SearchRequest = {
          ...baseRequest,
          filters: { documentIds: ['doc1'] },
        };

        const result = await search(request);

        expect(result.chunks.every((c) => c.chunk.documentId === 'doc1')).toBe(true);
      });
    });
  });
});

