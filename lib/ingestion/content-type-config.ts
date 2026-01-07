/**
 * Content type mapping configuration
 * Maps file extensions and patterns to content types
 */

import type { ContentType } from '@/types/domain';

/**
 * Content type mapping rule
 */
export interface ContentTypeRule {
  pattern: string | RegExp; // File name pattern or extension
  contentType: ContentType;
}

/**
 * Default content type mapping configuration
 */
export const DEFAULT_CONTENT_TYPE_MAP: Record<string, ContentType> = {
  '.pdf': 'policies',
  '.csv': 'learning_content',
};

/**
 * Content type configuration
 */
export interface ContentTypeConfig {
  defaultContentType: ContentType;
  rules: ContentTypeRule[];
  fileExtensionMap: Record<string, ContentType>;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: ContentTypeConfig = {
  defaultContentType: 'all',
  rules: [],
  fileExtensionMap: DEFAULT_CONTENT_TYPE_MAP,
};

/**
 * Get content type for a file based on configuration
 */
export const getContentType = (
  fileName: string,
  fileExtension: string,
  config: ContentTypeConfig = DEFAULT_CONFIG
): ContentType => {
  // Check file extension map first
  const extension = fileExtension.toLowerCase();
  if (config.fileExtensionMap[extension]) {
    return config.fileExtensionMap[extension];
  }

  // Check custom rules
  for (const rule of config.rules) {
    if (typeof rule.pattern === 'string') {
      if (fileName.includes(rule.pattern) || extension === rule.pattern) {
        return rule.contentType;
      }
    } else if (rule.pattern instanceof RegExp) {
      if (rule.pattern.test(fileName) || rule.pattern.test(extension)) {
        return rule.contentType;
      }
    }
  }

  // Return default
  return config.defaultContentType;
};

/**
 * Load content type configuration from a JSON file
 */
export const loadContentTypeConfig = async (configPath?: string): Promise<ContentTypeConfig> => {
  if (!configPath) {
    return DEFAULT_CONFIG;
  }

  try {
    const { readFile } = await import('fs/promises');
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent) as Partial<ContentTypeConfig>;

    return {
      defaultContentType: config.defaultContentType || DEFAULT_CONFIG.defaultContentType,
      rules: config.rules || DEFAULT_CONFIG.rules,
      fileExtensionMap: {
        ...DEFAULT_CONFIG.fileExtensionMap,
        ...config.fileExtensionMap,
      },
    };
  } catch (error) {
    console.warn(`Failed to load content type config from ${configPath}, using defaults: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return DEFAULT_CONFIG;
  }
};

