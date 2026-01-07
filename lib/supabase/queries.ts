/**
 * Database query helpers
 * Provides typed helper functions for common database operations
 */

import { getSupabaseServerClient } from './client';
import type { DocumentInsert, ChunkInsert, ChunkRow, DocumentRow } from '@/types/database';
import type { Document, DocumentChunk, ChunkMetadata } from '@/types/domain';

/**
 * Convert database row to domain Document
 */
const rowToDocument = (row: DocumentRow): Document => ({
  id: row.id,
  tenantId: row.tenant_id,
  sourcePath: row.source_path,
  name: row.name,
  contentType: row.content_type,
  uploadedAt: new Date(row.uploaded_at),
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

/**
 * Convert database row to domain DocumentChunk
 */
const rowToChunk = (row: ChunkRow): DocumentChunk => ({
  id: row.id,
  tenantId: row.tenant_id,
  documentId: row.document_id,
  chunkText: row.chunk_text,
  chunkMetadata: (row.chunk_metadata || {}) as ChunkMetadata,
  contentType: row.content_type,
  embedding: row.embedding,
  createdAt: new Date(row.created_at),
});

/**
 * Convert domain Document to database insert
 */
const documentToInsert = (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): DocumentInsert => ({
  tenant_id: doc.tenantId,
  source_path: doc.sourcePath,
  name: doc.name,
  content_type: doc.contentType,
  uploaded_at: doc.uploadedAt.toISOString(),
});

/**
 * Convert domain DocumentChunk to database insert
 */
const chunkToInsert = (chunk: Omit<DocumentChunk, 'id' | 'createdAt'>): ChunkInsert => ({
  tenant_id: chunk.tenantId,
  document_id: chunk.documentId,
  chunk_text: chunk.chunkText,
  chunk_metadata: chunk.chunkMetadata,
  content_type: chunk.contentType,
  embedding: chunk.embedding,
});

/**
 * Create a new document
 */
export const createDocument = async (
  document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Document> => {
  const supabase = getSupabaseServerClient();
  const insert = documentToInsert(document);

  const { data, error } = await supabase.from('documents').insert(insert).select().single();

  if (error) {
    throw new Error(`Failed to create document: ${error.message}`);
  }

  return rowToDocument(data);
};

/**
 * Get document by ID
 */
export const getDocumentById = async (id: string): Promise<Document | null> => {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get document: ${error.message}`);
  }

  return data ? rowToDocument(data) : null;
};

/**
 * Get all documents for a tenant
 */
export const getDocumentsByTenant = async (tenantId: string): Promise<Document[]> => {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get documents: ${error.message}`);
  }

  return data ? data.map(rowToDocument) : [];
};

/**
 * Create a new chunk
 */
export const createChunk = async (chunk: Omit<DocumentChunk, 'id' | 'createdAt'>): Promise<DocumentChunk> => {
  const supabase = getSupabaseServerClient();
  const insert = chunkToInsert(chunk);

  const { data, error } = await supabase.from('chunks').insert(insert).select().single();

  if (error) {
    throw new Error(`Failed to create chunk: ${error.message}`);
  }

  return rowToChunk(data);
};

/**
 * Create multiple chunks in a batch
 */
export const createChunks = async (
  chunks: Array<Omit<DocumentChunk, 'id' | 'createdAt'>>
): Promise<DocumentChunk[]> => {
  const supabase = getSupabaseServerClient();
  const inserts = chunks.map(chunkToInsert);

  const { data, error } = await supabase.from('chunks').insert(inserts).select();

  if (error) {
    throw new Error(`Failed to create chunks: ${error.message}`);
  }

  return data ? data.map(rowToChunk) : [];
};

/**
 * Get chunk by ID
 */
export const getChunkById = async (id: string): Promise<DocumentChunk | null> => {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.from('chunks').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get chunk: ${error.message}`);
  }

  return data ? rowToChunk(data) : null;
};

/**
 * Get chunks by document ID
 */
export const getChunksByDocumentId = async (documentId: string): Promise<DocumentChunk[]> => {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('chunks')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get chunks: ${error.message}`);
  }

  return data ? data.map(rowToChunk) : [];
};

/**
 * Get chunks by IDs
 */
export const getChunksByIds = async (ids: string[]): Promise<DocumentChunk[]> => {
  if (ids.length === 0) {
    return [];
  }

  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.from('chunks').select('*').in('id', ids);

  if (error) {
    throw new Error(`Failed to get chunks: ${error.message}`);
  }

  return data ? data.map(rowToChunk) : [];
};

/**
 * Delete document and all its chunks (cascade)
 */
export const deleteDocument = async (id: string): Promise<void> => {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.from('documents').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
};

/**
 * Delete chunks by document ID
 */
export const deleteChunksByDocumentId = async (documentId: string): Promise<void> => {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.from('chunks').delete().eq('document_id', documentId);

  if (error) {
    throw new Error(`Failed to delete chunks: ${error.message}`);
  }
};

