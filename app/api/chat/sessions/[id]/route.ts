/**
 * Chat session API endpoint
 * Handles updating and deleting individual chat sessions
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import type { ApiError } from '@/types/domain';

/**
 * PATCH /api/chat/sessions/[id]
 * Update a chat session (e.g., update title)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = getSupabaseServerClient();

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) {
      updateData.title = body.title;
    }
    if (body.user_context !== undefined) {
      updateData.user_context = body.user_context;
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const apiError: ApiError = {
        error: 'DatabaseError',
        message: `Failed to update chat session: ${error.message}`,
      };
      return new Response(JSON.stringify(apiError), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!data) {
      const apiError: ApiError = {
        error: 'NotFoundError',
        message: 'Chat session not found',
      };
      return new Response(JSON.stringify(apiError), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update chat session error:', error);

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
 * DELETE /api/chat/sessions/[id]
 * Delete a chat session (cascades to messages)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseServerClient();

    const { error } = await supabase.from('chat_sessions').delete().eq('id', id);

    if (error) {
      const apiError: ApiError = {
        error: 'DatabaseError',
        message: `Failed to delete chat session: ${error.message}`,
      };
      return new Response(JSON.stringify(apiError), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete chat session error:', error);

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

