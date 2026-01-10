/**
 * URL parsing and web scraping utilities
 */

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import type { ChunkMetadata } from '@/types/domain';
import fetch from 'node-fetch';

/**
 * URL parsing configuration
 */
export interface UrlParserConfig {
  timeout?: number; // Timeout in milliseconds (default: 30000)
  userAgent?: string; // User-Agent header (default: standard browser)
  maxRedirects?: number; // Maximum redirects to follow (default: 5)
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<UrlParserConfig> = {
  timeout: 30000, // 30 seconds
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  maxRedirects: 5,
};

/**
 * Parsed URL document
 */
export interface ParsedUrlDocument {
  url: string;
  title: string;
  description?: string;
  text: string;
  html?: string;
  lastModified?: Date;
  fetchedAt: Date;
  metadata: ChunkMetadata;
}

/**
 * Validate URL format
 */
export const validateUrl = (url: string): { isValid: boolean; error?: string } => {
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        isValid: false,
        error: 'URL must use HTTP or HTTPS protocol',
      };
    }
    return { isValid: true };
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format',
    };
  }
};

/**
 * Extract domain from URL for rate limiting
 */
export const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
};

/**
 * Fetch URL content with timeout and error handling
 */
const fetchUrlContent = async (url: string, config: Required<UrlParserConfig>): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    let currentUrl = url;
    let redirectCount = 0;

    while (redirectCount <= config.maxRedirects) {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': config.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'manual', // Handle redirects manually
      });

      // Handle redirects
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          redirectCount++;
          if (redirectCount > config.maxRedirects) {
            throw new Error(`Too many redirects (max: ${config.maxRedirects})`);
          }
          // Resolve relative URLs
          currentUrl = new URL(location, currentUrl).href;
          continue;
        }
      }

      // Handle errors
      if (response.status === 404) {
        throw new Error(`URL not found (404): ${url}`);
      }
      if (response.status >= 400) {
        throw new Error(`HTTP error ${response.status}: ${url}`);
      }

      // Check content type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        throw new Error(`Unsupported content type: ${contentType}. Only HTML is supported.`);
      }

      const html = await response.text();
      clearTimeout(timeoutId);
      return html;
    }

    throw new Error('Failed to fetch URL after redirects');
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${config.timeout}ms: ${url}`);
      }
      throw error;
    }
    throw new Error(`Failed to fetch URL: ${url}`);
  }
};

/**
 * Extract main content from HTML using Readability
 */
const extractMainContent = (html: string, url: string): { text: string; title: string; description?: string } => {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

  // Try to extract meta description
  const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
    document.querySelector('meta[property="og:description"]')?.getAttribute('content');

  // Use Readability to extract main content
  const reader = new Readability(document);
  const article = reader.parse();

  if (!article) {
    // Fallback: extract text from body
    const body = document.body;
    if (!body) {
      throw new Error('No content found in HTML');
    }

    // Remove script and style elements
    const scripts = body.querySelectorAll('script, style, nav, header, footer, aside');
    scripts.forEach((el) => el.remove());

    const text = body.textContent || '';
    const title = document.title || url;

    return {
      text: text.trim(),
      title: title.trim(),
      description: metaDescription || undefined,
    };
  }

  return {
    text: (article.textContent || '').trim(),
    title: (article.title || '').trim() || document.title || url,
    description: metaDescription || article.excerpt || undefined,
  };
};

/**
 * Extract last modified date from HTML
 */
const extractLastModified = (html: string): Date | undefined => {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Try meta tags first
  const metaLastMod = document.querySelector('meta[property="article:modified_time"]')?.getAttribute('content') ||
    document.querySelector('meta[name="last-modified"]')?.getAttribute('content');

  if (metaLastMod) {
    const date = new Date(metaLastMod);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try HTTP headers (would need to be passed in)
  // For now, return undefined
  return undefined;
};

/**
 * Parse URL and extract content
 */
export const parseUrl = async (
  url: string,
  config?: UrlParserConfig
): Promise<ParsedUrlDocument> => {
  // Validate URL
  const validation = validateUrl(url);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid URL');
  }

  const finalConfig: Required<UrlParserConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Fetch HTML content
  const html = await fetchUrlContent(url, finalConfig);

  // Extract main content using Readability
  const { text, title, description } = extractMainContent(html, url);

  // Extract last modified date
  const lastModified = extractLastModified(html);

  // Create metadata
  const metadata: ChunkMetadata = {
    url,
    pageTitle: title,
    pageDescription: description,
    fetchedAt: new Date().toISOString(),
    sourceLocation: url,
    fileName: title || url,
  };

  return {
    url,
    title,
    description,
    text,
    html,
    lastModified,
    fetchedAt: new Date(),
    metadata,
  };
};
