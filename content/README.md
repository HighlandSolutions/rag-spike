# Content Directory

This directory contains the source documents to be ingested into the RAG system.

## Supported File Types

- **PDF** (`.pdf`) - Policy documents, guides, manuals
- **CSV** (`.csv`) - Structured data, learning content

## Usage

1. Place your PDF and CSV files in this directory
2. Run the ingestion script: `npm run ingest`
3. The script will:
   - Discover all supported files
   - Parse and chunk documents
   - Generate embeddings
   - Store in Supabase

## File Size Limits

- Maximum file size: 50MB per file
- Empty files will be skipped

## Content Type Mapping

Content types can be configured in several ways:

### Default Mapping
- PDF files → `policies`
- CSV files → `learning_content`

### Custom Configuration

Create a `content-type-config.json` file to customize mappings:

```json
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
    },
    {
      "pattern": "learning|training",
      "contentType": "learning_content"
    }
  ]
}
```

Then use it with:
```bash
npm run ingest -- --content-type-config=./content/content-type-config.json
```

See `content-type-config.example.json` for a complete example.

## Idempotency

The ingestion script skips files that have already been ingested (based on source path). To re-ingest a file, delete the corresponding document from the database first.

## Tenant ID

The tenant ID is **required** for ingestion. Provide it via:
- Command line: `npm run ingest -- --tenant-id=my-tenant`
- Environment variable: `TENANT_ID=my-tenant npm run ingest`

If not provided, the script will exit with an error.

