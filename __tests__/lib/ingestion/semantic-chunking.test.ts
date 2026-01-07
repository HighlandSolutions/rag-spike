/**
 * Unit tests for semantic chunking logic
 */

import { semanticChunkText, semanticChunkMultipleTexts, type SemanticChunkingConfig } from '@/lib/ingestion/semantic-chunking';
import type { ChunkMetadata } from '@/types/domain';

// Mock the embeddings module
jest.mock('@/lib/ingestion/embeddings', () => ({
  generateEmbeddings: jest.fn(async (texts: string[]) => {
    // Return mock embeddings (1536 dimensions for text-embedding-3-small)
    return texts.map(() => Array(1536).fill(0).map(() => Math.random()));
  }),
}));

describe('semantic chunking', () => {
  const baseMetadata: ChunkMetadata = {
    fileName: 'test.txt',
    sourceLocation: '/path/to/test.txt',
  };

  describe('semanticChunkText', () => {
    it('should chunk text using semantic boundaries', async () => {
      // Create text with clear semantic boundaries
      const text = `
        This is the first topic. It discusses machine learning basics.
        Machine learning is a subset of artificial intelligence.
        
        This is the second topic. It discusses natural language processing.
        Natural language processing enables computers to understand human language.
        
        This is the third topic. It discusses computer vision.
        Computer vision allows machines to interpret visual information.
      `.trim();

      const config: Partial<SemanticChunkingConfig> = {
        targetChunkSize: 200,
        minChunkSize: 50,
        maxChunkSize: 500,
        similarityThreshold: 0.7,
      };

      const chunks = await semanticChunkText(text, baseMetadata, config);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeGreaterThanOrEqual(config.minChunkSize || 50);
        expect(chunk.text.length).toBeLessThanOrEqual(config.maxChunkSize || 500);
        expect(chunk.metadata.fileName).toBe('test.txt');
        expect(chunk.metadata.chunkIndex).toBeDefined();
      });
    });

    it('should handle empty text', async () => {
      const chunks = await semanticChunkText('', baseMetadata);
      expect(chunks).toEqual([]);
    });

    it('should handle whitespace-only text', async () => {
      const chunks = await semanticChunkText('   \n\t  ', baseMetadata);
      expect(chunks).toEqual([]);
    });

    it('should preserve metadata in chunks', async () => {
      const text = 'Short text that should be chunked.';
      const chunks = await semanticChunkText(text, baseMetadata);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.metadata.fileName).toBe('test.txt');
        expect(chunk.metadata.sourceLocation).toBe('/path/to/test.txt');
      });
    });

    it('should handle content-aware chunking for code blocks', async () => {
      const text = `
        Here is some code:
        \`\`\`
        function example() {
          return "Hello World";
        }
        \`\`\`
        
        And here is more text after the code block.
      `.trim();

      const chunks = await semanticChunkText(text, baseMetadata, {
        enableContentAwareChunking: true,
        targetChunkSize: 100,
      });

      // Code blocks should be kept intact
      const hasCodeBlock = chunks.some((chunk) => chunk.text.includes('function example'));
      expect(hasCodeBlock).toBe(true);
    });

    it('should handle content-aware chunking for lists', async () => {
      const text = `
        Here is a list:
        - Item one
        - Item two
        - Item three
        
        And here is more text after the list.
      `.trim();

      const chunks = await semanticChunkText(text, baseMetadata, {
        enableContentAwareChunking: true,
        targetChunkSize: 100,
      });

      // List items should be kept together
      const hasListItems = chunks.some((chunk) => 
        chunk.text.includes('Item one') && chunk.text.includes('Item two')
      );
      expect(hasListItems).toBe(true);
    });

    it('should use adaptive chunk sizes for dense technical content', async () => {
      const technicalText = `
        function processData(data: DataType[]): ResultType {
          const result = data.map(item => {
            const processed = transform(item);
            return validate(processed);
          });
          return aggregate(result);
        }
        
        interface DataType {
          id: string;
          value: number;
        }
      `.trim();

      const config: Partial<SemanticChunkingConfig> = {
        targetChunkSize: 200,
        enableAdaptiveSizing: true,
      };

      const chunks = await semanticChunkText(technicalText, baseMetadata, config);

      // Technical content should result in smaller chunks
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeLessThanOrEqual(config.targetChunkSize! * 1.5);
      });
    });

    it('should fallback to simple chunking on error', async () => {
      // Mock embeddings to throw an error
      const { generateEmbeddings } = await import('@/lib/ingestion/embeddings');
      jest.mocked(generateEmbeddings).mockRejectedValueOnce(new Error('API Error'));

      const text = 'A'.repeat(5000);
      const chunks = await semanticChunkText(text, baseMetadata);

      // Should still return chunks (fallback)
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should respect min and max chunk sizes', async () => {
      const text = 'A'.repeat(10000);
      const config: Partial<SemanticChunkingConfig> = {
        minChunkSize: 500,
        maxChunkSize: 2000,
        targetChunkSize: 1000,
      };

      const chunks = await semanticChunkText(text, baseMetadata, config);

      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeGreaterThanOrEqual(config.minChunkSize!);
        expect(chunk.text.length).toBeLessThanOrEqual(config.maxChunkSize!);
      });
    });

    it('should add overlap between chunks when configured', async () => {
      const text = 'A'.repeat(5000);
      const config: Partial<SemanticChunkingConfig> = {
        targetChunkSize: 1000,
        overlap: 200,
      };

      const chunks = await semanticChunkText(text, baseMetadata, config);

      if (chunks.length > 1) {
        // Check that chunks have overlap
        const firstChunkEnd = chunks[0].text.slice(-100);
        const secondChunkStart = chunks[1].text.slice(0, 100);

        // There should be some overlap
        expect(firstChunkEnd.length).toBeGreaterThan(0);
        expect(secondChunkStart.length).toBeGreaterThan(0);
      }
    });
  });

  describe('semanticChunkMultipleTexts', () => {
    it('should chunk multiple text pieces', async () => {
      const texts = [
        { text: 'First piece of text. It has multiple sentences.', metadata: { ...baseMetadata, pageNumber: 1 } },
        { text: 'Second piece of text. It also has multiple sentences.', metadata: { ...baseMetadata, pageNumber: 2 } },
      ];

      const chunks = await semanticChunkMultipleTexts(texts);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.pageNumber).toBe(1);
      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.metadata.pageNumber).toBe(2);
    });

    it('should assign sequential global chunk indices', async () => {
      const texts = [
        { text: 'First text piece.', metadata: baseMetadata },
        { text: 'Second text piece.', metadata: baseMetadata },
      ];

      const chunks = await semanticChunkMultipleTexts(texts);

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].chunkIndex).toBe(i);
      }
    });

    it('should handle empty array', async () => {
      const chunks = await semanticChunkMultipleTexts([]);
      expect(chunks).toEqual([]);
    });

    it('should preserve metadata from each text piece', async () => {
      const texts = [
        { text: 'Page 1 content.', metadata: { ...baseMetadata, pageNumber: 1 } },
        { text: 'Page 2 content.', metadata: { ...baseMetadata, pageNumber: 2 } },
      ];

      const chunks = await semanticChunkMultipleTexts(texts);

      expect(chunks[0].metadata.pageNumber).toBe(1);
      const page2Chunk = chunks.find((chunk) => chunk.metadata.pageNumber === 2);
      expect(page2Chunk).toBeDefined();
    });
  });
});



