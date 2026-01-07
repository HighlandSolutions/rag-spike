# RAG Q&A Application - Implementation Plan

This plan breaks down the Perplexity-style Q&A application into iterative phases. Check off items as we complete them.

## Architecture Overview

### Core Components

1. **RAG Search API** (`/api/rag/search`)
   - Hybrid search: Keyword (full-text) + Vector (embeddings)
   - Simple API: `search(tenant_id, user_context, query, k, filters)`
   - Supports content type filtering (policies, learning_content, internal_roles, etc.)
   - Returns ranked chunks with scores

2. **Agent/Orchestrator Service** (`/api/agent/chat`)
   - Stateless HTTP service
   - Accepts: user question + metadata (role, level, target_job, learning_preferences)
   - Calls RAG with appropriate content filters
   - Composes structured prompts: user profile + retrieved snippets + tool outputs
   - Streams LLM responses back to frontend

3. **Embedding Service**
   - Hosted or self-hosted embeddings model
   - Generates embeddings for queries and documents
   - Supports batch processing

## Open Questions

- [ ] **LLM Provider**: Which LLM API should we use? (OpenAI, Anthropic, Together AI, etc.)
- [ ] **Embeddings Provider**: Which embeddings model? (OpenAI text-embedding-3-small, Cohere, etc.) - Hosted or self-hosted?
- [ ] **Authentication**: For PoC, do you want basic auth, or just skip auth entirely for now?
- [ ] **Streaming**: Should we implement streaming responses from the start, or start with full responses?
- [ ] **Content Directory**: Should `/content` be in the repo or gitignored? (for testing with sample docs)
- [ ] **Tenant Model**: Even for PoC, should we support tenant_id for future extensibility, or keep it single-tenant?
- [ ] **Content Categories**: What content types/categories should we support? (e.g., "policies", "learning_content", "internal_roles", etc.)
- [ ] **Tool Integration**: What tools/outputs should the agent support? (e.g., eligibility checks, calculations, etc.)

---

## Phase 0: Project Setup & Infrastructure

### Project Initialization
- [x] Initialize Next.js project with TypeScript
- [x] Set up Tailwind CSS v4 (Note: Using v3.4.19 - v4 not yet available)
- [x] Configure ESLint 9
- [x] Initialize Git repository
- [x] Set up npm scripts (dev, build, lint, test)
- [x] Create `.gitignore` and `.env.example`
- [x] Set up basic project structure (app/, components/, lib/, types/)

### Supabase Setup
- [x] Create Supabase project
- [x] Enable pgvector extension in Supabase
- [ ] Set up local Supabase CLI (optional, for local dev)
- [x] Document Supabase connection details

### Infrastructure Accounts
- [x] Set up GitHub repository
- [x] Configure Vercel project (connect to GitHub) - User will set up
- [ ] Set up Sentry project and integration - User will set up later
- [ ] Configure environment variables in Vercel

### Dependencies
- [x] Install Next.js, React, TypeScript
- [x] Install Tailwind CSS v4 and configure (Using v3.4.19)
- [x] Install shadcn/ui and initialize
- [x] Install Supabase client libraries
- [x] Install PDF parsing library (pdf-parse or pdfjs-dist)
- [x] Install CSV parsing library (csv-parse)
- [x] Install LLM SDK (OpenAI/Anthropic/etc.) with streaming support
- [x] Install embeddings SDK (hosted or self-hosted) - OpenAI recommended
- [x] Install full-text search utilities (if needed beyond PostgreSQL native)
- [x] Install testing libraries (Jest, React Testing Library, Playwright)

---

## Phase 1: Database Schema & Core Types

### Database Schema
- [x] Design `documents` table (id, tenant_id, source_path, name, content_type, uploaded_at, etc.)
- [x] Design `chunks` table (id, tenant_id, document_id, chunk_text, chunk_metadata, content_type, embedding vector, created_at)
- [x] Create migration for documents table
- [x] Create migration for chunks table with pgvector column
- [x] Create indexes on chunks:
  - [x] document_id index
  - [x] embedding vector similarity search index
  - [x] content_type index (for filtering)
  - [x] tenant_id index (for multi-tenant support)
  - [x] Full-text search index (for keyword search)
