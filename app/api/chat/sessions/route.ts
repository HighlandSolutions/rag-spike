/**
 * Chat sessions API endpoint
 * Handles creating and listing chat sessions
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import type { ApiError, UserContext } from '@/types/domain';

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'default-tenant';

/**
 * POST /api/chat/sessions
 * Create a new chat session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = getSupabaseServerClient();

    const sessionData = {
      tenant_id: DEFAULT_TENANT_ID,
      title: body.title as string | null | undefined,
      user_context: (body.user_context as UserContext | undefined) || null,
    };

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      const apiError: ApiError = {
        error: 'DatabaseError',
        message: `Failed to create chat session: ${error.message}`,
      };
      return new Response(JSON.stringify(apiError), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Create chat session error:', error);

    const apiError: ApiError = {
      error: 'ChatSessionError',
      message: error instanceof Error ? error.message : 'An unknown error occurred',
    };

    return new Response(JSON.stringify(apiError), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/chat/sessions
 * List all chat sessions for the tenant
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, title, user_context, created_at, updated_at')
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      const apiError: ApiError = {
        error: 'DatabaseError',
        message: `Failed to fetch chat sessions: ${error.message}`,
      };
      return new Response(JSON.stringify(apiError), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sessions: data || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List chat sessions error:', error);

    const apiError: ApiError = {
      error: 'ChatSessionError',
      message: error instanceof Error ? error.message : 'An unknown error occurred',
    };

    return new Response(JSON.stringify(apiError), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

