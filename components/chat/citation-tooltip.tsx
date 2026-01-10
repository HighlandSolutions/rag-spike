'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import type { SourceCardData } from './source-card';

interface CitationTooltipProps {
  citation: SourceCardData;
  anchorElement: HTMLElement | null;
  isVisible: boolean;
  onClose: () => void;
}

export const CitationTooltip = ({
  citation,
  anchorElement,
  isVisible,
  onClose,
}: CitationTooltipProps) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isVisible || !anchorElement || !tooltipRef.current) {
      return;
    }

    const updatePosition = () => {
      if (!anchorElement || !tooltipRef.current) {
        return;
      }

      const rect = anchorElement.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // Position tooltip above the citation, centered horizontally
      // Using fixed positioning, so use getBoundingClientRect values directly
      const top = rect.top - tooltipRect.height - 8;
      const left = rect.left + rect.width / 2 - tooltipRect.width / 2;

      // Adjust if tooltip would go off-screen
      const viewportWidth = window.innerWidth;
      const padding = 8;

      let adjustedLeft = left;
      let adjustedTop = top;

      // Horizontal adjustments
      if (left < padding) {
        adjustedLeft = padding;
      } else if (left + tooltipRect.width > viewportWidth - padding) {
        adjustedLeft = viewportWidth - tooltipRect.width - padding;
      }

      // Vertical adjustments - if not enough space above, show below
      if (top < padding) {
        adjustedTop = rect.bottom + 8;
      }

      setPosition({ top: adjustedTop, left: adjustedLeft });
    };

    updatePosition();

    // Throttle position updates using requestAnimationFrame
    let rafId: number;
    const handleResize = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(updatePosition);
    };

    const handleScroll = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(updatePosition);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isVisible, anchorElement]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose]);

  const tooltipContent = useMemo(
    () => (
      <div
        ref={tooltipRef}
        role="tooltip"
        aria-live="polite"
        className={cn(
          'fixed z-50 max-w-xs rounded-lg border bg-popover p-3 shadow-md',
          'animate-in fade-in-0 zoom-in-95 duration-200',
          !isVisible && 'hidden'
        )}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
        onMouseEnter={(e) => {
          // Keep tooltip visible when hovering over it
          e.stopPropagation();
        }}
        onMouseLeave={() => {
          // Hide when leaving tooltip
          onClose();
        }}
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="text-sm font-semibold leading-tight text-popover-foreground">
                {citation.documentName}
              </h4>
              {citation.location && (
                <p className="mt-1 text-xs text-muted-foreground">{citation.location}</p>
              )}
            </div>
          </div>
          <p className="line-clamp-3 text-xs text-muted-foreground">{citation.snippet}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="font-medium">Source {citation.citationNumber}</span>
          </div>
        </div>
      </div>
    ),
    [citation, position, isVisible, onClose]
  );

  if (!isVisible || typeof window === 'undefined') {
    return null;
  }

  return createPortal(tooltipContent, document.body);
};

