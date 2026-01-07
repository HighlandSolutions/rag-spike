/**
 * Tool interface and implementations
 * Tools provide additional capabilities beyond RAG search
 */

import type { UserContext } from '@/types/domain';

/**
 * Tool execution result
 */
export interface ToolResult {
  toolName: string;
  output: unknown;
  success: boolean;
  error?: string;
}

/**
 * Tool interface
 */
export interface Tool {
  name: string;
  description: string;
  execute: (input: ToolInput) => Promise<ToolResult>;
  shouldExecute: (query: string) => boolean;
}

/**
 * Tool input parameters
 */
export interface ToolInput {
  query: string;
  userContext?: UserContext;
  parameters?: Record<string, unknown>;
}

/**
 * Eligibility check tool
 * Example tool that checks if user is eligible for something based on their context
 */
class EligibilityCheckTool implements Tool {
  name = 'eligibility_check';
  description = 'Checks eligibility for programs, benefits, or opportunities based on user role and level';

  shouldExecute(query: string): boolean {
    const eligibilityKeywords = [
      'eligible',
      'eligibility',
      'qualify',
      'qualification',
      'can i',
      'am i able',
      'do i qualify',
    ];

    const queryLower = query.toLowerCase();
    return eligibilityKeywords.some((keyword) => queryLower.includes(keyword));
  }

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const { userContext } = input;

      if (!userContext) {
        return {
          toolName: this.name,
          output: {
            message: 'User context is required for eligibility checks',
            eligible: false,
          },
          success: true,
        };
      }

      // Example eligibility logic
      const eligibilityResults: Record<string, boolean> = {};

      // Check role-based eligibility
      if (userContext.role) {
        const roleLower = userContext.role.toLowerCase();
        eligibilityResults.roleBased = ['engineer', 'manager', 'hr', 'executive'].includes(roleLower);
      }

      // Check level-based eligibility
      if (userContext.level) {
        eligibilityResults.levelBased = ['junior', 'mid', 'senior', 'lead', 'executive'].includes(
          userContext.level
        );
      }

      // Check target job eligibility
      if (userContext.targetJob) {
        eligibilityResults.targetJobBased = userContext.targetJob.length > 0;
      }

      return {
        toolName: this.name,
        output: {
          eligible: Object.values(eligibilityResults).every((val) => val === true),
          details: eligibilityResults,
        },
        success: true,
      };
    } catch (error) {
      return {
        toolName: this.name,
        output: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Registry of available tools
 */
const tools: Tool[] = [new EligibilityCheckTool()];

/**
 * Get all available tools
 */
export const getAvailableTools = (): Tool[] => {
  return tools;
};

/**
 * Determine which tools should execute based on query and user context
 */
export const determineToolsToExecute = (query: string): Tool[] => {
  return tools.filter((tool) => tool.shouldExecute(query));
};

/**
 * Execute a tool
 */
export const executeTool = async (tool: Tool, input: ToolInput): Promise<ToolResult> => {
  return tool.execute(input);
};

/**
 * Execute multiple tools in parallel
 */
export const executeTools = async (
  toolsToExecute: Tool[],
  query: string,
  userContext?: UserContext
): Promise<ToolResult[]> => {
  const input: ToolInput = {
    query,
    userContext,
  };

  const executions = toolsToExecute.map((tool) => executeTool(tool, input));
  return Promise.all(executions);
};

