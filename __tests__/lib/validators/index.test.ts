/**
 * Unit tests for validators
 */

import {
  isContentType,
  isUserContext,
  isChunkMetadata,
  isDocument,
  isDocumentChunk,
  isSearchRequest,
  isChatRequest,
  validateSearchRequest,
  validateChatRequest,
  isValidUUID,
  isValidEmbedding,
} from '@/lib/validators/index';
import type { UserContext } from '@/types/domain';

describe('validators', () => {
  describe('isContentType', () => {
    it('should return true for valid content types', () => {
      expect(isContentType('policies')).toBe(true);
      expect(isContentType('learning_content')).toBe(true);
      expect(isContentType('internal_roles')).toBe(true);
      expect(isContentType('all')).toBe(true);
    });

    it('should return false for invalid content types', () => {
      expect(isContentType('invalid')).toBe(false);
      expect(isContentType(123)).toBe(false);
      expect(isContentType(null)).toBe(false);
    });
  });

  describe('isUserContext', () => {
    it('should return true for valid user context', () => {
      const validContext: UserContext = {
        role: 'engineer',
        level: 'senior',
        targetJob: 'lead engineer',
        learningPreferences: ['hands-on'],
      };

      expect(isUserContext(validContext)).toBe(true);
    });

    it('should return true for partial user context', () => {
      expect(isUserContext({ role: 'engineer' })).toBe(true);
      expect(isUserContext({ level: 'senior' })).toBe(true);
    });

    it('should return false for invalid role type', () => {
      expect(isUserContext({ role: 123 })).toBe(false);
    });

    it('should return false for invalid level', () => {
      expect(isUserContext({ level: 'invalid-level' })).toBe(false);
    });

    it('should return false for invalid learning preferences', () => {
      expect(isUserContext({ learningPreferences: 'not-array' })).toBe(false);
      expect(isUserContext({ learningPreferences: [123] })).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isUserContext(null)).toBe(false);
      expect(isUserContext('string')).toBe(false);
      expect(isUserContext(123)).toBe(false);
    });
  });

  describe('isChunkMetadata', () => {
    it('should return true for valid chunk metadata', () => {
      const validMetadata = {
        pageNumber: 1,
        rowIndex: 2,
        columnNames: ['col1', 'col2'],
        fileName: 'test.pdf',
        sourceLocation: '/path/to/file',
      };

      expect(isChunkMetadata(validMetadata)).toBe(true);
    });

    it('should return true for partial metadata', () => {
      expect(isChunkMetadata({ pageNumber: 1 })).toBe(true);
      expect(isChunkMetadata({ fileName: 'test.pdf' })).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(isChunkMetadata({ pageNumber: '1' })).toBe(false);
      expect(isChunkMetadata({ rowIndex: '2' })).toBe(false);
      expect(isChunkMetadata({ columnNames: 'not-array' })).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isChunkMetadata(null)).toBe(false);
      expect(isChunkMetadata('string')).toBe(false);
    });
  });

  describe('isDocument', () => {
    it('should return true for valid document', () => {
      const validDoc = {
        id: 'doc1',
        tenantId: 'tenant1',
        sourcePath: '/path/to/file',
        name: 'test.pdf',
        contentType: 'policies',
        uploadedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isDocument(validDoc)).toBe(true);
    });

    it('should return false for missing required fields', () => {
      expect(isDocument({ id: 'doc1' })).toBe(false);
    });

    it('should return false for invalid date types', () => {
      expect(
        isDocument({
          id: 'doc1',
          tenantId: 'tenant1',
          sourcePath: '/path',
          name: 'test.pdf',
          contentType: 'policies',
          uploadedAt: 'not-a-date',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ).toBe(false);
    });
  });

  describe('isDocumentChunk', () => {
    it('should return true for valid document chunk', () => {
      const validChunk = {
        id: 'chunk1',
        tenantId: 'tenant1',
        documentId: 'doc1',
        chunkText: 'text content',
        chunkMetadata: { pageNumber: 1 },
        contentType: 'policies',
        embedding: [0.1, 0.2, 0.3],
        createdAt: new Date(),
      };

      expect(isDocumentChunk(validChunk)).toBe(true);
    });

    it('should return true for chunk with null embedding', () => {
      const chunk = {
        id: 'chunk1',
        tenantId: 'tenant1',
        documentId: 'doc1',
        chunkText: 'text',
        chunkMetadata: {},
        contentType: 'policies',
        embedding: null,
        createdAt: new Date(),
      };

      expect(isDocumentChunk(chunk)).toBe(true);
    });

    it('should return false for invalid embedding array', () => {
      const chunk = {
        id: 'chunk1',
        tenantId: 'tenant1',
        documentId: 'doc1',
        chunkText: 'text',
        chunkMetadata: {},
        contentType: 'policies',
        embedding: ['not', 'numbers'],
        createdAt: new Date(),
      };

      expect(isDocumentChunk(chunk)).toBe(false);
    });
  });

  describe('isSearchRequest', () => {
    it('should return true for valid search request', () => {
      const validRequest = {
        tenantId: 'tenant1',
        query: 'test query',
        k: 10,
        userContext: { role: 'engineer' },
        filters: { contentType: 'policies' },
      };

      expect(isSearchRequest(validRequest)).toBe(true);
    });

    it('should return false for missing tenantId', () => {
      expect(isSearchRequest({ query: 'test' })).toBe(false);
    });

    it('should return false for empty tenantId', () => {
      expect(isSearchRequest({ tenantId: '', query: 'test' })).toBe(false);
    });

    it('should return false for missing query', () => {
      expect(isSearchRequest({ tenantId: 'tenant1' })).toBe(false);
    });

    it('should return false for invalid k value', () => {
      expect(isSearchRequest({ tenantId: 'tenant1', query: 'test', k: 0 })).toBe(false);
      expect(isSearchRequest({ tenantId: 'tenant1', query: 'test', k: -1 })).toBe(false);
    });
  });

  describe('isChatRequest', () => {
    it('should return true for valid chat request', () => {
      const validRequest = {
        question: 'What is the policy?',
        userContext: { role: 'engineer' },
        metadata: { sessionId: 'session1' },
        sessionId: 'session1',
      };

      expect(isChatRequest(validRequest)).toBe(true);
    });

    it('should return false for missing question', () => {
      expect(isChatRequest({})).toBe(false);
    });

    it('should return false for empty question', () => {
      expect(isChatRequest({ question: '' })).toBe(false);
    });

    it('should return false for invalid metadata type', () => {
      expect(isChatRequest({ question: 'test', metadata: 'not-object' })).toBe(false);
    });
  });

  describe('validateSearchRequest', () => {
    it('should return normalized request for valid input', () => {
      const input = {
        tenantId: 'tenant1',
        query: '  test query  ',
        k: 10,
      };

      const result = validateSearchRequest(input);

      expect(result.query).toBe('test query');
      expect(result.tenantId).toBe('tenant1');
      expect(result.k).toBe(10);
    });

    it('should use default k value when not provided', () => {
      const input = {
        tenantId: 'tenant1',
        query: 'test',
      };

      const result = validateSearchRequest(input);

      expect(result.k).toBe(8);
    });

    it('should throw error for invalid input', () => {
      expect(() => validateSearchRequest({})).toThrow('Invalid SearchRequest');
    });
  });

  describe('validateChatRequest', () => {
    it('should return normalized request for valid input', () => {
      const input = {
        question: '  test question  ',
        userContext: { role: 'engineer' },
      };

      const result = validateChatRequest(input);

      expect(result.question).toBe('test question');
      expect(result.userContext).toEqual({ role: 'engineer' });
    });

    it('should throw error for invalid input', () => {
      expect(() => validateChatRequest({})).toThrow('Invalid ChatRequest');
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });
  });

  describe('isValidEmbedding', () => {
    it('should return true for valid embedding', () => {
      const embedding = Array.from({ length: 1536 }, () => Math.random());
      expect(isValidEmbedding(embedding)).toBe(true);
    });

    it('should return false for wrong dimension', () => {
      const embedding = Array.from({ length: 100 }, () => Math.random());
      expect(isValidEmbedding(embedding)).toBe(false);
    });

    it('should return false for non-array', () => {
      expect(isValidEmbedding('not-array')).toBe(false);
      expect(isValidEmbedding(null)).toBe(false);
      expect(isValidEmbedding({})).toBe(false);
    });

    it('should return false for array with non-numbers', () => {
      const embedding = Array.from({ length: 1536 }, () => 'not-number');
      expect(isValidEmbedding(embedding)).toBe(false);
    });

    it('should return false for array with NaN', () => {
      const embedding = Array.from({ length: 1536 }, () => NaN);
      expect(isValidEmbedding(embedding)).toBe(false);
    });

    it('should accept custom dimension', () => {
      const embedding = Array.from({ length: 512 }, () => Math.random());
      expect(isValidEmbedding(embedding, 512)).toBe(true);
    });
  });
});

