/**
 * Agent API client for frontend
 * Handles streaming responses from the agent endpoint
 */

import type { ChatRequest, ChatResponseChunk, UserContext } from '@/types/domain';

/**
 * Call agent API with streaming support
 */
export const callAgentAPI = async (
  question: string,
  userContext?: UserContext,
  onChunk?: (chunk: string) => void
): Promise<{
  answer: string;
  chunkIds: string[];
  metadata?: Record<string, unknown>;
}> => {
  const requestBody: ChatRequest = {
    question,
    userContext,
  };

  const response = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'UnknownError',
      message: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error(error.message || 'Failed to get response from agent');
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullAnswer = '';
  let chunkIds: string[] = [];
  let metadata: Record<string, unknown> | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data: ChatResponseChunk = JSON.parse(line.slice(6));

            if (data.error) {
              throw new Error(data.error);
            }

            if (data.text) {
              fullAnswer += data.text;
              if (onChunk) {
                onChunk(data.text);
              }
            }

            if (data.isComplete) {
              // Final chunk may contain metadata
              if ('answer' in data && typeof data.answer === 'string') {
                fullAnswer = data.answer;
              }
              if ('chunkIds' in data && Array.isArray(data.chunkIds)) {
                chunkIds = data.chunkIds as string[];
              }
              if ('metadata' in data && typeof data.metadata === 'object' && data.metadata !== null) {
                metadata = data.metadata as Record<string, unknown>;
              }
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            console.warn('Failed to parse SSE data:', line, parseError);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    answer: fullAnswer,
    chunkIds,
    metadata,
  };
};

