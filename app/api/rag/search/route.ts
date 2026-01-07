/**
 * RAG Search API endpoint
 * Handles hybrid search requests combining keyword and vector search
 */

import { NextRequest, NextResponse } from 'next/server';
import { search } from '@/lib/rag/search';
import type { SearchRequest, ApiError } from '@/types/domain';

/**
 * POST /api/rag/search
 * Performs hybrid search (keyword + vector) on document chunks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.tenant_id || typeof body.tenant_id !== 'string') {
      const error: ApiError = {
        error: 'ValidationError',
        message: 'tenant_id is required and must be a string',
      };
      return NextResponse.json(error, { status: 400 });
    }

    if (!body.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
      const error: ApiError = {
        error: 'ValidationError',
        message: 'query is required and must be a non-empty string',
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Build search request
    const searchRequest: SearchRequest = {
      tenantId: body.tenant_id,
      userContext: body.user_context,
      query: body.query.trim(),
      k: body.k && typeof body.k === 'number' && body.k > 0 ? body.k : 8,
      filters: body.filters,
    };

    // Perform search
    const searchResponse = await search(searchRequest);

    return NextResponse.json(searchResponse, { status: 200 });
  } catch (error) {
    console.error('RAG search error:', error);

    const apiError: ApiError = {
      error: 'SearchError',
      message: error instanceof Error ? error.message : 'An unknown error occurred during search',
      details: error instanceof Error ? { stack: error.stack } : undefined,
    };

    return NextResponse.json(apiError, { status: 500 });
  }
}

/**
 * GET /api/rag/search
 * Health check endpoint (optional)
 */
export async function GET() {
  return NextResponse.json(
    {
      service: 'RAG Search API',
      status: 'operational',
      endpoints: {
        POST: '/api/rag/search - Perform hybrid search',
      },
    },
    { status: 200 }
  );
}

