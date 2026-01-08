'use client';

import { useEffect, useRef } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import type { ChatMessage } from '@/types/chat';
import type { SourceCardData } from './source-card';

interface MessageListProps {
  messages: ChatMessage[];
  citationsMap?: Map<string, SourceCardData[]>;
  onCitationClick?: (citationNumber: number) => void;
  onExampleQuestionClick?: (question: string) => void;
}

const EXAMPLE_QUESTIONS = [
  'What documents are available?',
  'Summarize the key points',
  'Explain this in detail',
];

export const MessageList = ({ messages, citationsMap = new Map(), onCitationClick, onExampleQuestionClick }: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Empty chat">
        <div className="w-full text-center animate-in fade-in duration-300">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/5 rounded-full blur-xl" />
              <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 rounded-full p-6 border border-primary/10">
                <MessageSquare className="w-12 h-12 text-primary/60" strokeWidth={1.5} />
              </div>
            </div>
          </div>
          
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            Start a conversation
          </h2>
          
          <p className="text-base text-muted-foreground mb-8 max-w-md mx-auto">
            Ask a question to get started. I can help you find information from your documents.
          </p>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              Try asking:
            </p>
            <div className="flex flex-col gap-2 items-center">
              {EXAMPLE_QUESTIONS.map((question, index) => (
                <div
                  key={index}
                  className="group w-full max-w-md"
                >
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/20 transition-all duration-200 text-sm text-foreground/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    onClick={() => onExampleQuestionClick?.(question)}
                    aria-label={`Example question: ${question}`}
                  >
                    {question}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8" role="log" aria-label="Chat messages">
      {messages.map((message, index) => {
        const citations = citationsMap.get(message.id) || [];
        return (
          <div
            key={message.id}
            className="animate-in fade-in slide-in-from-bottom-2 duration-200"
            style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
          >
            <MessageBubble message={message} citations={citations} onCitationClick={onCitationClick} />
          </div>
        );
      })}
      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
};