- [x] Set up Row Level Security (RLS) policies (basic for PoC, tenant-aware if needed)
- [x] Test database connection from Next.js

### TypeScript Types
- [x] Define `Document` type
- [x] Define `DocumentChunk` type
- [x] Define `ChunkMetadata` type
- [x] Define `UserContext` type (role, level, target_job, learning_preferences)
- [x] Define `SearchRequest` type (tenant_id, user_context, query, k, filters)
- [x] Define `SearchResponse` type (chunks, scores)
- [x] Define `ChatRequest` type (question, user_context, metadata)
- [x] Define API request/response types
- [x] Define database schema types (generate from Supabase or manual)

### Core Utilities
- [x] Create Supabase client utility
- [x] Create database query helpers
- [x] Create type guards and validators

---

## Phase 2: Document Ingestion Pipeline (CLI)

### File Reading
- [x] Create `/content` directory structure
- [x] Implement file discovery (scan directory for .pdf, .csv files)
- [x] Add file validation (size limits, type checking)

### PDF Parsing
- [x] Implement PDF text extraction (per page)
- [x] Handle PDF parsing errors gracefully
- [x] Extract metadata (page numbers, document name)

### CSV Parsing
- [x] Implement CSV parsing (per row/record)
- [x] Handle CSV parsing errors gracefully
- [x] Extract metadata (row index, column names, file name)

### Chunking Logic
- [x] Implement text chunking algorithm (~500-1000 tokens with 50-100 overlap)
- [x] Create token counting utility (approximate with character count)
- [x] Normalize chunks into `DocumentChunk` format
- [x] Preserve metadata (page/row, source path) in chunks
- [x] Assign content_type/category to chunks (based on document type or metadata)
- [x] Store tenant_id with chunks (for multi-tenant support)

### Ingestion CLI Script
- [x] Create `npm run ingest` script
- [x] Implement main ingestion flow:
  - [x] Read files from `/content`
  - [x] Parse and chunk documents
  - [x] Generate embeddings for each chunk
  - [x] Store chunks in Supabase
- [x] Add progress logging
- [x] Handle errors and partial failures
- [x] Add idempotency (skip already-ingested documents)

### Embeddings Integration
- [x] Set up embeddings API client
- [x] Implement batch embedding generation
- [x] Handle API rate limits and retries
- [x] Store embeddings as vectors in pgvector column

---

## Phase 3: Basic Chat UI

### UI Components (shadcn/ui)
- [x] Set up shadcn/ui components (Button, Input, Card, etc.)
- [x] Create ChatContainer component
- [x] Create MessageList component
- [x] Create MessageBubble component (user/assistant)
- [x] Create ChatInput component with placeholder
- [x] Create UserContextForm component (for role, level, target_job, learning_preferences)
- [x] Add basic styling with Tailwind CSS v4

### Chat State Management
- [x] Set up chat state (messages array)
- [x] Set up user context state (role, level, target_job, learning_preferences)
- [x] Implement message submission handler
- [x] Implement message display logic
- [x] Add loading states for pending responses
- [x] Handle streaming message updates

### User Context Collection
- [x] Create user profile/settings UI (optional, can be stored in localStorage)
- [x] Collect user metadata:
  - [x] Role (dropdown or input)
  - [x] Level (dropdown: junior, mid, senior, etc.)
  - [x] Target job (input)
  - [x] Learning preferences (multi-select or tags)
- [x] Store user context (localStorage or session)
- [x] Include user context in API requests

---

## Phase 4: RAG Search API & Hybrid Search

