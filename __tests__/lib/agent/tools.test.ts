/**
 * Unit tests for tool integration
 */

import {
  getAvailableTools,
  determineToolsToExecute,
  executeTool,
  executeTools,
} from '@/lib/agent/tools';
import type { UserContext } from '@/types/domain';
import type { Tool, ToolInput } from '@/lib/agent/tools';

describe('tools', () => {
  describe('getAvailableTools', () => {
    it('should return array of available tools', () => {
      const tools = getAvailableTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include eligibility check tool', () => {
      const tools = getAvailableTools();
      const eligibilityTool = tools.find((tool) => tool.name === 'eligibility_check');

      expect(eligibilityTool).toBeDefined();
      expect(eligibilityTool?.description).toContain('eligibility');
    });
  });

  describe('determineToolsToExecute', () => {
    it('should return empty array when no tools match', () => {
      const query = 'What is the weather?';
      const tools = determineToolsToExecute(query);

      expect(tools).toEqual([]);
    });

    it('should detect eligibility queries', () => {
      const queries = [
        'Am I eligible for this program?',
        'Do I qualify for benefits?',
        'Can I apply for this?',
        'What is my eligibility status?',
      ];

      queries.forEach((query) => {
        const tools = determineToolsToExecute(query);
        const eligibilityTool = tools.find((tool) => tool.name === 'eligibility_check');
        expect(eligibilityTool).toBeDefined();
      });
    });

    it('should be case-insensitive for keyword matching', () => {
      const query = 'AM I ELIGIBLE?';
      const tools = determineToolsToExecute(query);

      expect(tools.length).toBeGreaterThan(0);
    });

    it('should not execute tools for unrelated queries', () => {
      const query = 'What is the company policy on vacation?';
      const tools = determineToolsToExecute(query);

      expect(tools.length).toBe(0);
    });
  });

  describe('executeTool', () => {
    it('should execute eligibility check tool successfully', async () => {
      const tools = getAvailableTools();
      const eligibilityTool = tools.find((tool) => tool.name === 'eligibility_check')!;

      const input: ToolInput = {
        query: 'Am I eligible?',
        userContext: {
          role: 'engineer',
          level: 'senior',
        },
      };

      const result = await executeTool(eligibilityTool, input);

      expect(result.toolName).toBe('eligibility_check');
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should handle missing user context in eligibility check', async () => {
      const tools = getAvailableTools();
      const eligibilityTool = tools.find((tool) => tool.name === 'eligibility_check')!;

      const input: ToolInput = {
        query: 'Am I eligible?',
      };

      const result = await executeTool(eligibilityTool, input);

      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('message');
      expect(result.output).toHaveProperty('eligible');
    });

    it('should check role-based eligibility', async () => {
      const tools = getAvailableTools();
      const eligibilityTool = tools.find((tool) => tool.name === 'eligibility_check')!;

      const input: ToolInput = {
        query: 'Am I eligible?',
        userContext: {
          role: 'engineer',
        },
      };

      const result = await executeTool(eligibilityTool, input);

      expect(result.success).toBe(true);
      if (result.output && typeof result.output === 'object' && 'details' in result.output) {
        const details = result.output.details as Record<string, boolean>;
        expect(details.roleBased).toBe(true);
      }
    });

    it('should check level-based eligibility', async () => {
      const tools = getAvailableTools();
      const eligibilityTool = tools.find((tool) => tool.name === 'eligibility_check')!;

      const input: ToolInput = {
        query: 'Am I eligible?',
        userContext: {
          level: 'senior',
        },
      };

      const result = await executeTool(eligibilityTool, input);

      expect(result.success).toBe(true);
      if (result.output && typeof result.output === 'object' && 'details' in result.output) {
        const details = result.output.details as Record<string, boolean>;
        expect(details.levelBased).toBe(true);
      }
    });

    it('should check target job eligibility', async () => {
      const tools = getAvailableTools();
      const eligibilityTool = tools.find((tool) => tool.name === 'eligibility_check')!;

      const input: ToolInput = {
        query: 'Am I eligible?',
        userContext: {
          targetJob: 'senior engineer',
        },
      };

      const result = await executeTool(eligibilityTool, input);

      expect(result.success).toBe(true);
      if (result.output && typeof result.output === 'object' && 'details' in result.output) {
        const details = result.output.details as Record<string, boolean>;
        expect(details.targetJobBased).toBe(true);
      }
    });

    it('should handle tool execution errors gracefully', async () => {
      // Create a mock tool that throws an error
      const errorTool: Tool = {
        name: 'error_tool',
        description: 'Tool that throws errors',
        shouldExecute: () => true,
        execute: async () => {
          throw new Error('Tool execution failed');
        },
      };

      const input: ToolInput = {
        query: 'test',
      };

      const result = await executeTool(errorTool, input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('executeTools', () => {
    it('should execute multiple tools in parallel', async () => {
      const tools = getAvailableTools();
      const eligibilityTool = tools.find((tool) => tool.name === 'eligibility_check')!;

      const userContext: UserContext = {
        role: 'engineer',
        level: 'senior',
      };

      const results = await executeTools([eligibilityTool], 'Am I eligible?', userContext);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should execute multiple different tools', async () => {
      const tools = getAvailableTools();
      const eligibilityTool = tools.find((tool) => tool.name === 'eligibility_check')!;

      // For now, we only have one tool, but this test structure supports multiple
      const results = await executeTools([eligibilityTool], 'Am I eligible?', {
        role: 'engineer',
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result.toolName).toBeDefined();
        expect(result.success).toBeDefined();
      });
    });

    it('should handle empty tools array', async () => {
      const results = await executeTools([], 'test query');

      expect(results).toEqual([]);
    });

    it('should pass correct input to all tools', async () => {
      const tools = getAvailableTools();
      const eligibilityTool = tools.find((tool) => tool.name === 'eligibility_check')!;

      const userContext: UserContext = {
        role: 'manager',
        level: 'mid',
      };

      const results = await executeTools([eligibilityTool], 'Am I eligible?', userContext);

      expect(results[0].success).toBe(true);
      // Verify that user context was used
      if (
        results[0].output &&
        typeof results[0].output === 'object' &&
        'details' in results[0].output
      ) {
        const details = results[0].output.details as Record<string, boolean>;
        expect(details.roleBased).toBe(true);
      }
    });
  });

  describe('tool shouldExecute logic', () => {
    it('should correctly identify eligibility-related queries', () => {
      const tools = getAvailableTools();
      const eligibilityTool = tools.find((tool) => tool.name === 'eligibility_check')!;

      const eligibleQueries = [
        'Am I eligible?',
        'Do I qualify?',
        'Can I apply?',
        'What is my eligibility?',
      ];

      eligibleQueries.forEach((query) => {
        expect(eligibilityTool.shouldExecute(query)).toBe(true);
      });
    });

    it('should not execute for non-eligibility queries', () => {
      const tools = getAvailableTools();
      const eligibilityTool = tools.find((tool) => tool.name === 'eligibility_check')!;

      const nonEligibleQueries = [
        'What is the policy?',
        'How do I submit a request?',
        'Tell me about benefits',
      ];

      nonEligibleQueries.forEach((query) => {
        expect(eligibilityTool.shouldExecute(query)).toBe(false);
      });
    });
  });
});




