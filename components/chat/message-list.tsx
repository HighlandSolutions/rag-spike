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
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
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
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {messages.map((message) => {
        const citations = citationsMap.get(message.id) || [];
        return (
          <MessageBubble
            key={message.id}
            message={message}
            citations={citations}
          />
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};

