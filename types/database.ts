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

