/**
 * Agent API client for frontend
 * Handles streaming responses from the agent endpoint with retry support
 */

import type { ChatRequest, ChatResponseChunk, UserContext } from '@/types/domain';

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // milliseconds
  retryableStatuses: number[]; // HTTP status codes that should trigger retry
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatuses: [429, 500, 502, 503, 504], // Rate limit and server errors
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if error is retryable
 */
const isRetryableError = (status: number, config: RetryConfig): boolean => {
  return config.retryableStatuses.includes(status);
};

/**
 * Call agent API with streaming support and retry logic
 */
export const callAgentAPI = async (
  question: string,
  userContext?: UserContext,
  onChunk?: (chunk: string) => void,
  retryConfig: Partial<RetryConfig> = {}
): Promise<{
  answer: string;
  chunkIds: string[];
  metadata?: Record<string, unknown>;
}> => {
  const finalRetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  const requestBody: ChatRequest = {
    question,
    userContext,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= finalRetryConfig.maxRetries; attempt++) {
    try {
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

        // Check if we should retry
        if (
          attempt < finalRetryConfig.maxRetries &&
          isRetryableError(response.status, finalRetryConfig)
        ) {
          const delay = finalRetryConfig.retryDelay * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }

        // Don't retry for client errors (4xx) or if max retries reached
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
                  // Handle specific error types from stream
                  if (data.error.includes('LLM') || data.error.includes('OpenAI')) {
                    throw new Error('LLM_API_ERROR');
                  }
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
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error occurred');

      // If this was the last attempt, throw the error
      if (attempt >= finalRetryConfig.maxRetries) {
        throw lastError;
      }

      // Wait before retrying
      const delay = finalRetryConfig.retryDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Failed to get response from agent');
};

