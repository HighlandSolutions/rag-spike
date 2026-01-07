/**
 * Structured prompt composition service
 * Builds prompts with user context, retrieved chunks, and tool outputs
 */

import type { UserContext, SearchResult } from '@/types/domain';
import type { ToolResult } from './tools';

/**
 * Prompt sections
 */
interface PromptSections {
  systemInstructions: string;
  userProfile: string;
  retrievedChunks: string;
  toolOutputs: string;
  userQuestion: string;
}

/**
 * Build system instructions based on user role
 */
const buildSystemInstructions = (userContext?: UserContext): string => {
  const role = userContext?.role || 'user';
  const level = userContext?.level || 'mid';

  const roleInstructions: Record<string, string> = {
    engineer: 'You are a helpful technical assistant for software engineers.',
    manager: 'You are a helpful assistant for managers and team leads.',
    hr: 'You are a helpful assistant for HR professionals.',
    executive: 'You are a helpful assistant for executives and leadership.',
    default: 'You are a helpful assistant.',
  };

  const levelInstructions: Record<string, string> = {
    junior: 'Provide clear, detailed explanations suitable for junior-level professionals.',
    mid: 'Provide balanced explanations suitable for mid-level professionals.',
    senior: 'Provide concise, high-level explanations suitable for senior professionals.',
    lead: 'Provide strategic, high-level insights suitable for leads.',
    executive: 'Provide executive-level summaries and strategic insights.',
    default: 'Provide appropriate explanations for the user level.',
  };

  const roleInstruction = roleInstructions[role.toLowerCase()] || roleInstructions.default;
  const levelInstruction = levelInstructions[level] || levelInstructions.default;

  return `${roleInstruction} ${levelInstruction}

Your responses should be:
- Accurate and based on the provided context
- Clear and well-structured
- Cite specific sources when referencing information
- Helpful and actionable

When referencing information from the provided context, use citation markers like [1], [2], etc., corresponding to the chunk identifiers provided.`;
};

/**
 * Build user profile section
 */
const buildUserProfile = (userContext?: UserContext): string => {
  if (!userContext) {
    return '';
  }

  const parts: string[] = [];

  if (userContext.role) {
    parts.push(`Role: ${userContext.role}`);
  }

  if (userContext.level) {
    parts.push(`Level: ${userContext.level}`);
  }

  if (userContext.targetJob) {
    parts.push(`Target Job: ${userContext.targetJob}`);
  }

  if (userContext.learningPreferences && userContext.learningPreferences.length > 0) {
    parts.push(`Learning Preferences: ${userContext.learningPreferences.join(', ')}`);
  }

  if (parts.length === 0) {
    return '';
  }

  return `User Profile:
${parts.map((part) => `- ${part}`).join('\n')}`;
};

/**
 * Build retrieved chunks section with identifiers
 */
const buildRetrievedChunks = (searchResults: SearchResult[]): string => {
  if (searchResults.length === 0) {
    return 'No relevant context was found for this query.';
  }

  const chunksText = searchResults
    .map((result, index) => {
      const chunkId = result.chunk.id;
      const chunkText = result.chunk.chunkText;
      const metadata = result.chunk.chunkMetadata;
      const contentType = result.chunk.contentType;

      const metadataParts: string[] = [];
      if (metadata.pageNumber !== undefined) {
        metadataParts.push(`Page ${metadata.pageNumber}`);
      }
      if (metadata.rowIndex !== undefined) {
        metadataParts.push(`Row ${metadata.rowIndex}`);
      }
      if (metadata.fileName) {
        metadataParts.push(`File: ${metadata.fileName}`);
      }

      const metadataText = metadataParts.length > 0 ? ` (${metadataParts.join(', ')})` : '';

      return `[${index + 1}] Chunk ID: ${chunkId} | Content Type: ${contentType}${metadataText}
${chunkText}`;
    })
    .join('\n\n');

  return `Retrieved Context (use citation markers [1], [2], etc. when referencing):
${chunksText}`;
};

/**
 * Build tool outputs section
 */
const buildToolOutputs = (toolResults: ToolResult[]): string => {
  if (toolResults.length === 0) {
    return '';
  }

  const outputsText = toolResults
    .map((result) => {
      const outputJson = JSON.stringify(result.output, null, 2);
      return `Tool: ${result.toolName}
${result.success ? 'Success' : `Error: ${result.error}`}
Output: ${outputJson}`;
    })
    .join('\n\n');

  return `Tool Outputs:
${outputsText}`;
};

/**
 * Build complete prompt from sections
 */
const buildCompletePrompt = (sections: PromptSections): string => {
  const parts: string[] = [];

  // System instructions
  parts.push(sections.systemInstructions);

  // User profile (if available)
  if (sections.userProfile) {
    parts.push('\n' + sections.userProfile);
  }

  // Retrieved chunks
  parts.push('\n' + sections.retrievedChunks);

  // Tool outputs (if available)
  if (sections.toolOutputs) {
    parts.push('\n' + sections.toolOutputs);
  }

  // User question
  parts.push('\n\nUser Question:');
  parts.push(sections.userQuestion);

  return parts.join('\n');
};

/**
 * Compose structured prompt
 */
export const composePrompt = (
  userQuestion: string,
  searchResults: SearchResult[],
  userContext?: UserContext,
  toolResults?: ToolResult[]
): string => {
  const sections: PromptSections = {
    systemInstructions: buildSystemInstructions(userContext),
    userProfile: buildUserProfile(userContext),
    retrievedChunks: buildRetrievedChunks(searchResults),
    toolOutputs: toolResults && toolResults.length > 0 ? buildToolOutputs(toolResults) : '',
    userQuestion,
  };

  return buildCompletePrompt(sections);
};

/**
 * Extract chunk IDs from search results
 */
export const extractChunkIds = (searchResults: SearchResult[]): string[] => {
  return searchResults.map((result) => result.chunk.id);
};

