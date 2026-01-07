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
      } catch {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: 'Sorry, an error occurred. Please try again.',
                  isLoading: false,
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
      <div className="border-b p-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-2xl font-bold">RAG Q&A Chat</h1>
          <button
            type="button"
            onClick={() => setShowUserContextForm(!showUserContextForm)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {showUserContextForm ? 'Hide' : 'Edit'} Profile
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-4 p-4">
        <div className="flex flex-1 flex-col">
          <Card className="flex flex-1 flex-col overflow-hidden">
            <MessageList messages={messages} citationsMap={citationsMap} />
            <ChatInput
              onSendMessage={handleSendMessage}
              disabled={isLoading}
              placeholder="Ask a question..."
            />
          </Card>
        </div>

        {showUserContextForm && (
          <div className="w-80">
            <UserContextForm
              onContextChange={handleContextChange}
              initialContext={userContext || undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
};

