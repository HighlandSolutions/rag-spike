/**
 * Streaming utilities for chat responses
 */

import type { ChatMessage } from '@/types/chat';

/**
 * Update a message with streaming content
 */
export function updateMessageWithStream(
  messages: ChatMessage[],
  messageId: string,
  textChunk: string
): ChatMessage[] {
  return messages.map((msg) => {
    if (msg.id === messageId) {
      return {
        ...msg,
        content: msg.content + textChunk,
        isLoading: false,
      };
    }
    return msg;
  });
}

/**
 * Complete a streaming message
 */
export function completeStreamingMessage(
  messages: ChatMessage[],
  messageId: string,
  finalContent: string,
  chunkIds?: string[]
): ChatMessage[] {
  return messages.map((msg) => {
    if (msg.id === messageId) {
      return {
        ...msg,
        content: finalContent,
        isLoading: false,
        chunkIds: chunkIds || msg.chunkIds,
      };
    }
    return msg;
  });
}

