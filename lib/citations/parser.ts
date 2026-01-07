/**
 * Citation parser utilities
 * Parses answer text for citation markers and extracts citation references
 */

export interface CitationMarker {
  index: number;
  citationNumber: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Parse citation markers from text (e.g., [1], [2], etc.)
 * Returns array of citation markers with their positions
 */
export const parseCitationMarkers = (text: string): CitationMarker[] => {
  const citationRegex = /\[(\d+)\]/g;
  const markers: CitationMarker[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = citationRegex.exec(text)) !== null) {
    const citationNumber = parseInt(match[1], 10);
    markers.push({
      index,
      citationNumber,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
    index += 1;
  }

  return markers;
};

/**
 * Replace citation markers with clickable superscript elements
 * Returns the HTML string with citation markers replaced
 */
export const replaceCitationMarkers = (
  text: string,
  markers: CitationMarker[],
  onCitationClick: (citationNumber: number) => void
): string => {
  if (markers.length === 0) {
    return text;
  }

  // Process markers in reverse order to maintain indices
  let result = text;
  for (let i = markers.length - 1; i >= 0; i--) {
    const marker = markers[i];
    const citationId = `citation-${marker.citationNumber}`;
    const replacement = `<sup><a href="#${citationId}" class="citation-link" data-citation="${marker.citationNumber}" style="text-decoration: none; color: inherit; cursor: pointer; font-weight: 600;">[${marker.citationNumber}]</a></sup>`;
    result =
      result.substring(0, marker.startIndex) +
      replacement +
      result.substring(marker.endIndex);
  }

  return result;
};

/**
 * Extract unique citation numbers from markers
 */
export const extractCitationNumbers = (markers: CitationMarker[]): number[] => {
  const numbers = new Set(markers.map((marker) => marker.citationNumber));
  return Array.from(numbers).sort((a, b) => a - b);
};

