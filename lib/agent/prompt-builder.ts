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
 * Build system instructions based on user role and preferences
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

  // Build style instructions based on communication preferences
  const styleInstructions: string[] = [];

  // Communication style
  if (userContext?.communicationStyle === 'concise') {
    styleInstructions.push('Provide brief, to-the-point answers. Avoid unnecessary elaboration.');
  } else if (userContext?.communicationStyle === 'detailed') {
    styleInstructions.push('Provide comprehensive, thorough explanations with full context.');
  } else if (userContext?.communicationStyle === 'balanced') {
    styleInstructions.push('Provide balanced explanations that are neither too brief nor overly verbose.');
  }

  // Technical depth
  if (userContext?.technicalDepth) {
    const depthMap: Record<string, string> = {
      beginner: 'Use simple language and explain all technical terms. Assume minimal prior knowledge.',
      intermediate: 'Assume familiarity with common concepts but explain advanced topics in detail.',
      advanced: 'Use technical terminology freely and focus on nuanced details and best practices.',
      expert: 'Provide deep technical insights, advanced strategies, and expert-level analysis.',
    };
    styleInstructions.push(depthMap[userContext.technicalDepth]);
  }

  // Tone
  if (userContext?.tone === 'formal') {
    styleInstructions.push('Maintain a formal, professional tone throughout your responses.');
  } else if (userContext?.tone === 'casual') {
    styleInstructions.push('Use a friendly, conversational tone while remaining professional.');
  } else if (userContext?.tone === 'professional') {
    styleInstructions.push('Maintain a professional yet approachable tone.');
  }

  // Response format
  if (userContext?.preferredFormat === 'bullet_points') {
    styleInstructions.push('Format responses as bullet points or lists when possible for clarity.');
  } else if (userContext?.preferredFormat === 'step_by_step') {
    styleInstructions.push('Break down complex topics into clear, numbered step-by-step instructions.');
  } else if (userContext?.preferredFormat === 'structured') {
    styleInstructions.push('Use structured formatting with clear sections and headings.');
  } else if (userContext?.preferredFormat === 'narrative') {
    styleInstructions.push('Provide responses in a flowing narrative format.');
  }

  // Examples and code
  if (userContext?.includeExamples === true) {
    styleInstructions.push('Include practical examples to illustrate concepts.');
  }
  if (userContext?.includeCodeSnippets === true) {
    styleInstructions.push('Include code snippets or technical examples when relevant.');
  }

  // Citation detail
  if (userContext?.citationDetail === 'minimal') {
    styleInstructions.push('Use minimal citations - only cite when directly quoting or referencing specific information.');
  } else if (userContext?.citationDetail === 'detailed') {
    styleInstructions.push('Provide detailed citations with context about the source material.');
  }

  // Primary goal
  if (userContext?.primaryGoal) {
    const goalMap: Record<string, string> = {
      skill_development: 'Focus on helping the user develop new skills and deepen existing ones.',
      career_transition: 'Provide guidance relevant to transitioning to new roles or career paths.',
      role_preparation: 'Tailor responses to help prepare for specific roles or responsibilities.',
      general_learning: 'Provide educational content that supports general learning objectives.',
    };
    styleInstructions.push(goalMap[userContext.primaryGoal]);
  }

  // Time horizon
  if (userContext?.timeHorizon === 'immediate') {
    styleInstructions.push('Focus on actionable, immediate steps the user can take right away.');
  } else if (userContext?.timeHorizon === 'short_term') {
    styleInstructions.push('Provide guidance for short-term goals and actions (weeks to months).');
  } else if (userContext?.timeHorizon === 'long_term') {
    styleInstructions.push('Provide strategic guidance for long-term career development and planning.');
  }

  // Combine all instructions
  const baseInstructions = `${roleInstruction} ${levelInstruction}

Your responses should be:
- Accurate and based on the provided context
- Clear and well-structured
- ALWAYS cite sources when referencing information from the provided context using citation markers [1], [2], etc.
- Helpful and actionable`;

  const styleSection = styleInstructions.length > 0
    ? `\n\nAdditional Guidelines:\n${styleInstructions.map((instruction) => `- ${instruction}`).join('\n')}`
    : '';

  const citationInstruction = userContext?.citationDetail === 'minimal'
    ? '\n\nIMPORTANT: You MUST use citation markers [1], [2], etc. when referencing specific information from the provided context. Use them sparingly, only when directly quoting or referencing specific information.'
    : '\n\nIMPORTANT: You MUST use citation markers [1], [2], etc. when referencing ANY information from the provided context. Each citation marker corresponds to the chunk number shown in the "Retrieved Context" section below. For example, if you reference information from the first chunk, use [1]; from the second chunk, use [2], and so on.';

  return `${baseInstructions}${styleSection}${citationInstruction}`;
};

/**
 * Build user profile section
 */
const buildUserProfile = (userContext?: UserContext): string => {
  if (!userContext) {
    return '';
  }

  const parts: string[] = [];

  // Basic profile
  if (userContext.role) {
    parts.push(`Role: ${userContext.role}`);
  }

  if (userContext.currentRole) {
    parts.push(`Current Role: ${userContext.currentRole}`);
  }

  if (userContext.level) {
    parts.push(`Level: ${userContext.level}`);
  }

  if (userContext.targetJob) {
    parts.push(`Target Job: ${userContext.targetJob}`);
  }

  if (userContext.yearsOfExperience !== undefined) {
    parts.push(`Years of Experience: ${userContext.yearsOfExperience}`);
  }

  // Context and background
  if (userContext.industry) {
    parts.push(`Industry: ${userContext.industry}`);
  }

  if (userContext.companySize) {
    parts.push(`Company Size: ${userContext.companySize}`);
  }

  // Expertise and skills
  if (userContext.expertise && userContext.expertise.length > 0) {
    parts.push(`Expertise: ${userContext.expertise.join(', ')}`);
  }

  if (userContext.currentSkills && userContext.currentSkills.length > 0) {
    parts.push(`Current Skills: ${userContext.currentSkills.join(', ')}`);
  }

  if (userContext.knowledgeGaps && userContext.knowledgeGaps.length > 0) {
    parts.push(`Knowledge Gaps: ${userContext.knowledgeGaps.join(', ')}`);
  }

  // Goals
  if (userContext.primaryGoal) {
    parts.push(`Primary Goal: ${userContext.primaryGoal.replace(/_/g, ' ')}`);
  }

  if (userContext.timeHorizon) {
    parts.push(`Time Horizon: ${userContext.timeHorizon.replace(/_/g, ' ')}`);
  }

  if (userContext.focusAreas && userContext.focusAreas.length > 0) {
    parts.push(`Focus Areas: ${userContext.focusAreas.join(', ')}`);
  }

  // Learning preferences
  if (userContext.learningPreferences && userContext.learningPreferences.length > 0) {
    parts.push(`Learning Preferences: ${userContext.learningPreferences.join(', ')}`);
  }

  // Localization
  if (userContext.region) {
    parts.push(`Region: ${userContext.region}`);
  }

  if (userContext.language) {
    parts.push(`Language: ${userContext.language}`);
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
      const citationNumber = index + 1;

      return `[${citationNumber}] Chunk ID: ${chunkId} | Content Type: ${contentType}${metadataText}
${chunkText}

--- Use [${citationNumber}] when referencing the above information ---`;
    })
    .join('\n\n');

  return `Retrieved Context (MUST use citation markers [1], [2], etc. when referencing):
${chunksText}

REMINDER: When you reference information from any chunk above, you MUST include the corresponding citation marker (e.g., [1], [2], [3]) in your response.`;
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