### RAG Search API (`/api/rag/search`)
- [x] Create RAG search API endpoint
- [x] Implement `search(tenant_id, user_context, query, k, filters)` function signature
- [x] Accept search parameters:
  - [x] tenant_id (for multi-tenant support)
  - [x] user_context (role, level, target_job, learning_preferences)
  - [x] query (user question)
  - [x] k (number of results, default 8)
  - [x] filters (content_type filters: "policies", "learning_content", "internal_roles", etc.)
- [x] Return search results with chunks and scores

### Hybrid Search Implementation
- [x] Implement keyword search (full-text search using PostgreSQL):
  - [x] Use PostgreSQL full-text search (tsvector/tsquery)
  - [x] Create searchable text index on chunk_text
  - [x] Implement keyword matching and ranking
- [x] Implement vector search:
  - [x] Generate embedding for query
  - [x] Use pgvector cosine similarity search
  - [x] Retrieve top-k vector results
- [x] Combine keyword + vector search:
  - [x] Implement hybrid scoring (weighted combination)
  - [x] Merge and deduplicate results
  - [x] Re-rank combined results
  - [x] Return top-k final results
- [x] Apply content_type filters before/after search
- [x] Apply tenant_id filtering

### Embedding Service
- [x] Set up embeddings API client (hosted or self-hosted)
- [x] Create embedding service abstraction
- [x] Implement query embedding generation
- [x] Handle API rate limits and retries
- [x] Add caching for embeddings (optional)

---

## Phase 5: Agent/Orchestrator Service

### Agent API (`/api/agent/chat`)
- [x] Create stateless HTTP agent/orchestrator service
- [x] Accept request with:
  - [x] User question
  - [x] User metadata (role, level, target_job, learning_preferences)
  - [x] Session context (optional)
- [x] Implement stateless design (no session storage)

### Content Filtering Logic
- [x] Determine content filters based on user context:
  - [x] Map user role/level to content types
  - [x] Apply learning preferences to filter content
  - [x] Support explicit filter overrides
- [x] Call RAG search API with appropriate filters
- [x] Handle multiple filter combinations

### Tool Integration
- [x] Design tool interface/abstraction
- [x] Implement eligibility check tool (example)
- [x] Implement other tools as needed (calculations, lookups, etc.)
- [x] Execute tools based on query intent
- [x] Collect tool outputs for prompt construction

### Structured Prompt Composition
- [x] Create prompt builder service
- [x] Compose structured prompt with sections:
  - [x] System instructions (context-aware based on user role)
  - [x] User profile section (role, level, target_job, learning_preferences)
  - [x] Retrieved chunks section (with identifiers and metadata)
  - [x] Tool outputs section (eligibility checks, calculations, etc.)
  - [x] User question
- [x] Format chunks with clear identifiers for citation
- [x] Optimize prompt length and structure

### LLM Integration
- [x] Set up LLM API client with streaming support
- [x] Call LLM API with structured prompt
- [x] Handle streaming responses
- [x] Parse LLM response
- [x] Extract answer text and referenced chunk IDs
- [x] Handle tool calls/function calling if needed

### Streaming Implementation
- [x] Implement Server-Sent Events (SSE) or streaming response
- [x] Stream LLM tokens to frontend in real-time
- [x] Handle streaming errors gracefully
- [x] Support both streaming and non-streaming modes

### API Response
- [x] Return streaming response (text chunks)
- [x] Return final answer text
- [x] Return list of chunk IDs used
- [x] Return metadata for chunks (for citations)
- [x] Return tool outputs (if any)
- [x] Handle API errors gracefully

### Integration
- [x] Connect frontend chat to `/api/agent/chat` endpoint
- [x] Handle streaming responses in frontend
- [x] Display assistant responses in chat UI (streaming)
- [x] Handle loading and error states

---

## Phase 6: Citations & Source Cards

### Citation Markers
- [x] Parse answer text for chunk references
- [x] Add inline superscript/footnote markers in answer
- [x] Make markers clickable (scroll to source card)

