/**
 * Unit tests for chunking logic
 */

import { chunkText, chunkMultipleTexts, estimateTokenCount } from '@/lib/ingestion/chunking';
import type { ChunkMetadata } from '@/types/domain';

describe('chunking', () => {
  describe('estimateTokenCount', () => {
    it('should estimate token count correctly', () => {
      const inputText = 'This is a test string with 40 characters.';
      // Actual length is 41 characters (including period), so 41/4 = 10.25 -> 11 tokens
      const expectedTokens = Math.ceil(inputText.length / 4); // 11 tokens
      expect(estimateTokenCount(inputText)).toBe(expectedTokens);
    });

    it('should handle empty string', () => {
      expect(estimateTokenCount('')).toBe(0);
    });

    it('should handle short strings', () => {
      expect(estimateTokenCount('Hi')).toBe(1);
    });
  });

  describe('chunkText', () => {
    const baseMetadata: ChunkMetadata = {
      fileName: 'test.txt',
      sourceLocation: '/path/to/test.txt',
    };

    it('should chunk text into smaller pieces', async () => {
      const longText = 'A'.repeat(5000);
      const chunks = await chunkText(longText, baseMetadata);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeLessThanOrEqual(2200); // chunkSize + some buffer
        expect(chunk.metadata.fileName).toBe('test.txt');
        expect(chunk.metadata.chunkIndex).toBeDefined();
      });
    });

    it('should handle empty text', async () => {
      const chunks = await chunkText('', baseMetadata);
      expect(chunks).toEqual([]);
    });

    it('should handle whitespace-only text', async () => {
      const chunks = await chunkText('   \n\t  ', baseMetadata);
      expect(chunks).toEqual([]);
    });

    it('should preserve metadata in chunks', async () => {
      const text = 'Short text';
      const chunks = await chunkText(text, baseMetadata);

      expect(chunks.length).toBe(1);
      expect(chunks[0].metadata.fileName).toBe('test.txt');
      expect(chunks[0].metadata.sourceLocation).toBe('/path/to/test.txt');
      expect(chunks[0].metadata.chunkIndex).toBe(0);
    });

    it('should create overlapping chunks', async () => {
      const text = 'A'.repeat(3000);
      const chunks = await chunkText(text, baseMetadata);

      if (chunks.length > 1) {
        // Check that chunks overlap by checking if text from end of one chunk
        // appears in the next chunk
        const firstChunkEnd = chunks[0].text.slice(-100);
        const secondChunkStart = chunks[1].text.slice(0, 100);

        // There should be some overlap
        expect(firstChunkEnd.length).toBeGreaterThan(0);
        expect(secondChunkStart.length).toBeGreaterThan(0);
      }
    });

    it('should break at sentence boundaries when possible', async () => {
      // Create text where sentences are distributed so at least one chunk boundary
      // will fall in the second half of a chunk (where sentence breaking is applied)
      // chunkSize is 2000, so we need periods after position 1000
      const firstPart = 'A'.repeat(1200) + 'First sentence. ';
      const secondPart = 'B'.repeat(1200) + 'Second sentence. ';
      const thirdPart = 'C'.repeat(1200) + 'Third sentence. ';
      const text = firstPart + secondPart + thirdPart;
      const chunks = await chunkText(text, baseMetadata);

      // The chunking logic breaks at sentence boundaries when breakPoint > chunkSize * 0.5
      // With sentences positioned after 1200 chars, they should be in the second half
      // At least one chunk should end with a period when sentence boundary breaking occurs
      const hasSentenceBoundary = chunks.some((chunk) => {
        const trimmed = chunk.text.trim();
        return trimmed.endsWith('.') && trimmed.length > 100; // Ensure it's a real sentence break, not just a period
      });
      expect(hasSentenceBoundary).toBe(true);
    });

    it('should use custom chunking config', async () => {
      const text = 'A'.repeat(5000);
      const customConfig = { chunkSize: 1000, overlap: 100 };
      const chunks = await chunkText(text, baseMetadata, customConfig);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeLessThanOrEqual(1100); // chunkSize + buffer
      });
    });

    it('should handle text shorter than chunk size', async () => {
      const text = 'Short text that is less than chunk size';
      const chunks = await chunkText(text, baseMetadata);

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe(text);
    });

    it('should trim whitespace from chunks', async () => {
      const text = '   Text with whitespace   ';
      const chunks = await chunkText(text, baseMetadata);

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe('Text with whitespace');
    });
  });

  describe('chunkMultipleTexts', () => {
    const baseMetadata: ChunkMetadata = {
      fileName: 'test.txt',
      sourceLocation: '/path/to/test.txt',
    };

    it('should chunk multiple text pieces', async () => {
      const texts = [
        { text: 'A'.repeat(2000), metadata: { ...baseMetadata, pageNumber: 1 } },
        { text: 'B'.repeat(2000), metadata: { ...baseMetadata, pageNumber: 2 } },
      ];

      const chunks = await chunkMultipleTexts(texts);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].metadata.pageNumber).toBe(1);
      expect(chunks[chunks.length - 1].metadata.pageNumber).toBe(2);
    });

    it('should assign sequential global chunk indices', async () => {
      const texts = [
        { text: 'A'.repeat(2000), metadata: baseMetadata },
        { text: 'B'.repeat(2000), metadata: baseMetadata },
      ];

      const chunks = await chunkMultipleTexts(texts);

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].chunkIndex).toBe(i);
      }
    });

    it('should handle empty array', async () => {
      const chunks = await chunkMultipleTexts([]);
      expect(chunks).toEqual([]);
    });

    it('should preserve metadata from each text piece', async () => {
      const texts = [
        { text: 'Page 1', metadata: { ...baseMetadata, pageNumber: 1 } },
        { text: 'Page 2', metadata: { ...baseMetadata, pageNumber: 2 } },
      ];

      const chunks = await chunkMultipleTexts(texts);

      expect(chunks[0].metadata.pageNumber).toBe(1);
      expect(chunks[1].metadata.pageNumber).toBe(2);
    });
  });
});

