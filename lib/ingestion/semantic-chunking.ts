/**
 * Semantic chunking utilities
 * Uses embeddings to identify semantic boundaries and create more meaningful chunks
 */

import { generateEmbeddings } from './embeddings';
import type { ChunkMetadata } from '@/types/domain';
import type { TextChunk } from './chunking';

/**
 * Semantic chunking configuration
 */
export interface SemanticChunkingConfig {
  minChunkSize: number; // Minimum chunk size in characters
  maxChunkSize: number; // Maximum chunk size in characters
  targetChunkSize: number; // Target chunk size in characters
  overlap: number; // Overlap size in characters
  similarityThreshold: number; // Threshold for semantic boundary detection (0-1)
  enableAdaptiveSizing: boolean; // Enable adaptive chunk sizes based on content density
  enableHierarchicalChunking: boolean; // Enable hierarchical chunk structure
  enableContentAwareChunking: boolean; // Enable content-aware chunking for special types
  embeddingModel?: string; // Embedding model to use
  batchSize?: number; // Batch size for embedding generation
}

/**
 * Default semantic chunking configuration
 */
const DEFAULT_CONFIG: SemanticChunkingConfig = {
  minChunkSize: 500, // ~125 tokens
  maxChunkSize: 4000, // ~1000 tokens
  targetChunkSize: 2000, // ~500 tokens
  overlap: 200, // ~50 tokens
  similarityThreshold: 0.7, // Split at points with similarity < 0.7
  enableAdaptiveSizing: true,
  enableHierarchicalChunking: true,
  enableContentAwareChunking: true,
  embeddingModel: process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-3-small',
  batchSize: 50, // Smaller batch for semantic analysis
};

/**
 * Content type for chunking strategy
 */
export type ChunkingContentType = 'text' | 'table' | 'list' | 'code' | 'header' | 'mixed';

/**
 * Text segment with position information
 */
interface TextSegment {
  text: string;
  startIndex: number;
  endIndex: number;
  type: ChunkingContentType;
}

/**
 * Semantic boundary candidate
 * @deprecated Not currently used, kept for potential future use
 */
// interface BoundaryCandidate {
//   position: number;
//   similarity: number;
//   segment1: string;
//   segment2: string;
// }

/**
 * Hierarchical chunk structure
 */
export interface HierarchicalChunk extends TextChunk {
  level: number; // 0 = document, 1 = section, 2 = paragraph, 3 = sentence
  parentChunkIndex?: number; // Index of parent chunk
  childChunkIndices?: number[]; // Indices of child chunks
}

/**
 * Calculate cosine similarity between two vectors
 */
const cosineSimilarity = (vec1: number[], vec2: number[]): number => {
  if (vec1.length !== vec2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
};

/**
 * Detect content type of a text segment
 */
const detectContentType = (text: string): ChunkingContentType => {
  const trimmed = text.trim();

  // Check for code blocks
  if (trimmed.includes('```') || trimmed.match(/^\s*(function|const|let|var|class|import|export)\s/)) {
    return 'code';
  }

  // Check for tables (multiple lines with separators)
  if (trimmed.includes('|') && trimmed.split('\n').length > 2) {
    return 'table';
  }

  // Check for lists
  if (trimmed.match(/^[\s]*[-*•]\s/m) || trimmed.match(/^[\s]*\d+[.)]\s/m)) {
    return 'list';
  }

  // Check for headers
  if (trimmed.match(/^#{1,6}\s/) || trimmed.match(/^[A-Z][^.!?]*$/)) {
    return 'header';
  }

  return 'text';
};

/**
 * Split text into segments (sentences, paragraphs, etc.)
 */
const splitIntoSegments = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  let currentIndex = 0;

  // Split by paragraphs first (double newlines)
  const paragraphs = text.split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    const paragraphStart = currentIndex;
    const paragraphEnd = currentIndex + paragraph.length;
    const contentType = detectContentType(paragraph);

    // For code blocks, keep them intact
    if (contentType === 'code') {
      segments.push({
        text: paragraph,
        startIndex: paragraphStart,
        endIndex: paragraphEnd,
        type: contentType,
      });
      currentIndex = paragraphEnd + 2; // +2 for the double newline
      continue;
    }

    // For tables, keep them intact
    if (contentType === 'table') {
      segments.push({
        text: paragraph,
        startIndex: paragraphStart,
        endIndex: paragraphEnd,
        type: contentType,
      });
      currentIndex = paragraphEnd + 2;
      continue;
    }

    // For lists, split by list items but keep items together
    if (contentType === 'list') {
      const listItems = paragraph.split(/(?=^[\s]*[-*•]\s|^[\s]*\d+[.)]\s)/m);
      for (const item of listItems) {
        if (item.trim()) {
          segments.push({
            text: item.trim(),
            startIndex: paragraphStart + paragraph.indexOf(item),
            endIndex: paragraphStart + paragraph.indexOf(item) + item.length,
            type: contentType,
          });
        }
      }
      currentIndex = paragraphEnd + 2;
      continue;
    }

    // For regular text, split by sentences
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      if (sentence.trim()) {
        const sentenceStart = paragraphStart + paragraph.indexOf(sentence);
        segments.push({
          text: sentence.trim(),
          startIndex: sentenceStart,
          endIndex: sentenceStart + sentence.length,
          type: contentType,
        });
      }
    }

    currentIndex = paragraphEnd + 2;
  }

  return segments;
};

