'use client';

import { SourceListItem } from './source-list-item';
import type { SourceCardData } from './source-card';

interface SourceCardsProps {
  citations: SourceCardData[];
  className?: string;
  highlightedCitation?: number | null;
}

export const SourceCards = ({ citations, className, highlightedCitation }: SourceCardsProps) => {
  if (citations.length === 0) {
    return (
      <div className={className}>
        <p className="text-sm text-muted-foreground">No sources available.</p>
      </div>
    );
  }

  const handleCitationClick = () => {
    // Scroll to citation is handled by parent component
  };

  return (
    <div className={className}>
      <div className="flex flex-col">
        {citations.map((citation) => (
          <SourceListItem
            key={citation.chunkId}
            source={citation}
            isHighlighted={highlightedCitation === citation.citationNumber}
            onClick={handleCitationClick}
          />
        ))}
      </div>
    </div>
  );
};

