/**
 * Document Ingestion CLI Script
 * 
 * Usage: npm run ingest [-- --tenant-id=<tenant>] [-- --content-dir=<dir>]
 * 
 * This script:
 * 1. Discovers PDF and CSV files in the content directory
 * 2. Parses and chunks documents
 * 3. Generates embeddings for each chunk
 * 4. Stores chunks in Supabase
 */

import { discoverFiles, validateFile, getContentTypeFromFile, type DiscoveredFile } from '@/lib/ingestion/file-discovery';
import { parsePdf } from '@/lib/ingestion/pdf-parser';
import { parseCsv } from '@/lib/ingestion/csv-parser';
import { chunkMultipleTexts, estimateTokenCount, type ChunkingConfig } from '@/lib/ingestion/chunking';
import { generateEmbeddings } from '@/lib/ingestion/embeddings';
import { createDocument, getDocumentsByTenant, createChunks } from '@/lib/supabase/queries';
import { testDatabaseConnection } from '@/lib/supabase/client';
import { loadContentTypeConfig, type ContentTypeConfig } from '@/lib/ingestion/content-type-config';
import type { Document, DocumentChunk, ChunkMetadata } from '@/types/domain';
import { join } from 'path';

/**
 * Ingestion configuration
 */
interface IngestionConfig {
  contentDir: string;
  tenantId: string;
  skipExisting: boolean;
  contentTypeConfigPath?: string;
  contentTypeConfig?: ContentTypeConfig;
  useSemanticChunking?: boolean;
  chunkingConfig?: ChunkingConfig;
}

/**
 * Ingestion statistics
 */
interface IngestionStats {
  filesProcessed: number;
  filesSkipped: number;
  filesFailed: number;
  documentsCreated: number;
  chunksCreated: number;
  errors: Array<{ file: string; error: string }>;
}

/**
 * Parse command line arguments
 */
