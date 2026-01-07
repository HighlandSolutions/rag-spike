'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { SourceCards } from './source-cards';
import type { SourceCardData } from './source-card';
import type { ChatMessage } from '@/types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  citations?: SourceCardData[];
}

export const MessageBubble = ({ message, citations = [] }: MessageBubbleProps) => {
  const isUser = message.role === 'user';
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current || isUser || citations.length === 0) {
      return;
    }

    const handleCitationClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const citationLink = target.closest('.citation-link') as HTMLElement;
      if (citationLink) {
        event.preventDefault();
        const citationNumber = citationLink.getAttribute('data-citation');
        if (citationNumber) {
          const citationId = `citation-${citationNumber}`;
          const citationElement = document.getElementById(citationId);
          if (citationElement) {
            citationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a highlight effect
            citationElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
            setTimeout(() => {
              citationElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
            }, 2000);
          }
        }
      }
    };

    contentRef.current.addEventListener('click', handleCitationClick);
    return () => {
      contentRef.current?.removeEventListener('click', handleCitationClick);
    };
  }, [isUser, citations]);

  const hasCitations = !isUser && citations.length > 0;

  return (
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
            ref={contentRef}
            className={cn(
              'whitespace-pre-wrap break-words',
              !isUser && !message.error && '[&_.citation-link]:cursor-pointer [&_.citation-link]:font-semibold [&_.citation-link]:text-primary [&_.citation-link]:underline [&_.citation-link]:decoration-dotted [&_.citation-link]:underline-offset-2 [&_.citation-link]:transition-opacity [&_.citation-link]:hover:opacity-80'
            )}
            dangerouslySetInnerHTML={{
              __html: message.error
                ? message.content
                : message.content.replace(
                    /\[(\d+)\]/g,
                    (match, num) =>
                      `<sup><a href="#citation-${num}" class="citation-link" data-citation="${num}" aria-label="Citation ${num}">${match}</a></sup>`
                  ),
            }}
          />
        )}
      </div>
      {hasCitations && (
        <div className="mt-2 w-full max-w-[80%]">
          <SourceCards citations={citations} />
        </div>
      )}
    </div>
  );
};

