/**
 * Document API endpoint
 * Handles individual document operations (delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteDocument, deleteChunksByDocumentId, getDocumentById } from '@/lib/supabase/queries';
import type { ApiError } from '@/types/domain';

/**
 * DELETE /api/documents/[id]
 * Delete a document and all its chunks
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!id) {
      const error: ApiError = {
        error: 'ValidationError',
        message: 'Document ID is required',
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Check if document exists
    const document = await getDocumentById(id);
    if (!document) {
      const error: ApiError = {
        error: 'NotFoundError',
        message: `Document with ID ${id} not found`,
      };
      return NextResponse.json(error, { status: 404 });
    }

    // Delete chunks first (cascade should handle this, but being explicit)
    await deleteChunksByDocumentId(id);

    // Delete document
    await deleteDocument(id);

    return NextResponse.json({ success: true, message: 'Document deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Document delete error:', error);

    const apiError: ApiError = {
      error: 'DeleteError',
      message: error instanceof Error ? error.message : 'An unknown error occurred while deleting the document',
      details: error instanceof Error ? { stack: error.stack } : undefined,
    };

    return NextResponse.json(apiError, { status: 500 });
  }
}

/**
 * GET /api/documents/[id]
 * Get a single document by ID
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!id) {
      const error: ApiError = {
        error: 'ValidationError',
        message: 'Document ID is required',
      };
      return NextResponse.json(error, { status: 400 });
    }

    const document = await getDocumentById(id);

    if (!document) {
      const error: ApiError = {
        error: 'NotFoundError',
        message: `Document with ID ${id} not found`,
      };
      return NextResponse.json(error, { status: 404 });
    }

    return NextResponse.json(
      {
        document: {
          id: document.id,
          name: document.name,
          contentType: document.contentType,
          uploadedAt: document.uploadedAt.toISOString(),
          createdAt: document.createdAt.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Document get error:', error);

    const apiError: ApiError = {
      error: 'GetError',
      message: error instanceof Error ? error.message : 'An unknown error occurred while fetching the document',
      details: error instanceof Error ? { stack: error.stack } : undefined,
    };

    return NextResponse.json(apiError, { status: 500 });
  }
}




