/**
 * Citations metadata API endpoint
 * Fetches chunk metadata and document information for citation display
 */

import { NextRequest } from 'next/server';
import { getChunksByIds } from '@/lib/supabase/queries';
import { getDocumentById } from '@/lib/supabase/queries';
import type { ApiError } from '@/types/domain';

/**
 * GET /api/citations/metadata
 * Fetches chunk metadata by chunk IDs
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chunkIdsParam = searchParams.get('chunkIds');

    if (!chunkIdsParam) {
      const error: ApiError = {
        error: 'ValidationError',
        message: 'chunkIds query parameter is required',
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const chunkIds = chunkIdsParam.split(',').filter((id) => id.trim().length > 0);

    if (chunkIds.length === 0) {
      return new Response(JSON.stringify({ citations: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch chunks
    const chunks = await getChunksByIds(chunkIds);

    // Fetch documents for all unique document IDs
    const documentIds = [...new Set(chunks.map((chunk) => chunk.documentId))];
    const documents = await Promise.all(
      documentIds.map((docId) => getDocumentById(docId))
    );

    // Create a map of document ID to document
    const documentMap = new Map(
      documents.filter((doc): doc is NonNullable<typeof doc> => doc !== null).map((doc) => [doc.id, doc])
    );

    // Build citation metadata
    const citations = chunks.map((chunk) => {
      const document = documentMap.get(chunk.documentId);
      const metadata = chunk.chunkMetadata;

      // Extract location information
      const locationParts: string[] = [];
      if (metadata.pageNumber !== undefined) {
        locationParts.push(`Page ${metadata.pageNumber}`);
      }
      if (metadata.rowIndex !== undefined) {
        locationParts.push(`Row ${metadata.rowIndex + 1}`);
      }

      // Get document name
      const documentName = document?.name || metadata.fileName || 'Unknown Document';

      // Extract preview snippet (first 150 characters)
      const previewSnippet = chunk.chunkText.substring(0, 150).trim();
      const truncatedSnippet =
        chunk.chunkText.length > 150 ? `${previewSnippet}...` : previewSnippet;

      return {
        chunkId: chunk.id,
        documentName,
        location: locationParts.length > 0 ? locationParts.join(', ') : undefined,
        snippet: truncatedSnippet,
        contentType: chunk.contentType,
      };
    });

    return new Response(JSON.stringify({ citations }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Citations metadata error:', error);

    const apiError: ApiError = {
      error: 'CitationsError',
      message: error instanceof Error ? error.message : 'An unknown error occurred',
      details: error instanceof Error ? { stack: error.stack } : undefined,
    };

    return new Response(JSON.stringify(apiError), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

