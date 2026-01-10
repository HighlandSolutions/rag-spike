'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface SourceCardData {
  chunkId: string;
  documentName: string;
  location?: string;
  snippet: string;
  contentType: string;
  citationNumber: number;
}

interface SourceCardProps {
  citation: SourceCardData;
  className?: string;
  isHighlighted?: boolean;
}

export const SourceCard = ({ citation, className, isHighlighted }: SourceCardProps) => {
  const citationId = `citation-${citation.citationNumber}`;

  return (
    <Card
      id={citationId}
      className={cn(
        'flex min-w-[280px] max-w-[70ch] flex-col gap-2 p-4 transition-shadow hover:shadow-md',
        isHighlighted && 'ring-2 ring-primary ring-offset-2',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h4 className="text-sm font-semibold leading-tight">{citation.documentName}</h4>
          {citation.location && (
            <p className="mt-1 text-xs text-muted-foreground">{citation.location}</p>
          )}
        </div>
      </div>
      <p className="line-clamp-3 text-xs text-muted-foreground">{citation.snippet}</p>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="font-medium">Source {citation.citationNumber}</span>
      </div>
    </Card>
  );
};

