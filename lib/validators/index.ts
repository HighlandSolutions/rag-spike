/**
 * Type guards and validators
 * Provides runtime type checking and validation functions
 */

import type {
  Document,
  DocumentChunk,
  UserContext,
  SearchRequest,
  ChatRequest,
  ContentType,
  ChunkMetadata,
} from '@/types/domain';

/**
 * Type guard: Check if value is a valid ContentType
 */
export const isContentType = (value: unknown): value is ContentType => {
  return (
    typeof value === 'string' &&
    (value === 'policies' || value === 'learning_content' || value === 'internal_roles' || value === 'all')
  );
};

/**
 * Type guard: Check if value is a valid UserContext
 */
export const isUserContext = (value: unknown): value is UserContext => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const ctx = value as Record<string, unknown>;

  // Basic fields
  if (ctx.role !== undefined && typeof ctx.role !== 'string') {
    return false;
  }

  if (ctx.level !== undefined) {
    const validLevels = ['junior', 'mid', 'senior', 'lead', 'executive'];
    if (!validLevels.includes(ctx.level as string)) {
      return false;
    }
  }

  if (ctx.targetJob !== undefined && typeof ctx.targetJob !== 'string') {
    return false;
  }

  if (ctx.learningPreferences !== undefined) {
    if (!Array.isArray(ctx.learningPreferences)) {
      return false;
    }
    if (!ctx.learningPreferences.every((pref) => typeof pref === 'string')) {
      return false;
    }
  }

  // Communication style preferences
  if (ctx.communicationStyle !== undefined) {
    const validStyles = ['concise', 'detailed', 'balanced'];
    if (!validStyles.includes(ctx.communicationStyle as string)) {
      return false;
    }
  }

  if (ctx.tone !== undefined) {
    const validTones = ['formal', 'casual', 'professional'];
    if (!validTones.includes(ctx.tone as string)) {
      return false;
    }
  }

  if (ctx.technicalDepth !== undefined) {
    const validDepths = ['beginner', 'intermediate', 'advanced', 'expert'];
    if (!validDepths.includes(ctx.technicalDepth as string)) {
      return false;
    }
  }

  // Domain expertise
  if (ctx.expertise !== undefined) {
    if (!Array.isArray(ctx.expertise)) {
      return false;
    }
    if (!ctx.expertise.every((item) => typeof item === 'string')) {
      return false;
    }
  }

  if (ctx.currentSkills !== undefined) {
    if (!Array.isArray(ctx.currentSkills)) {
      return false;
    }
    if (!ctx.currentSkills.every((item) => typeof item === 'string')) {
      return false;
    }
  }

  if (ctx.knowledgeGaps !== undefined) {
    if (!Array.isArray(ctx.knowledgeGaps)) {
      return false;
    }
    if (!ctx.knowledgeGaps.every((item) => typeof item === 'string')) {
      return false;
    }
  }

  // Goals and objectives
  if (ctx.primaryGoal !== undefined) {
    const validGoals = ['skill_development', 'career_transition', 'role_preparation', 'general_learning'];
    if (!validGoals.includes(ctx.primaryGoal as string)) {
      return false;
    }
  }

  if (ctx.timeHorizon !== undefined) {
    const validHorizons = ['immediate', 'short_term', 'long_term'];
    if (!validHorizons.includes(ctx.timeHorizon as string)) {
      return false;
    }
  }

  if (ctx.focusAreas !== undefined) {
    if (!Array.isArray(ctx.focusAreas)) {
      return false;
    }
    if (!ctx.focusAreas.every((item) => typeof item === 'string')) {
      return false;
    }
  }

  // Response format preferences
  if (ctx.preferredFormat !== undefined) {
    const validFormats = ['structured', 'narrative', 'bullet_points', 'step_by_step'];
    if (!validFormats.includes(ctx.preferredFormat as string)) {
      return false;
    }
  }

  if (ctx.includeExamples !== undefined && typeof ctx.includeExamples !== 'boolean') {
    return false;
  }

  if (ctx.includeCodeSnippets !== undefined && typeof ctx.includeCodeSnippets !== 'boolean') {
    return false;
  }

  if (ctx.citationDetail !== undefined) {
    const validDetails = ['minimal', 'standard', 'detailed'];
    if (!validDetails.includes(ctx.citationDetail as string)) {
      return false;
    }
  }

  // Context and background
  if (ctx.industry !== undefined && typeof ctx.industry !== 'string') {
    return false;
  }

  if (ctx.companySize !== undefined) {
    const validSizes = ['startup', 'small', 'medium', 'large', 'enterprise'];
    if (!validSizes.includes(ctx.companySize as string)) {
      return false;
    }
  }

  if (ctx.yearsOfExperience !== undefined && typeof ctx.yearsOfExperience !== 'number') {
    return false;
  }

  if (ctx.currentRole !== undefined && typeof ctx.currentRole !== 'string') {
    return false;
  }

  // Language and localization
  if (ctx.language !== undefined && typeof ctx.language !== 'string') {
    return false;
  }

  if (ctx.region !== undefined && typeof ctx.region !== 'string') {
    return false;
  }

  return true;
};

/**
 * Type guard: Check if value is a valid ChunkMetadata
 */
