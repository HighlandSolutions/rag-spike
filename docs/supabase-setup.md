# Supabase Setup Documentation

## Project Details

- **Project Name**: rag-spike
- **Project ID**: efyysxkdlugpnurvajhp
- **Project URL**: https://efyysxkdlugpnurvajhp.supabase.co
- **Region**: us-east-1
- **Status**: Active
- **Cost**: $10/month

## Connection Details

### Getting Your API Keys

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/efyysxkdlugpnurvajhp/settings/api)
2. Under "Project API keys", you'll find:
   - **anon/public key**: Use this for `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe to expose in client-side code)
   - **service_role key**: Use this for `SUPABASE_SERVICE_ROLE_KEY` (keep secret, server-side only)

### Database Connection

- **Host**: db.efyysxkdlugpnurvajhp.supabase.co
- **Database**: postgres
- **Port**: 5432
- **User**: postgres
- **Password**: Available in Supabase dashboard under Database settings

## Extensions Enabled

- ✅ **pgvector**: Enabled for vector similarity search

## Next Steps

1. Copy `.env.example` to `.env`
2. Add your Supabase API keys to `.env`
3. Test the connection using the Supabase client in your Next.js app

