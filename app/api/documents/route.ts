/**
 * Documents API endpoint
 * Handles listing and uploading documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDocumentsByTenant } from '@/lib/supabase/queries';
import type { ApiError } from '@/types/domain';

/**
 * Default tenant ID (must match the one used in chat/search)
 */
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'default-tenant';

/**
 * GET /api/documents
 * List all documents for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id') || DEFAULT_TENANT_ID;

    const documents = await getDocumentsByTenant(tenantId);

    return NextResponse.json(
      {
        documents: documents.map((doc) => ({
          id: doc.id,
          name: doc.name,
          sourcePath: doc.sourcePath,
          contentType: doc.contentType,
          uploadedAt: doc.uploadedAt.toISOString(),
          createdAt: doc.createdAt.toISOString(),
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Documents list error:', error);

    const apiError: ApiError = {
      error: 'ListError',
      message: error instanceof Error ? error.message : 'An unknown error occurred while listing documents',
      details: error instanceof Error ? { stack: error.stack } : undefined,
    };

    return NextResponse.json(apiError, { status: 500 });
  }
}



