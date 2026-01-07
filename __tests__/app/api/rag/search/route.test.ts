/**
 * Unit tests for RAG search API route
 */

import { POST, GET } from '@/app/api/rag/search/route';
import { search } from '@/lib/rag/search';
import { NextRequest } from 'next/server';

// Mock the search function
jest.mock('@/lib/rag/search');

describe('RAG Search API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should return search results for valid request', async () => {
      const mockSearchResponse = {
        chunks: [
          {
            chunk: {
              id: 'chunk1',
              tenantId: 'test-tenant',
              documentId: 'doc1',
              chunkText: 'test content',
              chunkMetadata: {},
              contentType: 'policies',
              embedding: null,
              createdAt: new Date(),
            },
            score: 0.8,
            matchType: 'hybrid' as const,
          },
        ],
        totalCount: 1,
        queryTime: 100,
      };

      (search as jest.Mock).mockResolvedValue(mockSearchResponse);

      const request = new NextRequest('http://localhost/api/rag/search', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: 'test-tenant',
          query: 'test query',
          k: 8,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockSearchResponse);
      expect(search).toHaveBeenCalledWith({
        tenantId: 'test-tenant',
        query: 'test query',
        k: 8,
        filters: undefined,
      });
    });

    it('should return 400 for missing tenant_id', async () => {
      const request = new NextRequest('http://localhost/api/rag/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'test query',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('ValidationError');
      expect(data.message).toContain('tenant_id');
    });

    it('should return 400 for invalid tenant_id type', async () => {
      const request = new NextRequest('http://localhost/api/rag/search', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: 123,
          query: 'test query',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('ValidationError');
    });

    it('should return 400 for missing query', async () => {
      const request = new NextRequest('http://localhost/api/rag/search', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: 'test-tenant',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('ValidationError');
      expect(data.message).toContain('query');
    });

    it('should return 400 for empty query', async () => {
      const request = new NextRequest('http://localhost/api/rag/search', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: 'test-tenant',
          query: '',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('ValidationError');
    });

    it('should return 400 for whitespace-only query', async () => {
      const request = new NextRequest('http://localhost/api/rag/search', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: 'test-tenant',
          query: '   ',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('ValidationError');
    });

    it('should trim query before searching', async () => {
      const mockSearchResponse = {
        chunks: [],
        totalCount: 0,
        queryTime: 50,
      };

      (search as jest.Mock).mockResolvedValue(mockSearchResponse);

      const request = new NextRequest('http://localhost/api/rag/search', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: 'test-tenant',
          query: '  test query  ',
        }),
      });

      await POST(request);

      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test query',
        })
      );
    });

    it('should use default k value when not provided', async () => {
      const mockSearchResponse = {
        chunks: [],
        totalCount: 0,
        queryTime: 50,
      };

      (search as jest.Mock).mockResolvedValue(mockSearchResponse);

      const request = new NextRequest('http://localhost/api/rag/search', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: 'test-tenant',
          query: 'test query',
        }),
      });

      await POST(request);

      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          k: 8,
        })
      );
    });

    it('should pass filters to search function', async () => {
      const mockSearchResponse = {
        chunks: [],
        totalCount: 0,
        queryTime: 50,
      };

      (search as jest.Mock).mockResolvedValue(mockSearchResponse);

      const request = new NextRequest('http://localhost/api/rag/search', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: 'test-tenant',
          query: 'test query',
          filters: {
            contentType: 'policies',
          },
        }),
      });

      await POST(request);

      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: {
            contentType: 'policies',
          },
        })
      );
    });

    it('should handle search errors', async () => {
      (search as jest.Mock).mockRejectedValue(new Error('Search failed'));

      const request = new NextRequest('http://localhost/api/rag/search', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: 'test-tenant',
          query: 'test query',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('SearchError');
      expect(data.message).toContain('Search failed');
    });

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/rag/search', {
        method: 'POST',
        body: 'invalid json',
      });

      await expect(POST(request)).rejects.toThrow();
    });
  });

  describe('GET', () => {
    it('should return health check information', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.service).toBe('RAG Search API');
      expect(data.status).toBe('operational');
      expect(data.endpoints).toBeDefined();
    });
  });
});



