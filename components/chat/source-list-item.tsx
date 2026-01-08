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
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return (
        <div className="h-5 w-5 rounded bg-red-600 flex items-center justify-center text-white">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
      );
    }
    if (url.includes('reddit.com')) {
      return (
        <div className="h-5 w-5 rounded bg-orange-500 flex items-center justify-center text-white text-[10px] font-bold">
          r
        </div>
      );
    }
    if (url.includes('facebook.com')) {
      return (
        <div className="h-5 w-5 rounded bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
          f
        </div>
      );
    }
    if (url.includes('forum.cursor')) {
      return (
        <div className="h-5 w-5 rounded bg-gray-700 flex items-center justify-center text-white">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
          </svg>
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

const getSourceName = (location?: string): string => {
  if (!location) return '';
  try {
    const url = new URL(location);
    const hostname = url.hostname.replace('www.', '');
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('reddit.com')) return 'reddit';
    if (hostname.includes('facebook.com')) return 'facebook';
    if (hostname.includes('forum.cursor')) return 'forum.cursor';
    if (hostname.includes('dev.to')) return 'dev.to';
    if (hostname.includes('github.com')) return 'github';
    return hostname;
  } catch {
    return location;
  }
};

const truncateUrl = (url: string, maxLength: number = 60) => {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
};

export const SourceListItem = ({ source, isHighlighted, onClick }: SourceListItemProps) => {
  const citationId = `citation-${source.citationNumber}`;
  const displayUrl = source.location || '';
  const sourceName = getSourceName(displayUrl);
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
        'flex gap-3 py-3 px-0 border-b border-border/50 transition-colors hover:bg-muted/30',
        isHighlighted && 'bg-primary/5 border-l-4 border-l-primary pl-2'
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
        <div className="flex items-center gap-2 mb-1">
          {sourceName && (
            <span className="text-xs text-muted-foreground font-medium">{sourceName}</span>
          )}
          {displayUrl && (
            <button
              onClick={handleUrlClick}
              className="text-xs text-muted-foreground truncate hover:text-foreground hover:underline transition-colors text-left max-w-md"
              type="button"
            >
              {truncatedUrl}
            </button>
          )}
        </div>
        <h4 className="text-sm font-semibold leading-snug text-foreground mb-1.5 line-clamp-2 hover:text-primary transition-colors">
          {source.documentName}
        </h4>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {source.snippet}
        </p>
      </div>
    </div>
  );
};

