/**
 * Unit tests for agent/orchestrator API route
 */

import { POST, GET } from '@/app/api/agent/chat/route';
import { search } from '@/lib/rag/search';
import { determineContentFilters } from '@/lib/agent/content-filters';
import { determineToolsToExecute, executeTools } from '@/lib/agent/tools';
import { composePrompt, extractChunkIds } from '@/lib/agent/prompt-builder';
import { streamLLMResponse } from '@/lib/agent/llm-client';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/rag/search');
jest.mock('@/lib/agent/content-filters');
jest.mock('@/lib/agent/tools');
jest.mock('@/lib/agent/prompt-builder');
jest.mock('@/lib/agent/llm-client');

describe('Agent Chat API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DEFAULT_TENANT_ID = 'default-tenant';
  });

  afterEach(() => {
    delete process.env.DEFAULT_TENANT_ID;
  });

  describe('POST', () => {
    it('should return streaming response for valid request', async () => {
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

      (determineContentFilters as jest.Mock).mockReturnValue(['policies']);
      (search as jest.Mock).mockResolvedValue(mockSearchResponse);
      (determineToolsToExecute as jest.Mock).mockReturnValue([]);
      (executeTools as jest.Mock).mockResolvedValue([]);
      (composePrompt as jest.Mock).mockReturnValue('Test prompt');
      (extractChunkIds as jest.Mock).mockReturnValue(['chunk1']);

      // Mock streaming response
      const mockStream = [
        { text: 'Hello', isComplete: false },
        { text: ' world', isComplete: false },
        { text: '', isComplete: true },
      ];

      (streamLLMResponse as jest.Mock).mockImplementation(async function* () {
        for (const chunk of mockStream) {
          yield chunk;
        }
      });

      const request = new NextRequest('http://localhost/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          question: 'What is the policy?',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(determineContentFilters).toHaveBeenCalled();
      expect(search).toHaveBeenCalled();
    });

    it('should return 400 for missing question', async () => {
      const request = new NextRequest('http://localhost/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('ValidationError');
      expect(data.message).toContain('question');
    });

    it('should return 400 for empty question', async () => {
      const request = new NextRequest('http://localhost/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          question: '',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('ValidationError');
    });

    it('should return 404 when no relevant chunks found', async () => {
      (determineContentFilters as jest.Mock).mockReturnValue(['policies']);
      (search as jest.Mock).mockResolvedValue({
        chunks: [],
        totalCount: 0,
        queryTime: 50,
      });

      const request = new NextRequest('http://localhost/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          question: 'test question',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('NoRelevantChunks');
    });

    it('should include user context in search request', async () => {
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

      (determineContentFilters as jest.Mock).mockReturnValue(['policies']);
      (search as jest.Mock).mockResolvedValue(mockSearchResponse);
      (determineToolsToExecute as jest.Mock).mockReturnValue([]);
      (executeTools as jest.Mock).mockResolvedValue([]);
      (composePrompt as jest.Mock).mockReturnValue('Test prompt');
      (extractChunkIds as jest.Mock).mockReturnValue(['chunk1']);

      const mockStream = [{ text: '', isComplete: true }];
      (streamLLMResponse as jest.Mock).mockImplementation(async function* () {
        for (const chunk of mockStream) {
          yield chunk;
        }
      });

      const request = new NextRequest('http://localhost/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          question: 'test question',
          user_context: {
            role: 'engineer',
            level: 'senior',
          },
        }),
      });

      await POST(request);

      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          userContext: {
            role: 'engineer',
            level: 'senior',
          },
        })
      );
    });

    it('should execute tools when determined', async () => {
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

      const mockTool = { name: 'test-tool' };
      const mockToolResults = [
        {
          toolName: 'test-tool',
          output: {},
          success: true,
        },
      ];

      (determineContentFilters as jest.Mock).mockReturnValue(['policies']);
      (search as jest.Mock).mockResolvedValue(mockSearchResponse);
      (determineToolsToExecute as jest.Mock).mockReturnValue([mockTool] as any);
      (executeTools as jest.Mock).mockResolvedValue(mockToolResults);
      (composePrompt as jest.Mock).mockReturnValue('Test prompt');
      (extractChunkIds as jest.Mock).mockReturnValue(['chunk1']);

      const mockStream = [{ text: '', isComplete: true }];
      (streamLLMResponse as jest.Mock).mockImplementation(async function* () {
        for (const chunk of mockStream) {
          yield chunk;
        }
      });

      const request = new NextRequest('http://localhost/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          question: 'Am I eligible?',
        }),
      });

      await POST(request);

      expect(determineToolsToExecute).toHaveBeenCalled();
      expect(executeTools).toHaveBeenCalled();
    });

    it('should handle streaming errors', async () => {
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

      (determineContentFilters as jest.Mock).mockReturnValue(['policies']);
      (search as jest.Mock).mockResolvedValue(mockSearchResponse);
      (determineToolsToExecute as jest.Mock).mockReturnValue([]);
      (executeTools as jest.Mock).mockResolvedValue([]);
      (composePrompt as jest.Mock).mockReturnValue('Test prompt');
      (extractChunkIds as jest.Mock).mockReturnValue(['chunk1']);

      (streamLLMResponse as jest.Mock).mockImplementation(async function* () {
        yield { error: 'LLM API error', isComplete: true };
      });

      const request = new NextRequest('http://localhost/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          question: 'test question',
        }),
      });

      const response = await POST(request);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        const { value } = await reader.read();
        const text = decoder.decode(value);
        const data = JSON.parse(text.replace('data: ', ''));

        expect(data.error).toBe('LLM API error');
        expect(data.isComplete).toBe(true);
      }
    });

    it('should handle general errors', async () => {
      (determineContentFilters as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const request = new NextRequest('http://localhost/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          question: 'test question',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('ChatError');
    });
  });

  describe('GET', () => {
    it('should return health check information', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.service).toBe('Agent/Orchestrator API');
      expect(data.status).toBe('operational');
    });
  });
});

