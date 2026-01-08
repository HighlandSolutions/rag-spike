'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { TooltipProvider } from './tooltip-provider';
import type { SourceCardData } from './source-card';
import type { ChatMessage } from '@/types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  citations?: SourceCardData[];
  onCitationClick?: (citationNumber: number) => void;
}

export const MessageBubble = ({ message, citations = [], onCitationClick }: MessageBubbleProps) => {
  const isUser = message.role === 'user';
  const contentRef = useRef<HTMLDivElement>(null);
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement || isUser || citations.length === 0 || !onCitationClick) {
      return;
    }

    const handleCitationClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const citationLink = target.closest('.citation-link') as HTMLElement;
      if (citationLink) {
        event.preventDefault();
        const citationNumber = citationLink.getAttribute('data-citation');
        if (citationNumber) {
          onCitationClick(parseInt(citationNumber, 10));
        }
      }
    };

    contentElement.addEventListener('click', handleCitationClick);
    return () => {
      contentElement.removeEventListener('click', handleCitationClick);
    };
  }, [isUser, citations, onCitationClick]);

  const formatMessageContent = (content: string): string => {
    // Convert markdown bold (**text**) to HTML <strong> tags
    let formatted = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Process citations after markdown formatting
    formatted = formatted.replace(
      /\[(\d+)\]/g,
      (match, num) =>
        `<sup><a href="#citation-${num}" class="citation-link" data-citation="${num}" aria-label="Citation ${num}">${match}</a></sup>`
    );
    return formatted;
  };

  return (
    <TooltipProvider citations={citations} containerElement={containerElement}>
      <div
        className={cn(
          'flex w-full flex-col',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'max-w-[85%] sm:max-w-[80%] rounded-lg px-3 py-2 sm:px-4 sm:py-3 transition-all duration-200',
            isUser
              ? 'bg-primary text-primary-foreground'
              : message.error
                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                : 'bg-muted text-muted-foreground'
          )}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2" role="status" aria-label="Loading response">
              <div className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-current" />
            </div>
          ) : (
            <div
              ref={(node) => {
                contentRef.current = node;
                setContainerElement(node);
              }}
              className={cn(
                'whitespace-pre-wrap break-words',
                !isUser && !message.error && '[&_.citation-link]:cursor-pointer [&_.citation-link]:font-semibold [&_.citation-link]:text-primary [&_.citation-link]:underline [&_.citation-link]:decoration-dotted [&_.citation-link]:underline-offset-2 [&_.citation-link]:transition-opacity [&_.citation-link]:hover:opacity-80'
              )}
              dangerouslySetInnerHTML={{
                __html: message.error ? message.content : formatMessageContent(message.content),
              }}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

