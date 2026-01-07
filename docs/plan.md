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
- [ ] Configure Vercel project (connect to GitHub) - User will set up
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
- [ ] Design `documents` table (id, tenant_id, source_path, name, content_type, uploaded_at, etc.)
- [ ] Design `chunks` table (id, tenant_id, document_id, chunk_text, chunk_metadata, content_type, embedding vector, created_at)
- [ ] Create migration for documents table
- [ ] Create migration for chunks table with pgvector column
- [ ] Create indexes on chunks:
  - [ ] document_id index
  - [ ] embedding vector similarity search index
  - [ ] content_type index (for filtering)
  - [ ] tenant_id index (for multi-tenant support)
  - [ ] Full-text search index (for keyword search)
- [ ] Set up Row Level Security (RLS) policies (basic for PoC, tenant-aware if needed)
- [ ] Test database connection from Next.js

### TypeScript Types
- [ ] Define `Document` type
- [ ] Define `DocumentChunk` type
- [ ] Define `ChunkMetadata` type
- [ ] Define `UserContext` type (role, level, target_job, learning_preferences)
- [ ] Define `SearchRequest` type (tenant_id, user_context, query, k, filters)
- [ ] Define `SearchResponse` type (chunks, scores)
- [ ] Define `ChatRequest` type (question, user_context, metadata)
- [ ] Define API request/response types
- [ ] Define database schema types (generate from Supabase or manual)

### Core Utilities
- [ ] Create Supabase client utility
- [ ] Create database query helpers
- [ ] Create type guards and validators

---

## Phase 2: Document Ingestion Pipeline (CLI)

### File Reading
- [ ] Create `/content` directory structure
- [ ] Implement file discovery (scan directory for .pdf, .csv files)
- [ ] Add file validation (size limits, type checking)

### PDF Parsing
- [ ] Implement PDF text extraction (per page)
- [ ] Handle PDF parsing errors gracefully
- [ ] Extract metadata (page numbers, document name)

### CSV Parsing
- [ ] Implement CSV parsing (per row/record)
- [ ] Handle CSV parsing errors gracefully
- [ ] Extract metadata (row index, column names, file name)

### Chunking Logic
- [ ] Implement text chunking algorithm (~500-1000 tokens with 50-100 overlap)
- [ ] Create token counting utility (approximate with character count)
- [ ] Normalize chunks into `DocumentChunk` format
- [ ] Preserve metadata (page/row, source path) in chunks
- [ ] Assign content_type/category to chunks (based on document type or metadata)
- [ ] Store tenant_id with chunks (for multi-tenant support)

### Ingestion CLI Script
- [ ] Create `npm run ingest` script
- [ ] Implement main ingestion flow:
  - [ ] Read files from `/content`
  - [ ] Parse and chunk documents
  - [ ] Generate embeddings for each chunk
  - [ ] Store chunks in Supabase
- [ ] Add progress logging
- [ ] Handle errors and partial failures
- [ ] Add idempotency (skip already-ingested documents)

### Embeddings Integration
- [ ] Set up embeddings API client
- [ ] Implement batch embedding generation
- [ ] Handle API rate limits and retries
- [ ] Store embeddings as vectors in pgvector column

---

## Phase 3: Basic Chat UI

### UI Components (shadcn/ui)
- [ ] Set up shadcn/ui components (Button, Input, Card, etc.)
- [ ] Create ChatContainer component
- [ ] Create MessageList component
- [ ] Create MessageBubble component (user/assistant)
- [ ] Create ChatInput component with placeholder
- [ ] Create UserContextForm component (for role, level, target_job, learning_preferences)
- [ ] Add basic styling with Tailwind CSS v4

### Chat State Management
- [ ] Set up chat state (messages array)
- [ ] Set up user context state (role, level, target_job, learning_preferences)
- [ ] Implement message submission handler
- [ ] Implement message display logic
- [ ] Add loading states for pending responses
- [ ] Handle streaming message updates

### User Context Collection
- [ ] Create user profile/settings UI (optional, can be stored in localStorage)
- [ ] Collect user metadata:
  - [ ] Role (dropdown or input)
  - [ ] Level (dropdown: junior, mid, senior, etc.)
  - [ ] Target job (input)
  - [ ] Learning preferences (multi-select or tags)
- [ ] Store user context (localStorage or session)
- [ ] Include user context in API requests

---

## Phase 4: RAG Search API & Hybrid Search

### RAG Search API (`/api/rag/search`)
- [ ] Create RAG search API endpoint
- [ ] Implement `search(tenant_id, user_context, query, k, filters)` function signature
- [ ] Accept search parameters:
  - [ ] tenant_id (for multi-tenant support)
  - [ ] user_context (role, level, target_job, learning_preferences)
  - [ ] query (user question)
  - [ ] k (number of results, default 8)
  - [ ] filters (content_type filters: "policies", "learning_content", "internal_roles", etc.)
- [ ] Return search results with chunks and scores

### Hybrid Search Implementation
- [ ] Implement keyword search (full-text search using PostgreSQL):
  - [ ] Use PostgreSQL full-text search (tsvector/tsquery)
  - [ ] Create searchable text index on chunk_text
  - [ ] Implement keyword matching and ranking