/**
 * Find semantic boundaries using embeddings
 */
const findSemanticBoundaries = async (
  segments: TextSegment[],
  config: SemanticChunkingConfig
): Promise<number[]> => {
  if (segments.length < 2) {
    return [];
  }

  const boundaries: number[] = [];
  const candidatePairs: Array<{ segment1: string; segment2: string; index: number }> = [];

  // Create candidate pairs for adjacent segments
  for (let i = 0; i < segments.length - 1; i++) {
    const segment1 = segments[i];
    const segment2 = segments[i + 1];

    // Skip if segments are too small
    if (segment1.text.length < 10 || segment2.text.length < 10) {
      continue;
    }

    candidatePairs.push({
      segment1: segment1.text,
      segment2: segment2.text,
      index: i,
    });
  }

  if (candidatePairs.length === 0) {
    return [];
  }

  // Generate embeddings for all segments in batches
  const allTexts: string[] = [];
  const textToIndex: Map<string, number> = new Map();

  for (const pair of candidatePairs) {
    if (!textToIndex.has(pair.segment1)) {
      textToIndex.set(pair.segment1, allTexts.length);
      allTexts.push(pair.segment1);
    }
    if (!textToIndex.has(pair.segment2)) {
      textToIndex.set(pair.segment2, allTexts.length);
      allTexts.push(pair.segment2);
    }
  }

  // Generate embeddings
  const embeddings = await generateEmbeddings(allTexts, {
    model: config.embeddingModel,
    batchSize: config.batchSize,
  });

  // Calculate similarities and find boundaries
  for (const pair of candidatePairs) {
    const idx1 = textToIndex.get(pair.segment1) ?? -1;
    const idx2 = textToIndex.get(pair.segment2) ?? -1;

    if (idx1 === -1 || idx2 === -1) {
      continue;
    }

    const embedding1 = embeddings[idx1];
    const embedding2 = embeddings[idx2];

    if (!embedding1 || !embedding2) {
      continue;
    }

    const similarity = cosineSimilarity(embedding1, embedding2);

    // If similarity is below threshold, this is a semantic boundary
    if (similarity < config.similarityThreshold) {
      boundaries.push(pair.index + 1); // Boundary is after segment at index i
    }
  }

  return boundaries;
};

/**
 * Calculate content density (tokens per character)
 */
const calculateContentDensity = (text: string): number => {
  // Simple heuristic: count technical terms, numbers, special characters
  const technicalTerms = (text.match(/\b(function|class|interface|type|const|let|var|import|export|async|await|return|if|else|for|while|try|catch|throw|new|this|super)\b/gi) || []).length;
  const numbers = (text.match(/\d+/g) || []).length;
  const specialChars = (text.match(/[{}[\]();,=<>!&|]/g) || []).length;
  const totalChars = text.length;

  if (totalChars === 0) {
    return 0;
  }

  // Higher density = more technical content
  return (technicalTerms * 10 + numbers * 2 + specialChars) / totalChars;
};