const parseArgs = (): IngestionConfig => {
  const args = process.argv.slice(2);
  const config: IngestionConfig = {
    contentDir: join(process.cwd(), 'content'),
    tenantId: process.env.TENANT_ID || 'default',
    skipExisting: true,
  };

  for (const arg of args) {
    if (arg.startsWith('--tenant-id=')) {
      const tenantId = arg.split('=')[1];
      if (!tenantId || tenantId.trim() === '') {
        throw new Error('--tenant-id cannot be empty. Please provide a valid tenant ID.');
      }
      config.tenantId = tenantId.trim();
    } else if (arg.startsWith('--content-dir=')) {
      config.contentDir = arg.split('=')[1] || config.contentDir;
    } else if (arg.startsWith('--content-type-config=')) {
      config.contentTypeConfigPath = arg.split('=')[1];
    } else if (arg === '--no-skip-existing') {
      config.skipExisting = false;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Document Ingestion CLI

Usage: npm run ingest [options]

Options:
  --tenant-id=<id>              Tenant ID (required, or set TENANT_ID env var)
  --content-dir=<path>          Content directory (default: ./content)
  --content-type-config=<path>  Path to content type configuration JSON file
  --no-skip-existing           Re-ingest files that were already processed
  --help, -h                    Show this help message

Environment Variables:
  TENANT_ID                     Default tenant ID (if --tenant-id not provided)

Content Type Configuration:
  Create a JSON file to customize content type mapping:
  {
    "defaultContentType": "all",
    "fileExtensionMap": {
      ".pdf": "policies",
      ".csv": "learning_content"
    },
    "rules": [
      {
        "pattern": "policy",
        "contentType": "policies"
      }
    ]
  }
`);
      process.exit(0);
    }
  }

  // Validate tenant ID
  if (!config.tenantId || config.tenantId.trim() === '') {
    console.error('❌ Error: Tenant ID is required.');
    console.error('   Provide it via --tenant-id=<id> or set TENANT_ID environment variable.');
    process.exit(1);
  }

  return config;
};

/**
 * Check if document already exists
 */
const documentExists = async (tenantId: string, sourcePath: string): Promise<boolean> => {
  try {
    const documents = await getDocumentsByTenant(tenantId);
    return documents.some((doc) => doc.sourcePath === sourcePath);
  } catch (error) {
    // If we can't check, assume it doesn't exist
    return false;
  }
};

/**
 * Process a PDF file
 */
const processPdfFile = async (
  file: DiscoveredFile,
  tenantId: string,
  contentType: string,
  contentTypeConfig?: ContentTypeConfig
): Promise<{ document: Document; chunks: Omit<DocumentChunk, 'id' | 'createdAt'>[] }> => {
  console.log(`  Parsing PDF: ${file.name}...`);
  const parsedPdf = await parsePdf(file.path, file.name);

  console.log(`  Extracted ${parsedPdf.totalPages} pages`);

  // Convert pages to text chunks
  const pageTexts = parsedPdf.pages.map((page) => ({
    text: page.text,
    metadata: page.metadata,
  }));

  console.log(`  Chunking text...`);
  const chunkingConfig: ChunkingConfig = {
    chunkSize: 2000,
    overlap: 200,
    useSemanticChunking: process.env.USE_SEMANTIC_CHUNKING === 'true',
  };
  const textChunks = await chunkMultipleTexts(pageTexts, chunkingConfig);

  console.log(`  Created ${textChunks.length} chunks`);

  // Generate embeddings
  console.log(`  Generating embeddings...`);
  const chunkTexts = textChunks.map((chunk) => chunk.text);
  const embeddings = await generateEmbeddings(chunkTexts);

  // Create document
  const document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'> = {
    tenantId,
    sourcePath: file.path,
    name: file.name,
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
 * Process a CSV file
 */
const processCsvFile = async (
  file: DiscoveredFile,
  tenantId: string,
  contentType: string,
  contentTypeConfig?: ContentTypeConfig
): Promise<{ document: Document; chunks: Omit<DocumentChunk, 'id' | 'createdAt'>[] }> => {
  console.log(`  Parsing CSV: ${file.name}...`);
  const parsedCsv = await parseCsv(file.path, file.name);

  console.log(`  Extracted ${parsedCsv.totalRows} rows`);

  // Convert rows to text chunks
  const rowTexts = parsedCsv.rows.map((row) => ({
    text: row.text,
    metadata: row.metadata,
  }));

  console.log(`  Chunking text...`);
  const chunkingConfig: ChunkingConfig = {
    chunkSize: 2000,
    overlap: 200,
    useSemanticChunking: process.env.USE_SEMANTIC_CHUNKING === 'true',
  };
  const textChunks = await chunkMultipleTexts(rowTexts, chunkingConfig);

  console.log(`  Created ${textChunks.length} chunks`);

  // Generate embeddings
  console.log(`  Generating embeddings...`);
  const chunkTexts = textChunks.map((chunk) => chunk.text);
  const embeddings = await generateEmbeddings(chunkTexts);

  // Create document
  const document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'> = {
    tenantId,
    sourcePath: file.path,
    name: file.name,
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
 * Process a single file
 */
const processFile = async (
  file: DiscoveredFile,
  config: IngestionConfig
): Promise<{ document: Document; chunks: Omit<DocumentChunk, 'id' | 'createdAt'>[] } | null> => {
  const validation = validateFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error || 'File validation failed');
  }

  const contentType = getContentTypeFromFile(file, config.contentTypeConfig);

  // Check if document already exists (idempotency)
  if (config.skipExisting) {
    const exists = await documentExists(config.tenantId, file.path);
    if (exists) {
      console.log(`  ⏭️  Skipping ${file.name} (already ingested)`);
      return null;
    }
  }

  switch (file.type) {
    case '.pdf':
      return processPdfFile(file, config.tenantId, contentType, config.contentTypeConfig);
    case '.csv':
      return processCsvFile(file, config.tenantId, contentType, config.contentTypeConfig);
    default:
      throw new Error(`Unsupported file type: ${file.type}`);
  }
};

/**
 * Main ingestion function
 */
const ingest = async (): Promise<void> => {
  console.log('🚀 Starting document ingestion...\n');

  const config = parseArgs();

  // Load content type configuration
  if (config.contentTypeConfigPath) {
    console.log(`Loading content type configuration from ${config.contentTypeConfigPath}...`);
    config.contentTypeConfig = await loadContentTypeConfig(config.contentTypeConfigPath);
    console.log('✅ Content type configuration loaded\n');
  } else {
    config.contentTypeConfig = await loadContentTypeConfig();
  }

  console.log(`Configuration:`);
  console.log(`  Content directory: ${config.contentDir}`);
  console.log(`  Tenant ID: ${config.tenantId}`);
  console.log(`  Skip existing: ${config.skipExisting}`);
  if (config.contentTypeConfigPath) {
    console.log(`  Content type config: ${config.contentTypeConfigPath}`);
  }
  console.log('');

  // Test database connection
  console.log('Testing database connection...');
  try {
    await testDatabaseConnection();
    console.log('✅ Database connection successful\n');
  } catch (error) {
    console.error('❌ Database connection failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  // Discover files
  console.log('Discovering files...');
  let files: DiscoveredFile[];
  try {
    files = await discoverFiles(config.contentDir);
    console.log(`Found ${files.length} file(s)\n`);
  } catch (error) {
    console.error('❌ Failed to discover files:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('No files to process. Exiting.');
    return;
  }

  // Process files
  const stats: IngestionStats = {
    filesProcessed: 0,
    filesSkipped: 0,
    filesFailed: 0,
    documentsCreated: 0,
    chunksCreated: 0,
    errors: [],
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`[${i + 1}/${files.length}] Processing: ${file.name}`);

    try {
      const result = await processFile(file, config);

      if (result === null) {
        stats.filesSkipped++;
        console.log(`  ✅ Skipped\n`);
      } else {
        // Store chunks in database
        console.log(`  Storing ${result.chunks.length} chunks in database...`);
        await createChunks(result.chunks);

        stats.filesProcessed++;
        stats.documentsCreated++;
        stats.chunksCreated += result.chunks.length;

        const totalTokens = result.chunks.reduce((sum, chunk) => sum + estimateTokenCount(chunk.chunkText), 0);
        console.log(`  ✅ Successfully ingested (${result.chunks.length} chunks, ~${totalTokens} tokens)\n`);
      }
    } catch (error) {
      stats.filesFailed++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      stats.errors.push({ file: file.name, error: errorMessage });
      console.error(`  ❌ Failed: ${errorMessage}\n`);
    }
  }

  // Print summary
  console.log('📊 Ingestion Summary:');
  console.log(`  Files processed: ${stats.filesProcessed}`);
  console.log(`  Files skipped: ${stats.filesSkipped}`);
  console.log(`  Files failed: ${stats.filesFailed}`);
  console.log(`  Documents created: ${stats.documentsCreated}`);
  console.log(`  Chunks created: ${stats.chunksCreated}`);

  if (stats.errors.length > 0) {
    console.log(`\n❌ Errors encountered:`);
    for (const error of stats.errors) {
      console.log(`  - ${error.file}: ${error.error}`);
    }
  }

  if (stats.filesFailed > 0) {
    process.exit(1);
  }
};

// Run ingestion
ingest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

