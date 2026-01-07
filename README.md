# RAG Q&A Application

A Perplexity-style Q&A application with RAG (Retrieval-Augmented Generation) capabilities.

## Project Status

Phase 0: Project Setup & Infrastructure - ✅ Complete

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
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run ingest` - Run document ingestion CLI

## Environment Variables

See `.env.example` for required environment variables.

## Documentation

- [Architecture](./docs/architecture.md)
- [Implementation Plan](./docs/plan.md)
- [PRD](./docs/PRD.md)
