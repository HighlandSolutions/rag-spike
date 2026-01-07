/**
 * Chat messages API endpoint
 * Handles saving and loading messages for a chat session
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import type { ApiError } from '@/types/domain';
import type { ChatMessageInsert } from '@/types/database';

/**
 * POST /api/chat/sessions/[id]/messages
 * Save a message to a chat session
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const supabase = getSupabaseServerClient();

    // Validate required fields
    if (!body.role || !body.content) {
      const apiError: ApiError = {
        error: 'ValidationError',
        message: 'role and content are required',
      };
      return new Response(JSON.stringify(apiError), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.role !== 'user' && body.role !== 'assistant') {
      const apiError: ApiError = {
        error: 'ValidationError',
        message: 'role must be either "user" or "assistant"',
      };
      return new Response(JSON.stringify(apiError), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const messageData: ChatMessageInsert = {
      session_id: sessionId,
      role: body.role as 'user' | 'assistant',
      content: body.content as string,
      chunk_ids: (body.chunk_ids as string[] | undefined) || null,
      error: (body.error as boolean | undefined) || false,
    };

    // Type assertion needed due to Supabase type inference limitations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('chat_messages') as any)
      .insert([messageData])
      .select()
      .single();

    if (error) {
      const apiError: ApiError = {
        error: 'DatabaseError',
        message: `Failed to save message: ${error.message}`,
      };
      return new Response(JSON.stringify(apiError), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update session updated_at timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('chat_sessions') as any)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    // If this is the first user message and session has no title, set title from message content
    if (body.role === 'user' && body.content) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sessionData } = await (supabase.from('chat_sessions') as any)
        .select('title')
        .eq('id', sessionId)
        .single();

      if (sessionData && !sessionData.title) {
        const title = body.content.slice(0, 100); // Use first 100 chars as title
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('chat_sessions') as any)
          .update({ title })
          .eq('id', sessionId);
      }
    }

    return new Response(JSON.stringify(data), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Save message error:', error);

    const apiError: ApiError = {
      error: 'ChatMessageError',
      message: error instanceof Error ? error.message : 'An unknown error occurred',
    };

    return new Response(JSON.stringify(apiError), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/chat/sessions/[id]/messages
 * Get all messages for a chat session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      const apiError: ApiError = {
        error: 'DatabaseError',
        message: `Failed to fetch messages: ${error.message}`,
      };
      return new Response(JSON.stringify(apiError), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ messages: data || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get messages error:', error);

    const apiError: ApiError = {
      error: 'ChatMessageError',
      message: error instanceof Error ? error.message : 'An unknown error occurred',
    };

    return new Response(JSON.stringify(apiError), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

