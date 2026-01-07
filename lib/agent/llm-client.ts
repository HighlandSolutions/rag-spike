/**
 * LLM API client with streaming support
 * Uses OpenAI API for chat completions
 */

import OpenAI from 'openai';
import type { ChatResponseChunk } from '@/types/domain';

/**
 * LLM configuration
 */
export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  stream: boolean;
}

/**
 * Default LLM configuration
 */
const DEFAULT_CONFIG: LLMConfig = {
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 2000,
  stream: true,
};

/**
 * Initialize OpenAI client
 */
const getOpenAIClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey,
  });
};

/**
 * Stream LLM response
 */
export const streamLLMResponse = async function* (
  prompt: string,
  config: Partial<LLMConfig> = {}
): AsyncGenerator<ChatResponseChunk, void, unknown> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Problem 1: Enforce streaming mode for this function
  if (!finalConfig.stream) {
    yield {
      text: '',
      isComplete: true,
      error: 'Streaming is required for streamLLMResponse. Use getLLMResponse for non-streaming responses.',
    };
    return;
  }

  const client = getOpenAIClient();

  try {
    const stream = await client.chat.completions.create({
      model: finalConfig.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that provides accurate, well-cited answers based on the provided context.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: finalConfig.temperature,
      max_tokens: finalConfig.maxTokens,
      stream: true, // Problem 2: Always use true since we're in a streaming function
    });

    // Problem 3: Properly check if response is async iterable
    if (typeof stream[Symbol.asyncIterator] !== 'function') {
      yield {
        text: '',
        isComplete: true,
        error: 'OpenAI API did not return a streamable response',
      };
      return;
    }

    // Problem 4: Process all chunks from the stream
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content || '';

      if (content) {
        yield {
          text: content,
          isComplete: false,
        };
      }
    }

    // Send final completion signal
    yield {
      text: '',
      isComplete: true,
    };
  } catch (error) {
    // Problem 5: Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorDetails = error instanceof Error && 'status' in error 
      ? ` (Status: ${(error as { status?: number }).status})` 
      : '';
    
    yield {
      text: '',
      isComplete: true,
      error: `LLM streaming error: ${errorMessage}${errorDetails}`,
    };
  }
};

/**
 * Get non-streaming LLM response (for testing or fallback)
 */
export const getLLMResponse = async (
  prompt: string,
  config: Partial<LLMConfig> = {}
): Promise<string> => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config, stream: false };
  const client = getOpenAIClient();

  try {
    const response = await client.chat.completions.create({
      model: finalConfig.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that provides accurate, well-cited answers based on the provided context.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: finalConfig.temperature,
      max_tokens: finalConfig.maxTokens,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    throw new Error(
      `LLM API error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

