'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import { UserContextForm } from './user-context-form';
import { SourceCards } from './source-cards';
import type { ChatMessage } from '@/types/chat';
import type { UserContext } from '@/types/domain';
import type { SourceCardData } from './source-card';
import { loadUserContext } from '@/lib/storage';
import { updateMessageWithStream, completeStreamingMessage } from '@/lib/streaming';
import { callAgentAPI } from '@/lib/agent/api-client';
import { fetchCitationMetadata } from '@/lib/citations/fetcher';
import {
  createChatSession,
  saveChatMessage,
  loadChatMessages,
  listChatSessions,
} from '@/lib/chat/history';

export const ChatContainer = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [showUserContextForm, setShowUserContextForm] = useState(false);
  const [citationsMap, setCitationsMap] = useState<Map<string, SourceCardData[]>>(new Map());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('answer');
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  // Load user context on mount
  useEffect(() => {
    const saved = loadUserContext();
    if (saved) {
      setUserContext(saved);
    }
  }, []);

  // Create or load chat session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Try to load the most recent session
        const sessions = await listChatSessions(1, 0);
        if (sessions.length > 0) {
          const session = sessions[0];
          setCurrentSessionId(session.id);
          const sessionMessages = await loadChatMessages(session.id);
          setMessages(sessionMessages);
          // Load citations for messages that have chunkIds
          for (const msg of sessionMessages) {
            if (msg.chunkIds && msg.chunkIds.length > 0) {
              const citations = await fetchCitationMetadata(msg.chunkIds);
              setCitationsMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(msg.id, citations);
                return newMap;
              });
            }
          }
        } else {
          // Create a new session if none exists
          const newSession = await createChatSession(userContext || undefined);
          setCurrentSessionId(newSession.id);
        }
      } catch (error) {
        console.error('Failed to initialize chat session:', error);
        // Create a new session on error
        try {
          const newSession = await createChatSession(userContext || undefined);
          setCurrentSessionId(newSession.id);
        } catch (createError) {
          console.error('Failed to create chat session:', createError);
        }
      }
    };

    initializeSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - userContext is intentionally excluded to avoid re-initialization


  const handleSendMessage = useCallback(
    async (content: string) => {
      // Ensure we have a session
      let sessionId = currentSessionId;
      if (!sessionId) {
        try {
          const newSession = await createChatSession(userContext || undefined);
          sessionId = newSession.id;
          setCurrentSessionId(sessionId);
        } catch (error) {
          console.error('Failed to create session:', error);
          return;
        }
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Save user message to database
      try {
        await saveChatMessage(sessionId, {
          role: 'user',
          content,
        });
      } catch (error) {
        console.error('Failed to save user message:', error);
      }

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
        let finalContent = '';
        setMessages((prev) => {
          if (streamingMessageIdRef.current) {
            const updated = completeStreamingMessage(
              prev,
              streamingMessageIdRef.current,
              result.answer || prev.find((m) => m.id === streamingMessageIdRef.current)?.content || '',
              result.chunkIds
            );
            const finalMsg = updated.find((m) => m.id === streamingMessageIdRef.current);
            finalContent = finalMsg?.content || '';
            return updated;
          }
          return prev;
        });

        // Save assistant message to database
        try {
          await saveChatMessage(sessionId, {
            role: 'assistant',
            content: finalContent,
            chunkIds: result.chunkIds,
            error: false,
          });
        } catch (error) {
          console.error('Failed to save assistant message:', error);
        }

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

        // Save error message to database
        try {
          await saveChatMessage(sessionId, {
            role: 'assistant',
            content: errorMessage,
            error: true,
          });
        } catch (saveError) {
          console.error('Failed to save error message:', saveError);
        }
      } finally {
        setIsLoading(false);
        streamingMessageIdRef.current = null;
      }
    },
    [userContext, currentSessionId]
  );

  const handleContextChange = useCallback((context: UserContext) => {
    setUserContext(context);
    setShowUserContextForm(false);
  }, []);

  const handleCitationClick = useCallback((citationNumber: number) => {
    setActiveTab('sources');
    setHighlightedCitation(citationNumber);
  }, []);

  // Scroll to highlighted citation when sources tab is active
  useEffect(() => {
    if (activeTab === 'sources' && highlightedCitation !== null) {
      // Wait for tab content to render
      const timeoutId = setTimeout(() => {
        const citationElement = document.getElementById(`citation-${highlightedCitation}`);
        if (citationElement) {
          citationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Remove highlight after animation completes
          setTimeout(() => {
            setHighlightedCitation(null);
          }, 2000);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [activeTab, highlightedCitation]);

  // Aggregate all sources from all messages
  const allSources = Array.from(citationsMap.values()).flat();

  // Check if there's at least one completed assistant message
  // Only show tabs when there are messages AND at least one completed assistant response
  // This ensures tabs don't show in empty state or when only user messages exist
  // Must have: role === 'assistant', not loading, and has non-empty content
  const hasCompletedAssistantMessage = (() => {
    // Explicitly return false for empty state
    if (!Array.isArray(messages) || messages.length === 0) {
      return false;
    }
    
    // Check for at least one completed assistant message
    return messages.some(
      (msg) => {
        if (msg.role !== 'assistant') return false;
        if (msg.isLoading === true) return false;
        if (!msg.content || typeof msg.content !== 'string') return false;
        if (msg.content.trim().length === 0) return false;
        return true;
      }
    );
  })();

  return (
    <div className="flex h-screen flex-col relative overflow-x-hidden w-full">
      <main className="flex flex-1 gap-4 p-2 sm:p-4 transition-all duration-200 overflow-x-hidden w-full min-w-0">
        <div className="flex flex-1 flex-col min-w-0 w-full max-w-6xl mx-auto">
          <Card className="flex flex-1 flex-col overflow-hidden transition-shadow duration-200 hover:shadow-lg">
            {hasCompletedAssistantMessage ? (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col h-full">
                <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
                  <TabsList className="w-full justify-start rounded-none bg-transparent h-auto p-0 gap-0">
                    <TabsTrigger
                      value="answer"
                      className="rounded-none data-[state=active]:bg-background data-[state=active]:shadow-none px-4 py-3 border-r border-border/50"
                    >
                      Answer
                    </TabsTrigger>
                    <TabsTrigger
                      value="sources"
                      className="rounded-none data-[state=active]:bg-background data-[state=active]:shadow-none px-4 py-3"
                    >
                      Sources
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="answer" className="flex-1 overflow-y-auto p-4 sm:p-6 mt-0">
                  <MessageList messages={messages} citationsMap={citationsMap} onCitationClick={handleCitationClick} />
                </TabsContent>
                <TabsContent 
                  value="sources" 
                  className="flex-1 overflow-y-auto p-4 sm:p-6 mt-0"
                >
                  <SourceCards citations={allSources} highlightedCitation={highlightedCitation} />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <MessageList messages={messages} citationsMap={citationsMap} onCitationClick={handleCitationClick} />
              </div>
            )}
          </Card>
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={isLoading}
            placeholder="Ask a question..."
            sidebarOpen={false}
          />
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

