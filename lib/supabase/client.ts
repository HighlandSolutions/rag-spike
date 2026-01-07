/**
 * Supabase client utilities
 * Provides both client-side and server-side Supabase clients
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Get Supabase client for client-side usage
 * Uses the anon key (safe to expose in browser)
 */
export const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });
};

/**
 * Get Supabase client for server-side usage
 * Uses the service role key (has elevated permissions, keep secret)
 */
export const getSupabaseServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

/**
 * Test database connection
 * Returns true if connection is successful, throws error otherwise
 */
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from('documents').select('count').limit(1);

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine for an empty table
      throw error;
    }

    return true;
  } catch (error) {
    throw new Error(
      `Database connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

