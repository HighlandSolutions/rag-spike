'use client';

import { useEffect, useRef } from 'react';
import { MessageBubble } from './message-bubble';
import type { ChatMessage } from '@/types/chat';
import type { SourceCardData } from './source-card';

interface MessageListProps {
  messages: ChatMessage[];
  citationsMap?: Map<string, SourceCardData[]>;
}

export const MessageList = ({ messages, citationsMap = new Map() }: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center" role="status" aria-label="Empty chat">
        <div className="text-center animate-in fade-in duration-300">
          <p className="text-lg font-medium text-muted-foreground">
            Start a conversation
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask a question to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 sm:gap-4 overflow-y-auto p-2 sm:p-4" role="log" aria-label="Chat messages">
      {messages.map((message, index) => {
        const citations = citationsMap.get(message.id) || [];
        return (
          <div
            key={message.id}
            className="animate-in fade-in slide-in-from-bottom-2 duration-200"
            style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
          >
            <MessageBubble message={message} citations={citations} />
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};

