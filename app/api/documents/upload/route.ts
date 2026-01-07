/**
 * Document Upload API endpoint
 * Handles file uploads and ingestion
 */

import { NextRequest, NextResponse } from 'next/server';
import { chunkMultipleTexts } from '@/lib/ingestion/chunking';
import { generateEmbeddings } from '@/lib/ingestion/embeddings';
import { createDocument, createChunks, getDocumentsByTenant } from '@/lib/supabase/queries';
import { getContentType } from '@/lib/ingestion/content-type-config';
import type { Document, DocumentChunk } from '@/types/domain';
import type { ApiError } from '@/types/domain';

/**
 * Maximum file size (50MB)
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Supported file types
 */
const SUPPORTED_FILE_TYPES = ['.pdf', '.csv'] as const;

/**
 * Check if document already exists
 */
const documentExists = async (tenantId: string, fileName: string): Promise<boolean> => {
  try {
    const documents = await getDocumentsByTenant(tenantId);
    return documents.some((doc) => doc.name === fileName);
  } catch {
    return false;
  }
};

/**
 * Process uploaded file buffer
 */
const processFileBuffer = async (
  fileBuffer: Buffer,
  fileName: string,
  tenantId: string
): Promise<{ document: Document; chunks: Omit<DocumentChunk, 'id' | 'createdAt'>[] }> => {
  const extension = fileName.toLowerCase().endsWith('.pdf') ? '.pdf' : '.csv';
  const contentType = getContentType(fileName, extension);

  // Check if document already exists
  const exists = await documentExists(tenantId, fileName);
  if (exists) {
    throw new Error(`Document "${fileName}" already exists`);
  }

  let parsedData: { pages?: Array<{ text: string; metadata: unknown }>; rows?: Array<{ text: string; metadata: unknown }> };

  if (extension === '.pdf') {
    // Parse PDF from buffer
    // pdfjs-dist can work with ArrayBuffer, so we convert Buffer to ArrayBuffer
    const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
    
    // Use pdfjs-dist directly since we have the buffer
    const pdfjsLib = await import('pdfjs-dist');
    if (typeof window === 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
    });

    const pdfDocument = await loadingTask.promise;
    const totalPages = pdfDocument.numPages;
    const pages: Array<{ text: string; metadata: unknown }> = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .trim();

      if (pageText) {
        pages.push({
          text: pageText,
          metadata: {
            pageNumber: pageNum,
            fileName,
            sourceLocation: `uploaded/${fileName}`,
          },
        });
      }
    }

    parsedData = { pages };
  } else {
    // Parse CSV from buffer
    const csvContent = fileBuffer.toString('utf-8');
    const { parse } = await import('csv-parse/sync');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (!Array.isArray(records) || records.length === 0) {
      throw new Error(`CSV file ${fileName} is empty or has no valid rows`);
    }

    const columnNames = Object.keys(records[0] || {});
    parsedData = {
      rows: records.map((record, i) => ({
        text: Object.entries(record)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n'),
        metadata: {
          rowIndex: i + 1,
          columnNames,
          fileName,
          sourceLocation: `uploaded/${fileName}`,
        },
      })),
    };
  }

  // Chunk the text
  const textItems = parsedData.pages || parsedData.rows || [];
  const textChunks = chunkMultipleTexts(textItems);

  // Generate embeddings
  const chunkTexts = textChunks.map((chunk) => chunk.text);
  const embeddings = await generateEmbeddings(chunkTexts);

  // Create document
  const document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'> = {
    tenantId,
    sourcePath: `uploaded/${fileName}`,
    name: fileName,
    contentType,
    uploadedAt: new Date(),
  };

  const createdDocument = await createDocument(document);

  // Create chunks
  const chunks: Omit<DocumentChunk, 'id' | 'createdAt'>[] = textChunks.map((chunk, index) => ({
    tenantId,
    documentId: createdDocument.id,
    chunkText: chunk.text,
    chunkMetadata: chunk.metadata,
    contentType,
    embedding: embeddings[index] || null,
  }));

  return { document: createdDocument, chunks };
};

/**
 * POST /api/documents/upload
 * Upload and ingest a document
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const tenantId = (formData.get('tenant_id') as string) || process.env.TENANT_ID || 'default';

    if (!file) {
      const error: ApiError = {
        error: 'ValidationError',
        message: 'No file provided',
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const error: ApiError = {
        error: 'ValidationError',
        message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Validate file type
    const fileName = file.name;
    const extension = fileName.toLowerCase().endsWith('.pdf') ? '.pdf' : fileName.toLowerCase().endsWith('.csv') ? '.csv' : null;

    if (!extension || !SUPPORTED_FILE_TYPES.includes(extension)) {
      const error: ApiError = {
        error: 'ValidationError',
        message: `Unsupported file type. Supported types: ${SUPPORTED_FILE_TYPES.join(', ')}`,
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Process and ingest the file
    const result = await processFileBuffer(fileBuffer, fileName, tenantId);

    // Store chunks
    await createChunks(result.chunks);

    return NextResponse.json(
      {
        document: {
          id: result.document.id,
          name: result.document.name,
          contentType: result.document.contentType,
          uploadedAt: result.document.uploadedAt.toISOString(),
        },
        chunksCreated: result.chunks.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Document upload error:', error);

    const apiError: ApiError = {
      error: 'UploadError',
      message: error instanceof Error ? error.message : 'An unknown error occurred while uploading the document',
      details: error instanceof Error ? { stack: error.stack } : undefined,
    };

    return NextResponse.json(apiError, { status: 500 });
  }
}