export const isChunkMetadata = (value: unknown): value is ChunkMetadata => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const metadata = value as Record<string, unknown>;

  if (metadata.pageNumber !== undefined && typeof metadata.pageNumber !== 'number') {
    return false;
  }

  if (metadata.rowIndex !== undefined && typeof metadata.rowIndex !== 'number') {
    return false;
  }

  if (metadata.columnNames !== undefined) {
    if (!Array.isArray(metadata.columnNames)) {
      return false;
    }
    if (!metadata.columnNames.every((col) => typeof col === 'string')) {
      return false;
    }
  }

  if (metadata.fileName !== undefined && typeof metadata.fileName !== 'string') {
    return false;
  }

  if (metadata.sourceLocation !== undefined && typeof metadata.sourceLocation !== 'string') {
    return false;
  }

  return true;
};

/**
 * Type guard: Check if value is a valid Document
 */
export const isDocument = (value: unknown): value is Document => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const doc = value as Record<string, unknown>;

  return (
    typeof doc.id === 'string' &&
    typeof doc.tenantId === 'string' &&
    typeof doc.sourcePath === 'string' &&
    typeof doc.name === 'string' &&
    typeof doc.contentType === 'string' &&
    doc.uploadedAt instanceof Date &&
    doc.createdAt instanceof Date &&
    doc.updatedAt instanceof Date
  );
};

/**
 * Type guard: Check if value is a valid DocumentChunk
 */
export const isDocumentChunk = (value: unknown): value is DocumentChunk => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const chunk = value as Record<string, unknown>;

  return (
    typeof chunk.id === 'string' &&
    typeof chunk.tenantId === 'string' &&
    typeof chunk.documentId === 'string' &&
    typeof chunk.chunkText === 'string' &&
    isChunkMetadata(chunk.chunkMetadata) &&
    typeof chunk.contentType === 'string' &&
    (chunk.embedding === null || (Array.isArray(chunk.embedding) && chunk.embedding.every((e) => typeof e === 'number'))) &&
    chunk.createdAt instanceof Date
  );
};

/**
 * Type guard: Check if value is a valid SearchRequest
 */
export const isSearchRequest = (value: unknown): value is SearchRequest => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const req = value as Record<string, unknown>;

  if (typeof req.tenantId !== 'string' || req.tenantId.length === 0) {
    return false;
  }

  if (typeof req.query !== 'string' || req.query.length === 0) {
    return false;
  }

  if (req.userContext !== undefined && !isUserContext(req.userContext)) {
    return false;
  }

  if (req.k !== undefined && (typeof req.k !== 'number' || req.k < 1)) {
    return false;
  }

  if (req.filters !== undefined) {
    if (typeof req.filters !== 'object') {
      return false;
    }

    const filters = req.filters as Record<string, unknown>;

    if (filters.contentType !== undefined) {
      if (!isContentType(filters.contentType) && !Array.isArray(filters.contentType)) {
        return false;
      }
      if (Array.isArray(filters.contentType) && !filters.contentType.every(isContentType)) {
        return false;
      }
    }

    if (filters.tenantId !== undefined && typeof filters.tenantId !== 'string') {
      return false;
    }

    if (filters.documentIds !== undefined) {
      if (!Array.isArray(filters.documentIds)) {
        return false;
      }
      if (!filters.documentIds.every((id) => typeof id === 'string')) {
        return false;
      }
    }
  }

  return true;
};

/**
 * Type guard: Check if value is a valid ChatRequest
 */
export const isChatRequest = (value: unknown): value is ChatRequest => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const req = value as Record<string, unknown>;

  if (typeof req.question !== 'string' || req.question.length === 0) {
    return false;
  }

  if (req.userContext !== undefined && !isUserContext(req.userContext)) {
    return false;
  }

  if (req.metadata !== undefined && (typeof req.metadata !== 'object' || req.metadata === null)) {
    return false;
  }

  if (req.sessionId !== undefined && typeof req.sessionId !== 'string') {
    return false;
  }

  return true;
};

/**
 * Validate and normalize SearchRequest
 * Returns normalized request or throws error
 */
export const validateSearchRequest = (value: unknown): SearchRequest => {
  if (!isSearchRequest(value)) {
    throw new Error('Invalid SearchRequest: missing required fields or invalid types');
  }

  return {
    tenantId: value.tenantId,
    userContext: value.userContext,
    query: value.query.trim(),
    k: value.k ?? 8,
    filters: value.filters,
  };
};

/**
 * Validate and normalize ChatRequest
 * Returns normalized request or throws error
 */
export const validateChatRequest = (value: unknown): ChatRequest => {
  if (!isChatRequest(value)) {
    throw new Error('Invalid ChatRequest: missing required fields or invalid types');
  }

  return {
    question: value.question.trim(),
    userContext: value.userContext,
    metadata: value.metadata,
    sessionId: value.sessionId,
  };
};

/**
 * Validate UUID format
 */
export const isValidUUID = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * Validate embedding vector
 * Checks if it's an array of numbers with correct dimension
 */
export const isValidEmbedding = (embedding: unknown, expectedDimension = 1536): boolean => {
  if (!Array.isArray(embedding)) {
    return false;
  }

  if (embedding.length !== expectedDimension) {
    return false;
  }

  return embedding.every((value) => typeof value === 'number' && !isNaN(value));
};



