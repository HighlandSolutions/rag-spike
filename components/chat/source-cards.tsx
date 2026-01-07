'use client';

import { SourceCard, type SourceCardData } from './source-card';

interface SourceCardsProps {
  citations: SourceCardData[];
  className?: string;
}

export const SourceCards = ({ citations, className }: SourceCardsProps) => {
  if (citations.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="mb-2 text-xs font-medium text-muted-foreground">Sources</div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {citations.map((citation) => (
          <SourceCard key={citation.chunkId} citation={citation} />
        ))}
      </div>
    </div>
  );
};

