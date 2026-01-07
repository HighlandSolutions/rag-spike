'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import { UserContextForm } from './user-context-form';
import type { ChatMessage } from '@/types/chat';
import type { UserContext } from '@/types/domain';
import type { SourceCardData } from './source-card';
import { loadUserContext } from '@/lib/storage';
import { updateMessageWithStream, completeStreamingMessage } from '@/lib/streaming';
import { callAgentAPI } from '@/lib/agent/api-client';
import { fetchCitationMetadata } from '@/lib/citations/fetcher';

interface ChatContainerProps {
  // No props needed - component handles API calls directly
}

export const ChatContainer = ({}: ChatContainerProps = {}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [showUserContextForm, setShowUserContextForm] = useState(false);
  const [citationsMap, setCitationsMap] = useState<Map<string, SourceCardData[]>>(new Map());
  const streamingMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const saved = loadUserContext();
    if (saved) {
      setUserContext(saved);
    }
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      const assistantMessageId = `assistant-${Date.now()}`;
      streamingMessageIdRef.current = assistantMessageId;

      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(true);

      const handleStreamChunk = (chunk: string) => {
        setMessages((prev) => {
          if (streamingMessageIdRef.current) {
            return updateMessageWithStream(prev, streamingMessageIdRef.current, chunk);
          }
          return prev;
        });
      };

      try {
        // Call agent API with streaming
        const result = await callAgentAPI(content, userContext || undefined, handleStreamChunk);

        // Mark streaming as complete with final answer and chunk IDs
        setMessages((prev) => {
          if (streamingMessageIdRef.current) {
            return completeStreamingMessage(
              prev,
              streamingMessageIdRef.current,
              result.answer || prev.find((m) => m.id === streamingMessageIdRef.current)?.content || '',
              result.chunkIds
            );
          }
          return prev;
        });

        // Fetch citation metadata if chunk IDs are available
        if (result.chunkIds && result.chunkIds.length > 0 && streamingMessageIdRef.current) {
          const citations = await fetchCitationMetadata(result.chunkIds);
          setCitationsMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(streamingMessageIdRef.current!, citations);
            return newMap;
          });
        }
      } catch (error) {
        // Determine user-friendly error message based on error type
        let errorMessage = 'Sorry, an error occurred. Please try again.';

        if (error instanceof Error) {
          if (error.message === 'LLM_API_ERROR' || error.message.includes('LLM')) {
            errorMessage = 'The AI service is temporarily unavailable. Please try again in a moment.';
          } else if (error.message.includes('NoRelevantChunks') || error.message.includes('No relevant')) {
            errorMessage = 'No relevant information found in the knowledge base. Please try rephrasing your question.';
          } else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('Network')) {
            errorMessage = 'Network connection error. Please check your internet connection and try again.';
          } else if (error.message.includes('429') || error.message.includes('rate limit')) {
            errorMessage = 'Too many requests. Please wait a moment and try again.';
          } else {
            errorMessage = error.message || errorMessage;
          }
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: errorMessage,
                  isLoading: false,
                  error: true,
                }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
        streamingMessageIdRef.current = null;
      }
    },
    [userContext]
  );

  const handleContextChange = useCallback((context: UserContext) => {
    setUserContext(context);
    setShowUserContextForm(false);
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b p-4" role="banner">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-2xl font-bold">RAG Q&A Chat</h1>
          <button
            type="button"
            onClick={() => setShowUserContextForm(!showUserContextForm)}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded px-2 py-1"
            aria-label={showUserContextForm ? 'Hide profile form' : 'Show profile form'}
            aria-expanded={showUserContextForm}
          >
            {showUserContextForm ? 'Hide' : 'Edit'} Profile
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 gap-4 p-2 sm:p-4 transition-all duration-200">
        <div className="flex flex-1 flex-col min-w-0">
          <Card className="flex flex-1 flex-col overflow-hidden transition-shadow duration-200 hover:shadow-lg">
            <MessageList messages={messages} citationsMap={citationsMap} />
            <ChatInput
              onSendMessage={handleSendMessage}
              disabled={isLoading}
              placeholder="Ask a question..."
            />
          </Card>
        </div>

        {showUserContextForm && (
          <aside
            className="w-full sm:w-80 animate-in slide-in-from-right duration-300 md:block"
            role="complementary"
            aria-label="User profile settings"
          >
            <UserContextForm
              onContextChange={handleContextChange}
              initialContext={userContext || undefined}
            />
          </aside>
        )}
      </main>
    </div>
  );
};