/**
 * Determine adaptive chunk size based on content density
 */
const getAdaptiveChunkSize = (text: string, config: SemanticChunkingConfig): number => {
  if (!config.enableAdaptiveSizing) {
    return config.targetChunkSize;
  }

  const density = calculateContentDensity(text);

  // Dense technical content: smaller chunks
  if (density > 0.1) {
    return Math.max(config.minChunkSize, config.targetChunkSize * 0.7);
  }

  // Narrative/descriptive content: larger chunks
  if (density < 0.02) {
    return Math.min(config.maxChunkSize, config.targetChunkSize * 1.3);
  }

  // Default: target size
  return config.targetChunkSize;
};

/**
 * Create hierarchical chunks from segments
 */
const createHierarchicalChunks = (
  segments: TextSegment[],
  boundaries: number[],
  metadata: ChunkMetadata,
  config: SemanticChunkingConfig
): HierarchicalChunk[] => {
  const chunks: HierarchicalChunk[] = [];
  const allBoundaries = [0, ...boundaries, segments.length];

  for (let i = 0; i < allBoundaries.length - 1; i++) {
    const startIdx = allBoundaries[i];
    const endIdx = allBoundaries[i + 1];
    const segmentGroup = segments.slice(startIdx, endIdx);
    const chunkText = segmentGroup.map((s) => s.text).join(' ');

    if (!chunkText.trim()) {
      continue;
    }

    // Determine chunk size based on content
    const adaptiveSize = getAdaptiveChunkSize(chunkText, config);

    // If chunk is too large, split it further
    if (chunkText.length > adaptiveSize && config.enableContentAwareChunking) {
      // Try to split at content-aware boundaries
      const subChunks = splitLargeChunk(chunkText, adaptiveSize);
      for (const subChunk of subChunks) {
        chunks.push({
          text: subChunk,
          metadata: {
            ...metadata,
            chunkIndex: chunks.length,
            level: 1, // Paragraph level
          },
          chunkIndex: chunks.length,
          level: 1,
        });
      }
    } else {
      chunks.push({
        text: chunkText.trim(),
        metadata: {
          ...metadata,
          chunkIndex: chunks.length,
          level: 0, // Document/section level
        },
        chunkIndex: chunks.length,
        level: 0,
      });
    }
  }

  return chunks;
};

/**
 * Split a large chunk using content-aware strategies
 */
