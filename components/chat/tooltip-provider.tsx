'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { CitationTooltip } from './citation-tooltip';
import type { SourceCardData } from './source-card';

interface TooltipProviderProps {
  children: React.ReactNode;
  citations: SourceCardData[];
  containerElement: HTMLElement | null;
}

export const TooltipProvider = ({
  children,
  citations,
  containerElement,
}: TooltipProviderProps) => {
  const [activeCitation, setActiveCitation] = useState<{
    citation: SourceCardData;
    anchorElement: HTMLElement;
  } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const createCitationMap = useCallback(() => {
    const map = new Map<number, SourceCardData>();
    citations.forEach((citation) => {
      map.set(citation.citationNumber, citation);
    });
    return map;
  }, [citations]);

  const citationMap = useRef(createCitationMap());

  useEffect(() => {
    citationMap.current = createCitationMap();
  }, [createCitationMap]);

  const handleShowTooltip = useCallback(
    (citationNumber: number, anchorElement: HTMLElement) => {
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      // Debounce hover with 150ms delay to reduce flicker
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      hoverTimeoutRef.current = setTimeout(() => {
        const citation = citationMap.current.get(citationNumber);
        if (citation) {
          setActiveCitation({ citation, anchorElement });
        }
      }, 150);
    },
    []
  );

  const handleHideTooltip = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Small delay before hiding to allow moving cursor to tooltip
    hideTimeoutRef.current = setTimeout(() => {
      setActiveCitation(null);
    }, 200);
  }, []);

  // Set up event listeners when container element is available
  useEffect(() => {
    if (!containerElement) {
      return;
    }

    const container = containerElement;

      // Event delegation for hover
      const handleMouseOver = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const citationLink = target.closest('.citation-link') as HTMLElement;
        if (citationLink) {
          const citationNumber = citationLink.getAttribute('data-citation');
          if (citationNumber) {
            const num = parseInt(citationNumber, 10);
            handleShowTooltip(num, citationLink);
          }
        }
      };

      const handleMouseOut = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const citationLink = target.closest('.citation-link') as HTMLElement;
        const relatedTarget = event.relatedTarget as HTMLElement;
        
        // Don't hide if moving to tooltip
        if (relatedTarget?.closest('[role="tooltip"]')) {
          return;
        }
        
        if (citationLink) {
          handleHideTooltip();
        }
      };

      // Keyboard support for accessibility
      const handleFocus = (event: FocusEvent) => {
        const target = event.target as HTMLElement;
        const citationLink = target.closest('.citation-link') as HTMLElement;
        if (citationLink) {
          const citationNumber = citationLink.getAttribute('data-citation');
          if (citationNumber) {
            const num = parseInt(citationNumber, 10);
            handleShowTooltip(num, citationLink);
          }
        }
      };

      const handleBlur = (event: FocusEvent) => {
        const target = event.target as HTMLElement;
        const citationLink = target.closest('.citation-link') as HTMLElement;
        if (citationLink) {
          handleHideTooltip();
        }
      };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);
    container.addEventListener('focus', handleFocus, true);
    container.addEventListener('blur', handleBlur, true);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
      container.removeEventListener('focus', handleFocus, true);
      container.removeEventListener('blur', handleBlur, true);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [containerElement, handleShowTooltip, handleHideTooltip]);

  const handleClose = useCallback(() => {
    setActiveCitation(null);
  }, []);

  return (
    <>
      {children}
      {activeCitation && (
        <CitationTooltip
          citation={activeCitation.citation}
          anchorElement={activeCitation.anchorElement}
          isVisible={true}
          onClose={handleClose}
        />
      )}
    </>
  );
};

