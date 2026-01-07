Let’s build a web app to track Perplexity-style Q&A experience that answers user questions using private data via retrieval-augmented generation (RAG) via web-based chat UI

Answers are grounded in ingested documents with visible citations / source cards.
Content is stored and searched via Supabase (Postgres + pgvector).​


Help me think through how to break the following into iterative pieces and write a plan.md.


Frontend:

- Next. js and React
- Tailwind CSS v4
- shadcn/ui
- ESLint 9

Backend
- Supabase


Infra:
- GitHub
- Vercel
- Sentry

Requirements:
1. Add unit tests for business logic, e2e tests for core user journeys
2. Use git and npm, use descriptive commits


Check off items in the plan as we accomplish them as a todo list. If you have open questions that require my input, add those in the plan as well.



2. Goals and non-goals
Goals
Let a user ask natural-language questions about their documents and get fluent, grounded answers.​
Show which document chunks supported each answer (source cards).​
Support at least:
1–5 small PDFs (up to a few hundred pages total) and
A few CSVs (up to tens of thousands of rows total).​
Non-goals (for this PoC)
No multi-tenant or enterprise auth; a single user or small internal team is enough.​
No fine-tuning or custom model training; only hosted LLM + embeddings APIs.​
No full-blown analytics or observability beyond basic logs.​

3. Users and use cases
Primary users
Internal developer / knowledge worker exploring RAG over an internal database.
​
Key use cases
Ask: “Summarize key points about X from my docs.”
Ask: “Where in my documents is policy Y specified?”
Ask: “Compare A vs B according to my data.”​

4. User experience (UX) requirements
Chat screen
Single-page chat interface.
Components:
Input box with “Ask a question about your content…” placeholder.

Chat history list:
User messages.
Assistant answers (streaming preferred, but can be full-response).​

Under each assistant answer:
Inline superscript or footnote-style citation markers.
A horizontal list of “source cards,” each showing:
Document name.

Page or row/section.
Short snippet.​
Error states
If no relevant chunks found:
Message like “No strongly relevant content found in your corpus. Try rephrasing or adding more documents.”​
If LLM API fails:
Message like “There was an issue generating the answer. Please try again later.”
Ingestion UX (for PoC)
Ingestion can be CLI-only:
npm run ingest that processes files in a local /content directory.​
No user-facing upload UI required for first iteration.

5. Functional requirements
FR1 – Document ingestion
System reads all files in /content directory with extensions .

For each file:
Parse text content (per page for PDFs, per row/record for CSV).

Normalize into a canonical DocumentChunk abstraction:
document_id
source_path
chunk_id
chunk_text
chunk_metadata (page number, row index, section, etc.).​
Chunking:
Combine raw segments into ~500–1,000 token chunks with 50–100 token overlap (approximation if using characters).​

FR2 – Embedding and storage
For each chunk, call an embeddings API to generate a dense vector.​
Store:
Chunk text.
Metadata.
Embedding (vector) in Supabase Postgres using pgvector.​

FR3 – Question answering
When user submits a question:
Generate an embedding for the question using the same embeddings model.​
Query pgvector with cosine or inner-product similarity to get top-k chunks (default 
k=8
k=8).​
Construct a prompt with:
System instructions (e.g., “Answer using only the provided context…”).
User question.
Retrieved chunks (with identifiers).​
Call LLM API to generate an answer.
Return:
Answer text.
List of chunk IDs used.​
FR4 – Citations & source cards
Frontend maps chunk IDs to:
Document name.
Page/row.
Short preview snippet.​
Display inline markers and clickable source cards under the answer.​
FR5 – Configuration
Environment variables for:
Database URL + credentials (Supabase).
LLM API key.
Embeddings model name.​

6. Non-functional requirements
Performance:
Answer latency target: ≤ 6–8 seconds for moderate-length questions on a small corpus.​
Scalability (PoC-level):
Support a corpus up to a few thousand chunks without noticeable slowdown.​
Security:
API keys stored in environment variables, not in client code.​
Access limited to trusted users (basic password/basic auth acceptable for PoC).

