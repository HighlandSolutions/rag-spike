/**
 * Unit tests for prompt construction
 */

import { composePrompt, extractChunkIds } from '@/lib/agent/prompt-builder';
import type { UserContext, SearchResult } from '@/types/domain';
import type { ToolResult } from '@/lib/agent/tools';

describe('prompt-builder', () => {
  const createMockChunk = (id: string, text: string, contentType: string = 'policies') => ({
    id,
    tenantId: 'test-tenant',
    documentId: 'doc1',
    chunkText: text,
    chunkMetadata: {
      fileName: 'test.pdf',
      pageNumber: 1,
    },
    contentType,
    embedding: null,
    createdAt: new Date(),
  });

  const createMockSearchResult = (id: string, text: string, score: number = 0.8): SearchResult => ({
    chunk: createMockChunk(id, text),
    score,
    matchType: 'hybrid',
  });

  describe('composePrompt', () => {
    it('should build prompt with user question only', () => {
      const prompt = composePrompt('What is the policy?', []);

      expect(prompt).toContain('What is the policy?');
      expect(prompt).toContain('User Question:');
    });

    it('should include system instructions', () => {
      const prompt = composePrompt('Test question', []);

      expect(prompt).toContain('You are a helpful assistant');
    });

    it('should include user profile when provided', () => {
      const userContext: UserContext = {
        role: 'engineer',
        level: 'senior',
        targetJob: 'lead engineer',
        learningPreferences: ['hands-on'],
      };

      const prompt = composePrompt('Test question', [], userContext);

      expect(prompt).toContain('User Profile:');
      expect(prompt).toContain('Role: engineer');
      expect(prompt).toContain('Level: senior');
      expect(prompt).toContain('Target Job: lead engineer');
      expect(prompt).toContain('Learning Preferences: hands-on');
    });

    it('should include retrieved chunks with identifiers', () => {
      const searchResults: SearchResult[] = [
        createMockSearchResult('chunk1', 'First chunk content'),
        createMockSearchResult('chunk2', 'Second chunk content'),
      ];

      const prompt = composePrompt('Test question', searchResults);

      expect(prompt).toContain('Retrieved Context');
      expect(prompt).toContain('[1]');
      expect(prompt).toContain('[2]');
      expect(prompt).toContain('chunk1');
      expect(prompt).toContain('chunk2');
      expect(prompt).toContain('First chunk content');
      expect(prompt).toContain('Second chunk content');
    });

    it('should include chunk metadata in prompt', () => {
      const searchResults: SearchResult[] = [
        createMockSearchResult('chunk1', 'Content', 'policies'),
      ];

      const prompt = composePrompt('Test question', searchResults);

      expect(prompt).toContain('Page 1');
      expect(prompt).toContain('File: test.pdf');
      expect(prompt).toContain('Content Type: policies');
    });

    it('should handle empty search results', () => {
      const prompt = composePrompt('Test question', []);

      expect(prompt).toContain('No relevant context was found');
    });

    it('should include tool outputs when provided', () => {
      const toolResults: ToolResult[] = [
        {
          toolName: 'eligibility_check',
          output: { eligible: true, details: {} },
          success: true,
        },
      ];

      const prompt = composePrompt('Test question', [], undefined, toolResults);

      expect(prompt).toContain('Tool Outputs:');
      expect(prompt).toContain('eligibility_check');
      expect(prompt).toContain('Success');
    });

    it('should handle tool errors in outputs', () => {
      const toolResults: ToolResult[] = [
        {
          toolName: 'eligibility_check',
          output: null,
          success: false,
          error: 'Tool execution failed',
        },
      ];

      const prompt = composePrompt('Test question', [], undefined, toolResults);

      expect(prompt).toContain('Error: Tool execution failed');
    });

    it('should build complete prompt with all sections', () => {
      const userContext: UserContext = {
        role: 'engineer',
        level: 'mid',
      };

      const searchResults: SearchResult[] = [
        createMockSearchResult('chunk1', 'Content 1'),
        createMockSearchResult('chunk2', 'Content 2'),
      ];

      const toolResults: ToolResult[] = [
        {
          toolName: 'eligibility_check',
          output: { eligible: true },
          success: true,
        },
      ];

      const prompt = composePrompt('What is the policy?', searchResults, userContext, toolResults);

      // Check all sections are present
      expect(prompt).toContain('You are a helpful technical assistant');
      expect(prompt).toContain('User Profile:');
      expect(prompt).toContain('Retrieved Context');
      expect(prompt).toContain('Tool Outputs:');
      expect(prompt).toContain('What is the policy?');
    });

    it('should customize system instructions based on role', () => {
      const engineerContext: UserContext = { role: 'engineer' };
      const managerContext: UserContext = { role: 'manager' };

      const engineerPrompt = composePrompt('Test', [], engineerContext);
      const managerPrompt = composePrompt('Test', [], managerContext);

      expect(engineerPrompt).toContain('software engineers');
      expect(managerPrompt).toContain('managers and team leads');
    });

    it('should customize system instructions based on level', () => {
      const juniorContext: UserContext = { level: 'junior' };
      const seniorContext: UserContext = { level: 'senior' };

      const juniorPrompt = composePrompt('Test', [], juniorContext);
      const seniorPrompt = composePrompt('Test', [], seniorContext);

      expect(juniorPrompt).toContain('junior-level');
      expect(seniorPrompt).toContain('senior professionals');
    });

    it('should format chunks with citation markers instruction', () => {
      const searchResults: SearchResult[] = [
        createMockSearchResult('chunk1', 'Content'),
      ];

      const prompt = composePrompt('Test question', searchResults);

      expect(prompt).toContain('citation markers');
      expect(prompt).toContain('[1]');
    });

    it('should handle multiple tool outputs', () => {
      const toolResults: ToolResult[] = [
        {
          toolName: 'tool1',
          output: { result: 'output1' },
          success: true,
        },
        {
          toolName: 'tool2',
          output: { result: 'output2' },
          success: true,
        },
      ];

      const prompt = composePrompt('Test', [], undefined, toolResults);

      expect(prompt).toContain('tool1');
      expect(prompt).toContain('tool2');
    });
  });

  describe('extractChunkIds', () => {
    it('should extract chunk IDs from search results', () => {
      const searchResults: SearchResult[] = [
        createMockSearchResult('chunk1', 'Content 1'),
        createMockSearchResult('chunk2', 'Content 2'),
        createMockSearchResult('chunk3', 'Content 3'),
      ];

      const chunkIds = extractChunkIds(searchResults);

      expect(chunkIds).toEqual(['chunk1', 'chunk2', 'chunk3']);
    });

    it('should return empty array for empty search results', () => {
      const chunkIds = extractChunkIds([]);
      expect(chunkIds).toEqual([]);
    });

    it('should preserve order of chunk IDs', () => {
      const searchResults: SearchResult[] = [
        createMockSearchResult('chunk3', 'Content 3'),
        createMockSearchResult('chunk1', 'Content 1'),
        createMockSearchResult('chunk2', 'Content 2'),
      ];

      const chunkIds = extractChunkIds(searchResults);

      expect(chunkIds).toEqual(['chunk3', 'chunk1', 'chunk2']);
    });
  });
});

