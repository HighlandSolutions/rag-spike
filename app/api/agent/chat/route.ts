/**
 * Agent/Orchestrator API endpoint
 * Handles chat requests with RAG search, tool execution, and LLM streaming
 */

import { NextRequest } from 'next/server';
import { search } from '@/lib/rag/search';
import { determineContentFilters } from '@/lib/agent/content-filters';
import { determineToolsToExecute, executeTools } from '@/lib/agent/tools';
import { composePrompt, extractChunkIds } from '@/lib/agent/prompt-builder';
import { streamLLMResponse } from '@/lib/agent/llm-client';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import type { ChatRequest, ApiError, UserContext, SearchRequest, ContentType } from '@/types/domain';
import type { ChatMessage } from '@/types/chat';
import type { ChatMessageRow } from '@/types/database';
import type { QueryProcessingConfig } from '@/lib/rag/query-processing';

/**
 * Default tenant ID (for PoC, can be made configurable later)
 */
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'default-tenant';

/**
 * POST /api/agent/chat
 * Handles chat requests with streaming responses
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.question || typeof body.question !== 'string' || body.question.trim().length === 0) {
      const error: ApiError = {
        error: 'ValidationError',
        message: 'question is required and must be a non-empty string',
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build chat request
    const chatRequest: ChatRequest = {
      question: body.question.trim(),
      userContext: body.user_context as UserContext | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
      sessionId: body.session_id as string | undefined,
    };

    // Determine content filters based on user context
    const contentFilters = determineContentFilters(chatRequest.userContext);

    // Load conversation history if session ID is provided
    let conversationHistory: ChatMessage[] | undefined;
    if (chatRequest.sessionId) {
      try {
        const supabase = getSupabaseServerClient();
        const { data: messagesData } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', chatRequest.sessionId)
          .order('created_at', { ascending: true });

        if (messagesData && messagesData.length > 0) {
          conversationHistory = (messagesData as ChatMessageRow[]).map((msg) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: new Date(msg.created_at),
            chunkIds: msg.chunk_ids || undefined,
            error: msg.error || undefined,
          }));
        }
      } catch (error) {
        // Log but don't fail if history loading fails
        console.warn('Failed to load conversation history:', error);
      }
    }

    // Build search request
    const searchRequest: SearchRequest = {
      tenantId: DEFAULT_TENANT_ID,
      userContext: chatRequest.userContext,
      query: chatRequest.question,
      k: 8, // Default to 8 chunks
      filters: contentFilters ? { contentType: contentFilters as ContentType[] } : undefined,
    };

    // Query processing configuration (can be customized via env vars or request body)
    const queryProcessingConfig: Partial<QueryProcessingConfig> = {
      enabled: process.env.ENABLE_QUERY_PROCESSING === 'true',
      enableExpansion: process.env.ENABLE_QUERY_EXPANSION === 'true',
      enableRewriting: process.env.ENABLE_QUERY_REWRITING === 'true',
      enableUnderstanding: process.env.ENABLE_QUERY_UNDERSTANDING === 'true',
    };

    // Perform RAG search with query processing
    const searchResponse = await search(
      searchRequest,
      undefined, // rerankingConfig (uses defaults)
      queryProcessingConfig,
      conversationHistory
    );

    // Check if no relevant chunks were found
    if (searchResponse.chunks.length === 0) {
      const error: ApiError = {
        error: 'NoRelevantChunks',
        message: 'No relevant information found in the knowledge base. Please try rephrasing your question or check if the content has been ingested.',
      };
      return new Response(JSON.stringify(error), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Determine which tools to execute
    const toolsToExecute = determineToolsToExecute(chatRequest.question);

    // Execute tools in parallel
    const toolResults = await executeTools(
      toolsToExecute,
      chatRequest.question,
      chatRequest.userContext
    );

    // Compose structured prompt
    const prompt = composePrompt(
      chatRequest.question,
      searchResponse.chunks,
      chatRequest.userContext,
      toolResults
    );

    // Extract chunk IDs for response metadata
    const chunkIds = extractChunkIds(searchResponse.chunks);

    // Create streaming response using Server-Sent Events (SSE)
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullAnswer = '';

        try {
          // Stream LLM response
          for await (const chunk of streamLLMResponse(prompt)) {
            if (chunk.error) {
              // Send error and close
              const errorData = JSON.stringify({
                error: chunk.error,
                isComplete: true,
              });
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
              controller.close();
              return;
            }

            if (chunk.text) {
              fullAnswer += chunk.text;
              // Send text chunk
              const chunkData = JSON.stringify({
                text: chunk.text,
                isComplete: false,
              });
              controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`));
            }

            if (chunk.isComplete) {
              // Send final response with metadata
              const finalData = JSON.stringify({
                text: '',
                isComplete: true,
                answer: fullAnswer,
                chunkIds,
                metadata: {
                  totalChunks: searchResponse.chunks.length,
                  toolResults: toolResults.map((tr) => ({
                    toolName: tr.toolName,
                    success: tr.success,
                  })),
                },
              });
              controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
              controller.close();
            }
          }
        } catch (error) {
          // Determine error type and provide user-friendly message
          let errorMessage = 'An unexpected error occurred. Please try again.';
          let errorType = 'StreamError';

          if (error instanceof Error) {
            if (error.message.includes('LLM') || error.message.includes('OpenAI') || error.message.includes('API')) {
              errorType = 'LLMError';
              errorMessage = 'The AI service is temporarily unavailable. Please try again in a moment.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
              errorType = 'NetworkError';
              errorMessage = 'Network connection error. Please check your internet connection and try again.';
            } else {
              errorMessage = error.message;
            }
          }

          const errorData = JSON.stringify({
            error: errorType,
            message: errorMessage,
            isComplete: true,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    // Return streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Agent chat error:', error);

    const apiError: ApiError = {
      error: 'ChatError',
      message: error instanceof Error ? error.message : 'An unknown error occurred',
      details: error instanceof Error ? { stack: error.stack } : undefined,
    };

    return new Response(JSON.stringify(apiError), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/agent/chat
 * Health check endpoint
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      service: 'Agent/Orchestrator API',
      status: 'operational',
      endpoints: {
        POST: '/api/agent/chat - Chat with RAG search and tool integration',
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

