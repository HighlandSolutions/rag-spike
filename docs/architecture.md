1. Tech Stack
Frontend (User Interface)
Next.js + React: Web framework and UI library
Tailwind CSS v4: Styling
shadcn/ui: Pre-built UI components
Backend (Server Logic)
Next.js API Routes: Serverless endpoints that handle requests
Supabase (PostgreSQL): Database with vector search (pgvector) for semantic search
AI/ML Services
LLM API (e.g., OpenAI, Anthropic): Generates answers
Embeddings API: Converts text to vectors for similarity search
Infrastructure & Tools
GitHub: Version control
Vercel: Hosting and deployment
Sentry: Error monitoring
Testing
Jest: Unit tests
React Testing Library: Component tests
Playwright: End-to-end tests

2. Architecture Model
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Next.js Frontend (React + Tailwind)           │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Chat UI (shadcn/ui components)                 │  │  │
│  │  │  - Message List                                 │  │  │
│  │  │  - Input Box                                    │  │  │
│  │  │  - Source Cards                                 │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP Requests
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Hosting)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Next.js API Routes (Serverless)               │  │
│  │                                                         │  │
│  │  ┌──────────────────┐    ┌──────────────────────┐   │  │
│  │  │ /api/agent/chat  │    │  /api/rag/search      │   │  │
│  │  │                  │    │                       │   │  │
│  │  │ Orchestrator:    │───▶│ Hybrid Search:        │   │  │
│  │  │ - Gets user      │    │ - Keyword (full-text) │   │  │
│  │  │   question       │    │ - Vector (embeddings) │   │  │
│  │  │ - Calls RAG      │    │ - Combines results    │   │  │
│  │  │ - Builds prompt  │    └───────────────────────┘   │  │
│  │  │ - Calls LLM      │              │                  │  │
│  │  │ - Streams answer │              │                  │  │
│  │  └──────────────────┘              │                  │  │
│  │           │                        │                  │  │
│  │           │                        ▼                  │  │
│  │           │            ┌──────────────────────┐       │  │
│  │           │            │  Embedding Service   │       │  │
│  │           │            │  (Converts text to   │       │  │
│  │           │            │   vectors)           │       │  │
│  │           │            └──────────────────────┘       │  │
│  │           │                        │                  │  │
│  │           │                        ▼                  │  │
│  │           │            ┌──────────────────────┐       │  │
│  │           └───────────▶│   LLM API            │       │  │
│  │                        │   (OpenAI/Anthropic) │       │  │
│  │                        └──────────────────────┘       │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Database Queries
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (Database)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         PostgreSQL + pgvector                        │  │
│  │                                                         │  │
│  │  ┌──────────────────┐    ┌──────────────────────┐   │  │
│  │  │  documents       │    │  chunks               │   │  │
│  │  │  table           │    │  table                │   │  │
│  │  │                  │    │  - chunk_text         │   │  │
│  │  │  - id            │◀───│  - embedding (vector) │   │  │
│  │  │  - name          │    │  - metadata           │   │  │
│  │  │  - source_path   │    │  - content_type       │   │  │
│  │  └──────────────────┘    └───────────────────────┘   │  │
│  │                                                         │  │
│  │  Indexes: Full-text search + Vector similarity         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              DOCUMENT INGESTION (CLI)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  npm run ingest                                       │  │
│  │  - Reads /content/*.pdf, *.csv                       │  │
│  │  - Parses & chunks documents                          │  │
│  │  - Generates embeddings                               │  │
│  │  - Stores in Supabase                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘


3. Data flow
User asks a question in the chat UI.
Frontend sends the question to /api/agent/chat.
Agent orchestrator:
Generates an embedding for the question.
Calls /api/rag/search to find relevant document chunks.
RAG search:
Performs keyword and vector search in Supabase.
Returns top-k chunks.
Agent builds a prompt with user context and retrieved chunks.
Agent calls the LLM API to generate an answer.
Answer streams back to the frontend.
Frontend displays the answer with source citations.