/**
 * File discovery and validation utilities
 */

import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import type { ContentType } from '@/types/domain';
import { getContentType, type ContentTypeConfig } from './content-type-config';

/**
 * Supported file types for ingestion
 */
export const SUPPORTED_FILE_TYPES = ['.pdf', '.csv'] as const;

export type SupportedFileType = (typeof SUPPORTED_FILE_TYPES)[number];

/**
 * File size limits (in bytes)
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Discovered file information
 */
export interface DiscoveredFile {
  path: string;
  name: string;
  extension: string;
  size: number;
  type: SupportedFileType;
}

/**
 * File validation result
 */
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Discover all supported files in a directory
 */
export const discoverFiles = async (contentDir: string): Promise<DiscoveredFile[]> => {
  const files: DiscoveredFile[] = [];

  try {
    const entries = await readdir(contentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        const extension = extname(entry.name).toLowerCase();
        if (SUPPORTED_FILE_TYPES.includes(extension as SupportedFileType)) {
          const fullPath = join(contentDir, entry.name);
          const stats = await stat(fullPath);

          files.push({
            path: fullPath,
            name: basename(entry.name),
            extension,
            size: stats.size,
            type: extension as SupportedFileType,
          });
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to discover files in ${contentDir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return files;
};

/**
 * Validate a file before processing
 */
export const validateFile = (file: DiscoveredFile): FileValidationResult => {
  if (file.size === 0) {
    return {
      isValid: false,
      error: `File ${file.name} is empty`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File ${file.name} exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: `File ${file.name} has unsupported type: ${file.extension}`,
    };
  }

  return { isValid: true };
};

/**
 * Get content type from file using configuration
 */
export const getContentTypeFromFile = (
  file: DiscoveredFile,
  config?: ContentTypeConfig
): ContentType => {
  return getContentType(file.name, file.extension, config);
};

