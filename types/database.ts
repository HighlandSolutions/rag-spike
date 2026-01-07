/**
 * Database schema types
 * These types represent the structure of tables in Supabase
 */

export interface Database {
  public: {
    tables: {
      documents: {
        Row: DocumentRow;
        Insert: DocumentInsert;
        Update: DocumentUpdate;
      };
      chunks: {
        Row: ChunkRow;
        Insert: ChunkInsert;
        Update: ChunkUpdate;
      };
      chat_sessions: {
        Row: ChatSessionRow;
        Insert: ChatSessionInsert;
        Update: ChatSessionUpdate;
      };
      chat_messages: {
        Row: ChatMessageRow;
        Insert: ChatMessageInsert;
        Update: ChatMessageUpdate;
      };
    };
  };
}

/**
 * Document table row type
 */
export interface DocumentRow {
  id: string;
  tenant_id: string;
  source_path: string;
  name: string;
  content_type: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Document insert type (for creating new documents)
 */
export interface DocumentInsert {
  id?: string;
  tenant_id?: string;
  source_path: string;
  name: string;
  content_type: string;
  uploaded_at?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Document update type (for updating existing documents)
 */
export interface DocumentUpdate {
  id?: string;
  tenant_id?: string;
  source_path?: string;
  name?: string;
  content_type?: string;
  uploaded_at?: string;
  updated_at?: string;
}

/**
 * Chunk table row type
 */
export interface ChunkRow {
  id: string;
  tenant_id: string;
  document_id: string;
  chunk_text: string;
  chunk_metadata: Record<string, unknown>;
  content_type: string;
  embedding: number[] | null;
  created_at: string;
}

/**
 * Chunk insert type (for creating new chunks)
 */
export interface ChunkInsert {
  id?: string;
  tenant_id?: string;
  document_id: string;
  chunk_text: string;
  chunk_metadata?: Record<string, unknown>;
  content_type: string;
  embedding?: number[] | null;
  created_at?: string;
}

/**
 * Chunk update type (for updating existing chunks)
 */
export interface ChunkUpdate {
  id?: string;
  tenant_id?: string;
  document_id?: string;
  chunk_text?: string;
  chunk_metadata?: Record<string, unknown>;
  content_type?: string;
  embedding?: number[] | null;
}

/**
 * Chat session table row type
 */
export interface ChatSessionRow {
  id: string;
  tenant_id: string;
  title: string | null;
  user_context: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Chat session insert type (for creating new sessions)
 */
export interface ChatSessionInsert {
  id?: string;
  tenant_id?: string;
  title?: string | null;
  user_context?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Chat session update type (for updating existing sessions)
 */
export interface ChatSessionUpdate {
  id?: string;
  tenant_id?: string;
  title?: string | null;
  user_context?: Record<string, unknown> | null;
  updated_at?: string;
}

/**
 * Chat message table row type
 */
export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  chunk_ids: string[] | null;
  error: boolean;
  created_at: string;
}

/**
 * Chat message insert type (for creating new messages)
 */
export interface ChatMessageInsert {
  id?: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  chunk_ids?: string[] | null;
  error?: boolean;
  created_at?: string;
}

/**
 * Chat message update type (for updating existing messages)
 */
export interface ChatMessageUpdate {
  id?: string;
  session_id?: string;
  role?: 'user' | 'assistant';
  content?: string;
  chunk_ids?: string[] | null;
  error?: boolean;
}

