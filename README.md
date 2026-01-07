# RAG Q&A Application

A Perplexity-style Q&A application with RAG (Retrieval-Augmented Generation) capabilities. This application allows users to ask questions and receive AI-powered answers with citations from your knowledge base.

## Project Status

- Phase 0-8: ✅ Complete
- Phase 9: Deployment & Monitoring - ✅ Complete (excluding Sentry and custom domain)

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 3.4.17 (Note: v4 not yet available, using latest stable)
- **UI Components**: shadcn/ui
- **Database**: Supabase (with pgvector)
- **Testing**: Jest, React Testing Library, Playwright

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (for database)
- LLM API key (OpenAI, Anthropic, or Together AI)
- Embeddings API key (OpenAI, Cohere, or self-hosted)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
rag-spike/
├── app/              # Next.js app directory
├── components/       # React components
├── lib/             # Utility functions
├── types/           # TypeScript type definitions
├── scripts/         # CLI scripts (e.g., ingestion)
├── content/         # Content files for ingestion
└── e2e/             # End-to-end tests
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production (test locally before deploying)
- `npm run start` - Start production server locally
- `npm run lint` - Run ESLint
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run ingest` - Run document ingestion CLI (see [Ingestion Process](#ingestion-process) below)

## Ingestion Process

The application uses a CLI script to ingest documents (PDFs and CSVs) into the knowledge base.

### Basic Usage

```bash
npm run ingest
```

This will:
1. Discover all PDF and CSV files in the `/content` directory
2. Parse and chunk each document
3. Generate embeddings for each chunk
4. Store chunks in Supabase

### Advanced Options

```bash
# Specify a custom content directory
npm run ingest -- --content-dir=/path/to/content

# Specify a tenant ID
npm run ingest -- --tenant-id=my-tenant

# Skip already-ingested documents (idempotent)
npm run ingest -- --skip-existing

# Use a custom content type configuration
npm run ingest -- --content-type-config=/path/to/config.json
```

### Content Directory Structure

Place your documents in the `content/` directory:

```
content/
├── policies/
│   ├── policy1.pdf
│   └── policy2.pdf
├── learning/
│   └── training.csv
└── ...
```

### Content Type Configuration

You can configure content types and metadata by creating a `content-type-config.json` file:

```json
{
  "policies": {
    "contentType": "policies",
    "metadata": {
      "category": "legal"
    }
  },
  "learning_content": {
    "contentType": "learning_content",
    "metadata": {
      "category": "education"
    }
  }
}
```

See `content/content-type-config.example.json` for a complete example.

### Ingestion Process Details

1. **File Discovery**: Scans the content directory for `.pdf` and `.csv` files
2. **Parsing**:
   - PDFs: Extracts text per page with page numbers
   - CSVs: Parses rows with column metadata
3. **Chunking**: Splits text into ~500-1000 token chunks with 50-100 token overlap
4. **Embedding Generation**: Creates vector embeddings for semantic search
5. **Storage**: Stores chunks in Supabase with metadata and embeddings

### Monitoring Ingestion

The ingestion script provides detailed progress output:
- Files processed/skipped/failed
- Chunks created
- Token counts
- Error details (if any)

## Deployment

### Pre-Deployment Checklist

1. ✅ Test production build locally: `npm run build`
2. ✅ Verify all environment variables are set
3. ✅ Test ingestion process with sample documents
4. ✅ Verify database connection and migrations

### Deploying to Vercel

1. **Connect Repository**:
   - Push your code to GitHub
   - Import the repository in Vercel

2. **Configure Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add all required variables from `.env.example`
   - Set `NODE_ENV=production`

3. **Deploy**:
   - Vercel will automatically deploy on push to main
   - Or trigger a manual deployment from the dashboard

4. **Verify Deployment**:
   - Check the deployment logs for errors
   - Test the production URL
   - Verify API endpoints are working

### Build Settings

The project uses Next.js 15 with default build settings. No special configuration is required.

### Monitoring

The application includes structured logging for:
- **API Usage**: Tracks LLM and embeddings API calls with token counts and estimated costs
- **Errors**: Logs errors with context for debugging
- **Performance**: Tracks query times and operation durations

Logs are output in JSON format for easy parsing and integration with log aggregation services.

### Cost Monitoring

API usage is logged with:
- Service name (e.g., 'openai')
- Operation type (e.g., 'chat_completion', 'embeddings')
- Token counts
- Estimated costs (based on current pricing)
- Duration and metadata

Monitor these logs to track usage and costs. For production, consider integrating with a log aggregation service.

## Environment Variables

The following environment variables are required for the application to function:

### Required Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI Configuration (for LLM and Embeddings)
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini  # Optional, defaults to gpt-4o-mini
OPENAI_EMBEDDINGS_MODEL=text-embedding-3-small  # Optional, defaults to text-embedding-3-small

# Application Configuration
DEFAULT_TENANT_ID=default-tenant  # Optional, defaults to 'default-tenant'
NODE_ENV=development  # or 'production'
```

### Getting Your Keys

1. **Supabase**: 
   - Create a project at [supabase.com](https://supabase.com)
   - Get your keys from Project Settings → API
   - Enable the `pgvector` extension in your database

2. **OpenAI**:
   - Sign up at [platform.openai.com](https://platform.openai.com)
   - Create an API key in your account settings
   - The same key works for both LLM and embeddings

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Fill in all required variables in `.env`

3. For production deployment, set these variables in your hosting platform (e.g., Vercel)

## Documentation

- [Architecture](./docs/architecture.md)
- [Implementation Plan](./docs/plan.md)
- [PRD](./docs/PRD.md)
