'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  createChatSession,
  saveChatMessage,
  loadChatMessages,
  listChatSessions,
  type ChatSession,
} from '@/lib/chat/history';

export const ChatContainer = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [showUserContextForm, setShowUserContextForm] = useState(false);
  const [citationsMap, setCitationsMap] = useState<Map<string, SourceCardData[]>>(new Map());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [showSessionList, setShowSessionList] = useState(false);
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
  }, []); // Only run on mount

  // Load chat sessions list
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessions = await listChatSessions(20, 0);
        setChatSessions(sessions);
      } catch (error) {
        console.error('Failed to load chat sessions:', error);
      }
    };

    if (showSessionList) {
      loadSessions();
    }
  }, [showSessionList]);

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
      setShowSessionList(false);
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
      setShowSessionList(false);

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

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b p-4" role="banner">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-2xl font-bold">RAG Q&A Chat</h1>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              aria-label="Start new chat"
            >
              New Chat
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSessionList(!showSessionList)}
              aria-label={showSessionList ? 'Hide chat history' : 'Show chat history'}
              aria-expanded={showSessionList}
            >
              {showSessionList ? 'Hide' : 'History'}
            </Button>
            <Link
              href="/documents"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded px-2 py-1"
            >
              Documents
            </Link>
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
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 gap-4 p-2 sm:p-4 transition-all duration-200">
        {showSessionList && (
          <aside
            className="w-full sm:w-64 animate-in slide-in-from-left duration-300"
            role="complementary"
            aria-label="Chat history"
          >
            <Card className="p-4 h-full overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4">Chat History</h2>
              {chatSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No previous chats</p>
              ) : (
                <ul className="space-y-2">
                  {chatSessions.map((session) => (
                    <li key={session.id}>
                      <button
                        type="button"
                        onClick={() => handleLoadSession(session.id)}
                        className={`w-full text-left p-2 rounded text-sm transition-colors ${
                          currentSessionId === session.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                        aria-label={`Load chat: ${session.title || 'Untitled'}`}
                      >
                        <div className="font-medium truncate">
                          {session.title || 'Untitled Chat'}
                        </div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(session.updated_at).toLocaleDateString()}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </aside>
        )}

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

