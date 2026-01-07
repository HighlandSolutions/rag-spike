/**
 * Text chunking utilities
 */

import type { ChunkMetadata } from '@/types/domain';
import { semanticChunkText, semanticChunkMultipleTexts, type SemanticChunkingConfig } from './semantic-chunking';

/**
 * Chunking configuration
 */
export interface ChunkingConfig {
  chunkSize: number; // Target chunk size in characters (approximate tokens)
  overlap: number; // Overlap size in characters
  useSemanticChunking?: boolean; // Enable semantic chunking (default: false)
  semanticConfig?: Partial<SemanticChunkingConfig>; // Semantic chunking configuration
}

/**
 * Default chunking configuration
 * ~500-1000 tokens ≈ 2000-4000 characters (rough estimate: 1 token ≈ 4 characters)
 */
const DEFAULT_CONFIG: ChunkingConfig = {
  chunkSize: 2000, // ~500 tokens
  overlap: 200, // ~50 tokens
};

/**
 * Chunk with metadata
 */
export interface TextChunk {
  text: string;
  metadata: ChunkMetadata;
  chunkIndex: number;
}

/**
 * Estimate token count from character count
 * Rough approximation: 1 token ≈ 4 characters
 */
export const estimateTokenCount = (text: string): number => {
  return Math.ceil(text.length / 4);
};

/**
 * Chunk text into smaller pieces with overlap
 * Uses semantic chunking if enabled, otherwise falls back to fixed-size chunking
 */
export const chunkText = async (
  text: string,
  metadata: ChunkMetadata,
  config: ChunkingConfig = DEFAULT_CONFIG
): Promise<TextChunk[]> => {
  // Use semantic chunking if enabled
  if (config.useSemanticChunking) {
    const semanticConfig: Partial<SemanticChunkingConfig> = {
      targetChunkSize: config.chunkSize,
      minChunkSize: Math.floor(config.chunkSize * 0.25),
      maxChunkSize: Math.floor(config.chunkSize * 2),
      overlap: config.overlap,
      ...config.semanticConfig,
    };
    return semanticChunkText(text, metadata, semanticConfig);
  }

  // Fallback to fixed-size chunking
  if (!text.trim()) {
    return [];
  }

  const chunks: TextChunk[] = [];
  const { chunkSize, overlap } = config;
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    let chunkText = text.slice(startIndex, endIndex);

    // Try to break at sentence boundaries if possible
    if (endIndex < text.length) {
      const lastPeriod = chunkText.lastIndexOf('.');
      const lastNewline = chunkText.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > chunkSize * 0.5) {
        // Only break at sentence if we're not cutting off too much
        chunkText = text.slice(startIndex, startIndex + breakPoint + 1);
        startIndex = startIndex + breakPoint + 1 - overlap;
      } else {
        startIndex = endIndex - overlap;
      }
    } else {
      startIndex = endIndex;
    }

    if (chunkText.trim()) {
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
    if (startIndex <= chunks[chunks.length - 1]?.text.length || 0) {
      startIndex = endIndex;
    }
  }

  return chunks;
};

/**
 * Chunk multiple text pieces (e.g., pages or rows)
 * Uses semantic chunking if enabled, otherwise falls back to fixed-size chunking
 */
export const chunkMultipleTexts = async (
  texts: Array<{ text: string; metadata: ChunkMetadata }>,
  config: ChunkingConfig = DEFAULT_CONFIG
): Promise<TextChunk[]> => {
  // Use semantic chunking if enabled
  if (config.useSemanticChunking) {
    const semanticConfig: Partial<SemanticChunkingConfig> = {
      targetChunkSize: config.chunkSize,
      minChunkSize: Math.floor(config.chunkSize * 0.25),
      maxChunkSize: Math.floor(config.chunkSize * 2),
      overlap: config.overlap,
      ...config.semanticConfig,
    };
    return semanticChunkMultipleTexts(texts, semanticConfig);
  }

  // Fallback to fixed-size chunking
  const allChunks: TextChunk[] = [];
  let globalChunkIndex = 0;

  for (const item of texts) {
    const chunks = await chunkText(item.text, item.metadata, config);

    for (const chunk of chunks) {
      allChunks.push({
        ...chunk,
        chunkIndex: globalChunkIndex++,
      });
    }
  }

  return allChunks;
};

