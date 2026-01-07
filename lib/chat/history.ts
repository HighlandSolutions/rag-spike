/**
 * Chat history utilities
 * Functions for saving and loading chat history from the database
 */

import type { ChatMessage } from '@/types/chat';
import type { UserContext } from '@/types/domain';

export interface ChatSession {
  id: string;
  title: string | null;
  user_context: UserContext | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new chat session
 */
export async function createChatSession(
  userContext?: UserContext,
  title?: string
): Promise<ChatSession> {
  const response = await fetch('/api/chat/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title || null,
      user_context: userContext || null,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create chat session');
  }

  return response.json();
}

/**
 * Save a message to a chat session
 */
export async function saveChatMessage(
  sessionId: string,
  message: Omit<ChatMessage, 'id' | 'timestamp'>
): Promise<void> {
  const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: message.role,
      content: message.content,
      chunk_ids: message.chunkIds || null,
      error: message.error || false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save message');
  }
}

/**
 * Load all messages for a chat session
 */
export async function loadChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const response = await fetch(`/api/chat/sessions/${sessionId}/messages`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load messages');
  }

  const data = await response.json();
  const messages = data.messages || [];

  // Convert database format to ChatMessage format
  return messages.map((msg: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    chunk_ids: string[] | null;
    error: boolean;
    created_at: string;
  }): ChatMessage => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.created_at),
    chunkIds: msg.chunk_ids || undefined,
    error: msg.error || undefined,
  }));
}

/**
 * List all chat sessions
 */
export async function listChatSessions(limit = 50, offset = 0): Promise<ChatSession[]> {
  const response = await fetch(`/api/chat/sessions?limit=${limit}&offset=${offset}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to list chat sessions');
  }

  const data = await response.json();
  return data.sessions || [];
}

/**
 * Update a chat session (e.g., update title)
 */
export async function updateChatSession(
  sessionId: string,
  updates: { title?: string; user_context?: UserContext }
): Promise<ChatSession> {
  const response = await fetch(`/api/chat/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update chat session');
  }

  return response.json();
}

/**
 * Delete a chat session
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/chat/sessions/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete chat session');
  }
}

