'use client';

import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SourceCardData } from './source-card';

interface SourceListItemProps {
  source: SourceCardData;
  isHighlighted?: boolean;
  onClick?: () => void;
}

const getSourceIcon = (contentType: string, location?: string) => {
  if (location) {
    const url = location.toLowerCase();
    if (url.includes('reddit.com')) {
      return (
        <div className="h-5 w-5 rounded bg-orange-500 flex items-center justify-center text-white text-[10px] font-bold">
          r
        </div>
      );
    }
    if (url.includes('dev.to') || url.includes('devto')) {
      return (
        <div className="h-5 w-5 rounded-full bg-black flex items-center justify-center text-white text-[8px] font-bold">
          DEV
        </div>
      );
    }
    if (url.includes('github.com')) {
      return (
        <div className="h-5 w-5 rounded bg-gray-800 flex items-center justify-center text-white text-[10px]">
          GH
        </div>
      );
    }
    if (url.includes('cieden.com')) {
      return (
        <div className="h-5 w-5 rounded-full bg-purple-500 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-white/20" />
        </div>
      );
    }
    if (url.includes('uxplanet.org')) {
      return (
        <div className="h-5 w-5 rounded bg-black flex items-center justify-center text-white text-[10px] font-bold">
          M
        </div>
      );
    }
  }
  return <FileText className="h-5 w-5 text-muted-foreground" />;
};

const truncateUrl = (url: string, maxLength: number = 50) => {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
};

export const SourceListItem = ({ source, isHighlighted, onClick }: SourceListItemProps) => {
  const citationId = `citation-${source.citationNumber}`;
  const displayUrl = source.location || '';
  const truncatedUrl = displayUrl ? truncateUrl(displayUrl) : '';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  };

  const handleUrlClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayUrl && (displayUrl.startsWith('http://') || displayUrl.startsWith('https://'))) {
      window.open(displayUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      id={citationId}
      className={cn(
        'flex gap-3 p-4 rounded-lg border bg-card transition-all hover:bg-muted/50 cursor-pointer',
        isHighlighted && 'ring-2 ring-primary ring-offset-2 bg-primary/5'
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={`Source ${source.citationNumber}: ${source.documentName}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getSourceIcon(source.contentType, source.location)}
      </div>
      <div className="flex-1 min-w-0">
        {displayUrl && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <button
              onClick={handleUrlClick}
              className="text-xs text-muted-foreground truncate hover:text-foreground hover:underline transition-colors text-left"
              type="button"
            >
              {truncatedUrl}
            </button>
          </div>
        )}
        <h4 className="text-sm font-semibold leading-tight text-foreground mb-1.5 line-clamp-2">
          {source.documentName}
        </h4>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {source.snippet}
        </p>
      </div>
    </div>
  );
};

