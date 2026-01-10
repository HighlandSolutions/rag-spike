/**
 * Domain types for the RAG application
 */

/**
 * Document type (application-level, not database row)
 */
export interface Document {
  id: string;
  tenantId: string;
  sourcePath: string;
  name: string;
  contentType: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chunk metadata stored in chunk_metadata JSONB column
 */
export interface ChunkMetadata {
  pageNumber?: number;
  rowIndex?: number;
  columnNames?: string[];
  fileName?: string;
  sourceLocation?: string;
  // URL-specific metadata
  url?: string;
  pageTitle?: string;
  pageDescription?: string;
  fetchedAt?: string; // ISO timestamp
  lastModified?: string; // ISO timestamp
  [key: string]: unknown;
}

/**
 * Document chunk type (application-level, not database row)
 */
export interface DocumentChunk {
  id: string;
  tenantId: string;
  documentId: string;
  chunkText: string;
  chunkMetadata: ChunkMetadata;
  contentType: string;
  embedding: number[] | null;
  createdAt: Date;
}

/**
 * User context for personalizing search and responses
 */
export interface UserContext {
  role?: string;
  level?: 'junior' | 'mid' | 'senior' | 'lead' | 'executive';
  targetJob?: string;
  learningPreferences?: string[];
  
  // Communication style preferences
  communicationStyle?: 'concise' | 'detailed' | 'balanced';
  tone?: 'formal' | 'casual' | 'professional';
  technicalDepth?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  
  // Domain expertise
  expertise?: string[];
  currentSkills?: string[];
  knowledgeGaps?: string[];
  
  // Goals and objectives
  primaryGoal?: 'skill_development' | 'career_transition' | 'role_preparation' | 'general_learning';
  timeHorizon?: 'immediate' | 'short_term' | 'long_term';
  focusAreas?: string[];
  
  // Response format preferences
  preferredFormat?: 'structured' | 'narrative' | 'bullet_points' | 'step_by_step';
  includeExamples?: boolean;
  includeCodeSnippets?: boolean;
  citationDetail?: 'minimal' | 'standard' | 'detailed';
  
  // Context and background
  industry?: string;
  companySize?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  yearsOfExperience?: number;
  currentRole?: string;
  
  // Language and localization
  language?: string;
  region?: string;
}

/**
 * Content type filter options
 */
export type ContentType = 'policies' | 'learning_content' | 'internal_roles' | 'all';

/**
 * Search filters
 */
export interface SearchFilters {
  contentType?: ContentType | ContentType[];
  tenantId?: string;
  documentIds?: string[];
}

/**
 * Search request
 */
export interface SearchRequest {
  tenantId: string;
  userContext?: UserContext;
  query: string;
  k?: number; // Number of results to return (default: 8)
  filters?: SearchFilters;
}

/**
 * Search result with score
 */
export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  matchType?: 'keyword' | 'vector' | 'hybrid';
}

/**
 * Search response
 */
export interface SearchResponse {
  chunks: SearchResult[];
  totalCount?: number;
  queryTime?: number;
}

/**
 * Chat request
 */
export interface ChatRequest {
  question: string;
  userContext?: UserContext;
  metadata?: Record<string, unknown>;
  sessionId?: string;
}

/**
 * Chat response chunk (for streaming)
 */
export interface ChatResponseChunk {
  text: string;
  chunkIds?: string[];
  isComplete: boolean;
  error?: string;
}

/**
 * Chat response (complete)
 */
export interface ChatResponse {
  answer: string;
  chunkIds: string[];
  metadata?: Record<string, unknown>;
  toolOutputs?: unknown[];
}

/**
 * API error response
 */
export interface ApiError {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
}



