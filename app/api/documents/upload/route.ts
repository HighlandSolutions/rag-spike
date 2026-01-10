/**
 * Document Upload API endpoint
 * Handles file uploads and ingestion
 */

import { NextRequest, NextResponse } from 'next/server';
import { chunkMultipleTexts, type ChunkingConfig } from '@/lib/ingestion/chunking';
import { generateEmbeddings } from '@/lib/ingestion/embeddings';
import { createDocument, createChunks, getDocumentsByTenant } from '@/lib/supabase/queries';
import { getContentType } from '@/lib/ingestion/content-type-config';
import type { Document, DocumentChunk, ChunkMetadata } from '@/types/domain';
import type { ApiError } from '@/types/domain';

/**
 * Default tenant ID (must match the one used in chat/search)
 */
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'default-tenant';

/**
 * Maximum file size (50MB)
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Supported file types
 */
const SUPPORTED_FILE_TYPES = ['.pdf', '.csv', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'] as const;

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
  // Determine file extension
  const lowerFileName = fileName.toLowerCase();
  let extension: string | null = null;
  if (lowerFileName.endsWith('.pdf')) extension = '.pdf';
  else if (lowerFileName.endsWith('.csv')) extension = '.csv';
  else if (lowerFileName.endsWith('.docx')) extension = '.docx';
  else if (lowerFileName.endsWith('.doc')) extension = '.doc';
  else if (lowerFileName.endsWith('.xlsx')) extension = '.xlsx';
  else if (lowerFileName.endsWith('.xls')) extension = '.xls';
  else if (lowerFileName.endsWith('.pptx')) extension = '.pptx';
  else if (lowerFileName.endsWith('.ppt')) extension = '.ppt';

  if (!extension) {
    throw new Error(`Unsupported file type: ${fileName}`);
  }

  const contentType = getContentType(fileName, extension);

  // Check if document already exists
  const exists = await documentExists(tenantId, fileName);
  if (exists) {
    throw new Error(`Document "${fileName}" already exists`);
  }

  let parsedData: {
    pages?: Array<{ text: string; metadata: ChunkMetadata }>;
    rows?: Array<{ text: string; metadata: ChunkMetadata }>;
    sections?: Array<{ text: string; metadata: ChunkMetadata }>;
    slides?: Array<{ text: string; metadata: ChunkMetadata }>;
  };

  if (extension === '.pdf') {
    // Parse PDF from buffer
    // pdfjs-dist can work with ArrayBuffer, so we convert Buffer to ArrayBuffer
    const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength) as ArrayBuffer;
    
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
    const pages: Array<{ text: string; metadata: ChunkMetadata }> = [];

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
          } as ChunkMetadata,
        });
      }
    }

    parsedData = { pages };
  } else if (extension === '.csv') {
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
        } as ChunkMetadata,
      })),
    };
  } else if (extension === '.docx' || extension === '.doc') {
    // Parse Word document from buffer
    // Note: .doc (old format) is not supported by mammoth, only .docx
    if (extension === '.doc') {
      throw new Error('Legacy .doc format is not supported. Please convert to .docx format.');
    }

    const mammoth = await import('mammoth');
    const result = await mammoth.default.extractRawText({ buffer: fileBuffer });
    const fullText = result.value.trim();

    if (!fullText) {
      throw new Error(`Word document ${fileName} appears to be empty or contains no extractable text`);
    }

    // Split text into sections by paragraphs
    const paragraphs = fullText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    parsedData = {
      sections: paragraphs.map((paragraph, index) => ({
        text: paragraph.trim(),
        metadata: {
          sectionIndex: index + 1,
          fileName,
          sourceLocation: `uploaded/${fileName}`,
        } as ChunkMetadata,
      })),
    };
  } else if (extension === '.xlsx' || extension === '.xls') {
    // Parse Excel from buffer
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error(`Excel file ${fileName} contains no sheets`);
    }

    const rows: Array<{ text: string; metadata: ChunkMetadata }> = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        continue;
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as unknown[][];

      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        continue;
      }

      const headers = (jsonData[0] || []).map((cell) => String(cell || '').trim()).filter((h) => h);

      for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex++) {
        const row = jsonData[rowIndex];
        if (!Array.isArray(row)) {
          continue;
        }

        const rowText = row
          .map((cell, colIndex) => {
            const header = headers[colIndex] || `Column${colIndex + 1}`;
            const value = String(cell || '').trim();
            return value ? `${header}: ${value}` : null;
          })
          .filter((item) => item !== null)
          .join('\n');

        if (rowText.trim()) {
          rows.push({
            text: rowText,
            metadata: {
              sheetName,
              rowIndex: rowIndex + 1,
              columnNames: headers,
              fileName,
              sourceLocation: `uploaded/${fileName}`,
            } as ChunkMetadata,
          });
        }
      }
    }

    if (rows.length === 0) {
      throw new Error(`Excel file ${fileName} contains no data rows`);
    }

    parsedData = { rows };
  } else if (extension === '.pptx' || extension === '.ppt') {
    // Parse PowerPoint from buffer
    // Note: .ppt (old format) is not supported, only .pptx
    if (extension === '.ppt') {
      throw new Error('Legacy .ppt format is not supported. Please convert to .pptx format.');
    }

    const PPTX2Json = (await import('pptx2json')).default;
    const pptx2json = new PPTX2Json();
    const json = await pptx2json.buffer2json(fileBuffer);

    if (!json || typeof json !== 'object') {
      throw new Error(`PowerPoint file ${fileName} could not be parsed`);
    }

    // Extract text from slides
    const extractTextFromSlideJson = (slideJson: unknown): string => {
      if (!slideJson || typeof slideJson !== 'object') {
        return '';
      }

      const textParts: string[] = [];
      const extractText = (obj: unknown): void => {
        if (typeof obj === 'string') {
          const cleaned = obj
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .trim();
          if (cleaned) {
            textParts.push(cleaned);
          }
        } else if (Array.isArray(obj)) {
          obj.forEach((item) => extractText(item));
        } else if (obj && typeof obj === 'object') {
          Object.values(obj).forEach((value) => extractText(value));
        }
      };

      extractText(slideJson);
      return textParts.join(' ').trim();
    };

    const slidePaths = Object.keys(json).filter((path) => 
      path.startsWith('ppt/slides/slide') && path.endsWith('.xml')
    );

    slidePaths.sort((a, b) => {
      const aNum = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      const bNum = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      return aNum - bNum;
    });

    const slides: Array<{ text: string; metadata: ChunkMetadata }> = [];
    for (let i = 0; i < slidePaths.length; i++) {
      const slidePath = slidePaths[i];
      const slideJson = (json as Record<string, unknown>)[slidePath];
      const slideText = extractTextFromSlideJson(slideJson);

      if (slideText) {
        slides.push({
          text: slideText,
          metadata: {
            slideNumber: i + 1,
            fileName,
            sourceLocation: `uploaded/${fileName}`,
          } as ChunkMetadata,
        });
      }
    }

    if (slides.length === 0) {
      throw new Error(`PowerPoint file ${fileName} contains no extractable text`);
    }

    parsedData = { slides };
  } else {
    throw new Error(`Unsupported file type: ${extension}`);
  }

  // Chunk the text
  const textItems = parsedData.pages || parsedData.rows || parsedData.sections || parsedData.slides || [];
  const chunkingConfig: ChunkingConfig = {
    chunkSize: 2000,
    overlap: 200,
    useSemanticChunking: process.env.USE_SEMANTIC_CHUNKING === 'true',
  };
  const textChunks = await chunkMultipleTexts(textItems, chunkingConfig);

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
    const tenantId = (formData.get('tenant_id') as string) || DEFAULT_TENANT_ID;

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
    const lowerFileName = fileName.toLowerCase();
    let extension: string | null = null;
    if (lowerFileName.endsWith('.pdf')) extension = '.pdf';
    else if (lowerFileName.endsWith('.csv')) extension = '.csv';
    else if (lowerFileName.endsWith('.docx')) extension = '.docx';
    else if (lowerFileName.endsWith('.doc')) extension = '.doc';
    else if (lowerFileName.endsWith('.xlsx')) extension = '.xlsx';
    else if (lowerFileName.endsWith('.xls')) extension = '.xls';
    else if (lowerFileName.endsWith('.pptx')) extension = '.pptx';
    else if (lowerFileName.endsWith('.ppt')) extension = '.ppt';

    if (!extension || !SUPPORTED_FILE_TYPES.includes(extension as typeof SUPPORTED_FILE_TYPES[number])) {
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

