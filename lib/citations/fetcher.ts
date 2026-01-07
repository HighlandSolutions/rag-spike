/**
 * Citation metadata fetcher
 * Fetches chunk metadata for citation display
 */

import type { SourceCardData } from '@/components/chat/source-card';

interface CitationMetadata {
  chunkId: string;
  documentName: string;
  location?: string;
  snippet: string;
  contentType: string;
}

/**
 * Fetch citation metadata for given chunk IDs
 */
export const fetchCitationMetadata = async (
  chunkIds: string[]
): Promise<SourceCardData[]> => {
  if (chunkIds.length === 0) {
    return [];
  }

  try {
    const chunkIdsParam = chunkIds.join(',');
    const response = await fetch(`/api/citations/metadata?chunkIds=${chunkIdsParam}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch citation metadata: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.citations || !Array.isArray(data.citations)) {
      return [];
    }

    // Create a map of chunkId to citation number based on the order in chunkIds
    // This ensures citation numbers match the order used in the prompt ([1], [2], etc.)
    const citationNumberMap = new Map<string, number>();
    chunkIds.forEach((chunkId, index) => {
      citationNumberMap.set(chunkId, index + 1);
    });

    // Create a map of chunkId to citation data for quick lookup
    const citationDataMap = new Map<string, CitationMetadata>();
    data.citations.forEach((citation: CitationMetadata) => {
      citationDataMap.set(citation.chunkId, citation);
    });

    // Build citations array in the same order as chunkIds
    const citations: SourceCardData[] = chunkIds
      .map((chunkId) => {
        const citationData = citationDataMap.get(chunkId);
        if (!citationData) {
          return null;
        }
        const citationNumber = citationNumberMap.get(chunkId) || 1;
        return {
          chunkId: citationData.chunkId,
          documentName: citationData.documentName,
          location: citationData.location,
          snippet: citationData.snippet,
          contentType: citationData.contentType,
          citationNumber,
        };
      })
      .filter((citation): citation is SourceCardData => citation !== null);

    return citations;
  } catch (error) {
    console.error('Error fetching citation metadata:', error);
    return [];
  }
};

