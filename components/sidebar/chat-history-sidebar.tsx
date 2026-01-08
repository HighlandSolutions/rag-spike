'use client';

import { useState, useEffect } from 'react';
import { User, Bot } from 'lucide-react';
import { loadChatMessages, type ChatSession } from '@/lib/chat/history';
import type { ChatMessage } from '@/types/chat';

interface ChatHistorySidebarProps {
  session: ChatSession;
  onDelete?: (sessionId: string) => void;
  onRename?: (sessionId: string) => void;
}

export const ChatHistorySidebar = ({ session, onDelete, onRename }: ChatHistorySidebarProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true);
        const sessionMessages = await loadChatMessages(session.id);
        setMessages(sessionMessages);
      } catch (error) {
        console.error('Failed to load chat messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [session.id]);

  const formatMessagePreview = (content: string, maxLength = 100): string => {
    if (content.length <= maxLength) {
      return content;
    }
    return `${content.slice(0, maxLength)}...`;
  };

  return (
    <div className="fixed left-80 top-0 h-screen w-80 bg-background border-r shadow-lg z-50 animate-in slide-in-from-left duration-200">
      <div className="h-full flex flex-col">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No messages in this chat
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {messages.map((message) => {
                const isUser = message.role === 'user';
                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isUser ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={`flex-1 min-w-0 ${isUser ? 'text-right' : 'text-left'}`}
                    >
                      <div
                        className={`inline-block rounded-lg px-3 py-2 text-sm ${
                          isUser
                            ? 'bg-primary text-primary-foreground'
                            : message.error
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {formatMessagePreview(message.content)}
                        </p>
                      </div>
                      {message.timestamp && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

