/**
 * File discovery and validation utilities
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import type { ContentType } from '@/types/domain';
import { getContentType, type ContentTypeConfig } from './content-type-config';
import { validateUrl } from './url-parser';

/**
 * Supported file types for ingestion
 */
export const SUPPORTED_FILE_TYPES = ['.pdf', '.csv', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'] as const;

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
 * Discovered URL information
 */
export interface DiscoveredUrl {
  url: string;
  name: string; // Display name (from URL or title)
  sourcePath: string; // Path to .urls file or 'direct' for CLI input
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

/**
 * Discover URLs from .urls files in a directory
 */
export const discoverUrls = async (contentDir: string): Promise<DiscoveredUrl[]> => {
  const urls: DiscoveredUrl[] = [];

  try {
    const entries = await readdir(contentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.urls')) {
        const fullPath = join(contentDir, entry.name);
        const content = await readFile(fullPath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line && !line.startsWith('#')) {
            // Skip empty lines and comments
            const validation = validateUrl(line);
            if (validation.isValid) {
              urls.push({
                url: line,
                name: line, // Will be updated with page title after fetching
                sourcePath: fullPath,
              });
            } else {
              console.warn(`Skipping invalid URL in ${entry.name} (line ${i + 1}): ${line}`);
            }
          }
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to discover URLs in ${contentDir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return urls;
};

/**
 * Parse URLs from a text file
 */
export const parseUrlsFromFile = async (filePath: string): Promise<DiscoveredUrl[]> => {
  const urls: DiscoveredUrl[] = [];

  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#')) {
        // Skip empty lines and comments
        const validation = validateUrl(line);
        if (validation.isValid) {
          urls.push({
            url: line,
            name: line,
            sourcePath: filePath,
          });
        } else {
          console.warn(`Skipping invalid URL (line ${i + 1}): ${line}`);
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to parse URLs from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return urls;
};

/**
 * Create a DiscoveredUrl from a direct URL input
 */
export const createDiscoveredUrl = (url: string): DiscoveredUrl => {
  const validation = validateUrl(url);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid URL');
  }

  return {
    url,
    name: url,
    sourcePath: 'direct', // Indicates direct CLI input
  };
};