- [ ] Implement vector search:
  - [ ] Generate embedding for query
  - [ ] Use pgvector cosine similarity search
  - [ ] Retrieve top-k vector results
- [ ] Combine keyword + vector search:
  - [ ] Implement hybrid scoring (weighted combination)
  - [ ] Merge and deduplicate results
  - [ ] Re-rank combined results
  - [ ] Return top-k final results
- [ ] Apply content_type filters before/after search
- [ ] Apply tenant_id filtering

### Embedding Service
- [ ] Set up embeddings API client (hosted or self-hosted)
- [ ] Create embedding service abstraction
- [ ] Implement query embedding generation
- [ ] Handle API rate limits and retries
- [ ] Add caching for embeddings (optional)

---

## Phase 5: Agent/Orchestrator Service

### Agent API (`/api/agent/chat`)
- [ ] Create stateless HTTP agent/orchestrator service
- [ ] Accept request with:
  - [ ] User question
  - [ ] User metadata (role, level, target_job, learning_preferences)
  - [ ] Session context (optional)
- [ ] Implement stateless design (no session storage)

### Content Filtering Logic
- [ ] Determine content filters based on user context:
  - [ ] Map user role/level to content types
  - [ ] Apply learning preferences to filter content
  - [ ] Support explicit filter overrides
- [ ] Call RAG search API with appropriate filters
- [ ] Handle multiple filter combinations

### Tool Integration
- [ ] Design tool interface/abstraction
- [ ] Implement eligibility check tool (example)
- [ ] Implement other tools as needed (calculations, lookups, etc.)
- [ ] Execute tools based on query intent
- [ ] Collect tool outputs for prompt construction

### Structured Prompt Composition
- [ ] Create prompt builder service
- [ ] Compose structured prompt with sections:
  - [ ] System instructions (context-aware based on user role)
  - [ ] User profile section (role, level, target_job, learning_preferences)
  - [ ] Retrieved chunks section (with identifiers and metadata)
  - [ ] Tool outputs section (eligibility checks, calculations, etc.)
  - [ ] User question
- [ ] Format chunks with clear identifiers for citation
- [ ] Optimize prompt length and structure

### LLM Integration
- [ ] Set up LLM API client with streaming support
- [ ] Call LLM API with structured prompt
- [ ] Handle streaming responses
- [ ] Parse LLM response
- [ ] Extract answer text and referenced chunk IDs
- [ ] Handle tool calls/function calling if needed

### Streaming Implementation
- [ ] Implement Server-Sent Events (SSE) or streaming response
- [ ] Stream LLM tokens to frontend in real-time
- [ ] Handle streaming errors gracefully
- [ ] Support both streaming and non-streaming modes

### API Response
- [ ] Return streaming response (text chunks)
- [ ] Return final answer text
- [ ] Return list of chunk IDs used
- [ ] Return metadata for chunks (for citations)
- [ ] Return tool outputs (if any)
- [ ] Handle API errors gracefully

### Integration
- [ ] Connect frontend chat to `/api/agent/chat` endpoint
- [ ] Handle streaming responses in frontend
- [ ] Display assistant responses in chat UI (streaming)
- [ ] Handle loading and error states

---

## Phase 6: Citations & Source Cards

### Citation Markers
- [ ] Parse answer text for chunk references
- [ ] Add inline superscript/footnote markers in answer
- [ ] Make markers clickable (scroll to source card)

### Source Card Component
- [ ] Create SourceCard component
- [ ] Display document name
- [ ] Display page/row information
- [ ] Display short snippet preview
- [ ] Add horizontal layout for multiple cards
- [ ] Style with Tailwind CSS

### Chunk Metadata Retrieval
- [ ] Query database for chunk metadata by IDs
- [ ] Map chunk IDs to document names and locations
- [ ] Extract preview snippets

### Integration
- [ ] Display source cards under each assistant answer
- [ ] Link citation markers to source cards
- [ ] Add smooth scrolling to source cards

---

## Phase 7: Error Handling & Polish

### Error States
- [ ] Implement "No relevant chunks found" message
- [ ] Implement "LLM API failed" error message
- [ ] Add retry functionality
- [ ] Handle network errors gracefully
- [ ] Add user-friendly error messages throughout

### UI/UX Improvements
- [ ] Add loading indicators
- [ ] Improve message formatting
- [ ] Add smooth animations/transitions
- [ ] Ensure responsive design (mobile-friendly)
- [ ] Add empty state for chat
- [ ] Improve accessibility (ARIA labels, keyboard navigation)

### Performance
- [ ] Optimize database queries
- [ ] Add caching where appropriate
- [ ] Optimize embedding generation (batch processing)
- [ ] Monitor and optimize response times

---

## Phase 8: Testing

### Unit Tests
- [ ] Test chunking logic
- [ ] Test PDF parsing
- [ ] Test CSV parsing
- [ ] Test embedding generation
- [ ] Test keyword search (full-text search)
- [ ] Test vector search queries
- [ ] Test hybrid search (keyword + vector combination)
- [ ] Test content filtering logic
- [ ] Test prompt construction (with user context)
- [ ] Test tool integration
- [ ] Test RAG search API
- [ ] Test agent/orchestrator service
- [ ] Test API route handlers
- [ ] Test utility functions

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

