# Database Migrations

This directory contains SQL migration files for setting up the RAG application database schema.

## Migration Files

1. **001_create_documents_table.sql** - Creates the `documents` table
2. **002_create_chunks_table.sql** - Creates the `chunks` table with pgvector support
3. **003_setup_rls.sql** - Sets up Row Level Security (RLS) policies

## Running Migrations

### Option 1: Using Supabase Dashboard (Recommended for PoC)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/efyysxkdlugpnurvajhp
2. Navigate to **SQL Editor**
3. Run each migration file in order:
   - Copy and paste the contents of `001_create_documents_table.sql`
   - Click "Run" to execute
   - Repeat for `002_create_chunks_table.sql` and `003_setup_rls.sql`

### Option 2: Using Supabase CLI (For Local Development)

If you have Supabase CLI installed:

```bash
# Link to your project
supabase link --project-ref efyysxkdlugpnurvajhp

# Run migrations
supabase db push
```

### Option 3: Using psql

If you have direct database access:

```bash
psql -h db.efyysxkdlugpnurvajhp.supabase.co -U postgres -d postgres -f 001_create_documents_table.sql
psql -h db.efyysxkdlugpnurvajhp.supabase.co -U postgres -d postgres -f 002_create_chunks_table.sql
psql -h db.efyysxkdlugpnurvajhp.supabase.co -U postgres -d postgres -f 003_setup_rls.sql
```

## Verifying Migrations

After running the migrations, you can verify they worked by:

1. Checking the tables exist in Supabase Dashboard → Table Editor
2. Testing the connection using the test endpoint: `GET /api/test-db`
3. Running a simple query to check table structure

## Notes

- The migrations are idempotent (safe to run multiple times) using `IF NOT EXISTS` clauses
- RLS policies are set to allow all operations for PoC (can be restricted later)
- The embedding vector dimension is set to 1536 for OpenAI's `text-embedding-3-small` model