### Source Card Component
- [x] Create SourceCard component
- [x] Display document name
- [x] Display page/row information
- [x] Display short snippet preview
- [x] Add horizontal layout for multiple cards
- [x] Style with Tailwind CSS

### Chunk Metadata Retrieval
- [x] Query database for chunk metadata by IDs
- [x] Map chunk IDs to document names and locations
- [x] Extract preview snippets

### Integration
- [x] Display source cards under each assistant answer
- [x] Link citation markers to source cards
- [x] Add smooth scrolling to source cards

---

## Phase 7: Error Handling & Polish

### Error States
- [x] Implement "No relevant chunks found" message
- [x] Implement "LLM API failed" error message
- [x] Add retry functionality
- [x] Handle network errors gracefully
- [x] Add user-friendly error messages throughout

### UI/UX Improvements
- [x] Add loading indicators
- [x] Improve message formatting
- [x] Add smooth animations/transitions
- [x] Ensure responsive design (mobile-friendly)
- [x] Add empty state for chat
- [x] Improve accessibility (ARIA labels, keyboard navigation)

### Performance
- [x] Optimize database queries
- [x] Add caching where appropriate
- [x] Optimize embedding generation (batch processing)
- [x] Monitor and optimize response times

---

## Phase 8: Testing

### Unit Tests
- [x] Test chunking logic
- [x] Test PDF parsing
- [x] Test CSV parsing
- [x] Test embedding generation
- [x] Test keyword search (full-text search)
- [x] Test vector search queries
- [x] Test hybrid search (keyword + vector combination)
- [x] Test content filtering logic
- [x] Test prompt construction (with user context)
- [x] Test tool integration
- [x] Test RAG search API
- [x] Test agent/orchestrator service
- [x] Test API route handlers
- [x] Test utility functions

### Integration Tests
- [ ] Test full ingestion pipeline
- [ ] Test RAG search API with hybrid search
- [ ] Test agent/orchestrator with user context
- [ ] Test content filtering by type
- [ ] Test tool execution and integration
- [ ] Test end-to-end query flow (question → RAG → agent → response)
- [ ] Test streaming responses
- [ ] Test database operations
- [ ] Test API routes with real data

### E2E Tests (Playwright)
- [ ] Test core user journey: Set user context → Ask question → Get streaming answer → See citations
- [ ] Test content filtering (different user roles get different content)
- [ ] Test hybrid search effectiveness
- [ ] Test streaming response display
- [ ] Test error states
- [ ] Test chat history persistence
- [ ] Test responsive design

### Test Data
- [ ] Create sample PDF files for testing
- [ ] Create sample CSV files for testing
- [ ] Set up test database or test fixtures

---

## Phase 9: Deployment & Monitoring

### Pre-Deployment
- [ ] Set up environment variables in Vercel
- [ ] Configure build settings
- [ ] Test production build locally
- [ ] Verify all environment variables are set

### Deployment
- [ ] Deploy to Vercel
- [ ] Verify deployment works
- [ ] Test production environment
- [ ] Set up custom domain (if needed)

### Monitoring
- [ ] Configure Sentry error tracking
- [ ] Add basic logging
- [ ] Set up error alerts
- [ ] Monitor API usage and costs

### Documentation
- [ ] Write README with setup instructions
- [ ] Document environment variables
- [ ] Document ingestion process
- [ ] Add code comments for complex logic

---

## Phase 10: Optional Enhancements (Post-MVP)

- [ ] Add document upload UI (beyond CLI)
- [ ] Add document management (view/delete ingested docs)
- [ ] Add chat history persistence
- [ ] Add export chat functionality
- [ ] Improve chunking strategy (semantic chunking)
- [ ] Add support for more file types (Word, Markdown, etc.)
- [ ] Add re-ranking for search results
- [ ] Add query expansion/rewriting

---

## Notes

- Use descriptive Git commit messages
- Follow TypeScript best practices
- Keep components small and focused
- Write tests as we build features
- Monitor API costs during development

