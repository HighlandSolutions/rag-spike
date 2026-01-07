/**
 * Chat message types
 */

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  chunkIds?: string[];
  error?: boolean; // Indicates if this message represents an error state
}

