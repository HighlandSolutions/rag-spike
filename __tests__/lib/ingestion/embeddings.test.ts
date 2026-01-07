/**
 * Unit tests for embedding generation
 */

import { generateEmbedding, generateEmbeddings, clearEmbeddingCache } from '@/lib/ingestion/embeddings';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');

describe('embeddings', () => {
  const mockOpenAIClient = {
    embeddings: {
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearEmbeddingCache();
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAIClient as unknown as OpenAI);
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for single text', async () => {
      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());
      mockOpenAIClient.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const result = await generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledWith({
        model: expect.any(String),
        input: ['test text'],
      });
    });

    it('should use cache when enabled', async () => {
      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());
      mockOpenAIClient.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      // First call
      const result1 = await generateEmbedding('cached text');
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await generateEmbedding('cached text');
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should throw error when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(generateEmbedding('test')).rejects.toThrow('OPENAI_API_KEY');
    });

    it('should handle API errors', async () => {
      mockOpenAIClient.embeddings.create.mockRejectedValue(new Error('API Error'));

      await expect(generateEmbedding('test')).rejects.toThrow();
    });

    it('should retry on failure', async () => {
      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());

      // Fail twice, then succeed
      mockOpenAIClient.embeddings.create
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding }],
        });

      const result = await generateEmbedding('test', {
        maxRetries: 3,
        retryDelay: 10,
      });

      expect(result).toEqual(mockEmbedding);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const mockEmbeddings = [
        Array.from({ length: 1536 }, () => Math.random()),
        Array.from({ length: 1536 }, () => Math.random()),
      ];
      mockOpenAIClient.embeddings.create.mockResolvedValue({
        data: mockEmbeddings.map((emb) => ({ embedding: emb })),
      });

      const result = await generateEmbeddings(['text1', 'text2']);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockEmbeddings[0]);
      expect(result[1]).toEqual(mockEmbeddings[1]);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledWith({
        model: expect.any(String),
        input: ['text1', 'text2'],
      });
    });

    it('should handle empty array', async () => {
      const result = await generateEmbeddings([]);
      expect(result).toEqual([]);
      expect(mockOpenAIClient.embeddings.create).not.toHaveBeenCalled();
    });

    it('should process in batches', async () => {
      const texts = Array.from({ length: 250 }, (_, i) => `text${i}`);
      const mockEmbeddings = texts.map(() => Array.from({ length: 1536 }, () => Math.random()));

      let processedCount = 0;
      mockOpenAIClient.embeddings.create.mockImplementation(async (params: { input: string[] }) => {
        const batchSize = params.input.length;
        const batchEmbeddings = mockEmbeddings.slice(processedCount, processedCount + batchSize);
        processedCount += batchSize;
        return {
          data: batchEmbeddings.map((emb) => ({ embedding: emb })),
        };
      });

      // Ensure API key is set
      process.env.OPENAI_API_KEY = 'test-api-key';

      const result = await generateEmbeddings(texts, { batchSize: 100 });

      expect(result).toHaveLength(250);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(3); // 250 / 100 = 3 batches
    });

    it('should handle batch failures with retries', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());

      mockOpenAIClient.embeddings.create
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockResolvedValueOnce({
          data: texts.map(() => ({ embedding: mockEmbedding })),
        });

      const result = await generateEmbeddings(texts, {
        maxRetries: 3,
        retryDelay: 10,
      });

      expect(result).toHaveLength(3);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      mockOpenAIClient.embeddings.create.mockRejectedValue(new Error('API Error'));

      await expect(
        generateEmbeddings(['text1'], {
          maxRetries: 2,
          retryDelay: 10,
        })
      ).rejects.toThrow('Failed to generate embeddings');
    });
  });

  describe('clearEmbeddingCache', () => {
    it('should clear the embedding cache', async () => {
      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());
      mockOpenAIClient.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      // Generate embedding (should be cached)
      await generateEmbedding('test text');
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(1);

      // Clear cache
      clearEmbeddingCache();

      // Generate same text again (should call API again)
      await generateEmbedding('test text');
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(2);
    });
  });
});

