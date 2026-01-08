'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sidebar } from '@/components/sidebar';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import { UserContextForm } from './user-context-form';
import { SourceCards } from './source-cards';
import { SourceCard } from './source-card';
import { SourceListItem } from './source-list-item';
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
  const [activeTab, setActiveTab] = useState('answer');
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

  const handleNewChat = useCallback(async () => {
    try {
      const newSession = await createChatSession(userContext || undefined);
      setCurrentSessionId(newSession.id);
      setMessages([]);
      setCitationsMap(new Map());
      setActiveTab('answer');
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  }, [userContext]);

  const handleLoadSession = useCallback(async (sessionId: string) => {
    try {
      const sessionMessages = await loadChatMessages(sessionId);
      setCurrentSessionId(sessionId);
      setMessages(sessionMessages);
      setCitationsMap(new Map());

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
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }, []);

  // Collect all sources from all messages for the Sources tab
  const allSources = useMemo(() => {
    const sources: SourceCardData[] = [];
    citationsMap.forEach((citations) => {
      sources.push(...citations);
    });
    // Remove duplicates based on chunkId
    const uniqueSources = Array.from(
      new Map(sources.map((source) => [source.chunkId, source])).values()
    );
    return uniqueSources;
  }, [citationsMap]);

  // Handle citation click - switch to sources tab and scroll to citation
  const handleCitationClick = useCallback((citationNumber: number) => {
    setActiveTab('sources');
    setHighlightedCitation(citationNumber);
    // Use setTimeout to ensure tab switch completes before scrolling
    setTimeout(() => {
      const citationId = `citation-${citationNumber}`;
      const citationElement = document.getElementById(citationId);
      if (citationElement) {
        citationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add highlight effect
        citationElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        setTimeout(() => {
          citationElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          setHighlightedCitation(null);
        }, 2000);
      }
    }, 100);
  }, []);

  return (
    <div className="flex h-screen flex-col relative">
      {/* Sidebar */}
      <Sidebar
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onLoadSession={handleLoadSession}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col h-full overflow-hidden ml-16">
        {messages.length > 0 && (
          <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-4" role="banner">
            <div className="mx-auto flex max-w-[70ch] items-center justify-between">
              <TabsList>
                <TabsTrigger value="answer">Answer</TabsTrigger>
                <TabsTrigger value="sources">Sources</TabsTrigger>
              </TabsList>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-y-auto flex flex-col">
          <div className="mx-auto flex w-full max-w-[70ch] gap-4 p-2 sm:p-4 transition-all duration-200 flex-1">
            <div className="flex flex-1 flex-col min-w-0">
              <TabsContent value="answer" className="flex flex-1 flex-col m-0 min-h-0 relative">
                <MessageList 
                  messages={messages} 
                  citationsMap={citationsMap} 
                  onCitationClick={handleCitationClick}
                  onExampleQuestionClick={handleSendMessage}
                />
              </TabsContent>
              <TabsContent value="sources" className="flex flex-col m-0 p-4">
                {allSources.length === 0 ? (
                  <div className="flex h-full items-center justify-center" role="status" aria-label="No sources">
                    <div className="text-center animate-in fade-in duration-300">
                      <p className="text-lg font-medium text-muted-foreground">
                        No sources available
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Sources will appear here after you ask a question
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-semibold mb-2">All Sources</h2>
                    <div className="flex flex-col gap-3">
                      {allSources.map((source) => (
                        <SourceListItem
                          key={source.chunkId}
                          source={source}
                          isHighlighted={highlightedCitation === source.citationNumber}
                          onClick={() => {
                            const element = document.getElementById(`citation-${source.citationNumber}`);
                            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
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
          </div>
        </main>
      </Tabs>
    </div>
  );
};