const splitLargeChunk = (text: string, maxSize: number): string[] => {
  const chunks: string[] = [];
  const segments = splitIntoSegments(text);

  let currentChunk = '';
  let currentSize = 0;

  for (const segment of segments) {
    const segmentSize = segment.text.length;

    // If adding this segment would exceed max size, start a new chunk
    if (currentSize + segmentSize > maxSize && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
      currentSize = 0;
    }

    // Add segment to current chunk
    currentChunk += (currentChunk ? ' ' : '') + segment.text;
    currentSize += segmentSize;
  }

  // Add remaining chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

/**
 * Semantic chunking with fallback to fixed-size chunking
 */
export const semanticChunkText = async (
  text: string,
  metadata: ChunkMetadata,
  config: Partial<SemanticChunkingConfig> = {}
): Promise<TextChunk[]> => {
  if (!text.trim()) {
    return [];
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Split text into segments
    const segments = splitIntoSegments(text);

    if (segments.length < 2) {
      // Too few segments, use simple chunking
      return simpleChunkFallback(text, metadata, finalConfig);
    }

    // Find semantic boundaries
    const boundaries = await findSemanticBoundaries(segments, finalConfig);

    // Create chunks from segments and boundaries
    const hierarchicalChunks = createHierarchicalChunks(segments, boundaries, metadata, finalConfig);

    // If no good boundaries found or chunks are too large, fall back to simple chunking
    if (hierarchicalChunks.length === 0) {
      return simpleChunkFallback(text, metadata, finalConfig);
    }

    // Ensure chunks are within size limits
    const validChunks: TextChunk[] = [];
    for (const chunk of hierarchicalChunks) {
      if (chunk.text.length > finalConfig.maxChunkSize) {
        // Split oversized chunks
        const subChunks = splitLargeChunk(chunk.text, finalConfig.targetChunkSize);
        for (const subChunk of subChunks) {
          validChunks.push({
            text: subChunk,
            metadata: {
              ...chunk.metadata,
              chunkIndex: validChunks.length,
            },
            chunkIndex: validChunks.length,
          });
        }
      } else if (chunk.text.length >= finalConfig.minChunkSize) {
        validChunks.push({
          text: chunk.text,
          metadata: chunk.metadata,
          chunkIndex: validChunks.length,
        });
      }
    }

    // Add overlap between chunks if configured
    if (finalConfig.overlap > 0 && validChunks.length > 1) {
      return addOverlap(validChunks, text, finalConfig.overlap);
    }

    return validChunks;
  } catch (error) {
    // Fallback to simple chunking on error
    console.warn('Semantic chunking failed, falling back to simple chunking:', error instanceof Error ? error.message : 'Unknown error');
    return simpleChunkFallback(text, metadata, finalConfig);
  }
};

/**
 * Simple chunking fallback (fixed-size with sentence boundaries)
 */
const simpleChunkFallback = (
  text: string,
  metadata: ChunkMetadata,
  config: SemanticChunkingConfig
): TextChunk[] => {
  const chunks: TextChunk[] = [];
  const { targetChunkSize, overlap, minChunkSize } = config;
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + targetChunkSize, text.length);
    let chunkText = text.slice(startIndex, endIndex);

    // Try to break at sentence boundaries
    if (endIndex < text.length) {
      const lastPeriod = chunkText.lastIndexOf('.');
      const lastNewline = chunkText.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > targetChunkSize * 0.5) {
        chunkText = text.slice(startIndex, startIndex + breakPoint + 1);
        startIndex = startIndex + breakPoint + 1 - overlap;
      } else {
        startIndex = endIndex - overlap;
      }
    } else {
      startIndex = endIndex;
    }

    if (chunkText.trim().length >= minChunkSize) {
      chunks.push({
        text: chunkText.trim(),
        metadata: {
          ...metadata,
          chunkIndex,
        },
        chunkIndex,
      });
      chunkIndex++;
    }

    // Prevent infinite loop
    if (startIndex <= (chunks[chunks.length - 1]?.text.length || 0)) {
      startIndex = endIndex;
    }
  }

  return chunks;
};

/**
 * Add overlap between chunks
 */
const addOverlap = (chunks: TextChunk[], originalText: string, overlapSize: number): TextChunk[] => {
  if (chunks.length <= 1) {
    return chunks;
  }

  const overlappedChunks: TextChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let overlappedText = chunk.text;

    // Add overlap from previous chunk
    if (i > 0) {
      const prevChunk = chunks[i - 1];
      const prevEnd = originalText.indexOf(prevChunk.text) + prevChunk.text.length;
      const overlapStart = Math.max(0, prevEnd - overlapSize);
      const overlapText = originalText.slice(overlapStart, prevEnd).trim();

      if (overlapText) {
        overlappedText = overlapText + ' ' + overlappedText;
      }
    }

    // Add overlap to next chunk
    if (i < chunks.length - 1) {
      const currentEnd = originalText.indexOf(chunk.text) + chunk.text.length;
      const overlapEnd = Math.min(originalText.length, currentEnd + overlapSize);
      const overlapText = originalText.slice(currentEnd, overlapEnd).trim();

      if (overlapText) {
        overlappedText = overlappedText + ' ' + overlapText;
      }
    }

    overlappedChunks.push({
      ...chunk,
      text: overlappedText.trim(),
    });
  }

  return overlappedChunks;
};

/**
 * Semantic chunking for multiple text pieces
 */
export const semanticChunkMultipleTexts = async (
  texts: Array<{ text: string; metadata: ChunkMetadata }>,
  config: Partial<SemanticChunkingConfig> = {}
): Promise<TextChunk[]> => {
  const allChunks: TextChunk[] = [];
  let globalChunkIndex = 0;

  for (const item of texts) {
    const chunks = await semanticChunkText(item.text, item.metadata, config);

    for (const chunk of chunks) {
      allChunks.push({
        ...chunk,
        chunkIndex: globalChunkIndex++,
      });
    }
  }

  return allChunks;
};

