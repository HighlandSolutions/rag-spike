/**
 * PDF parsing utilities using pdfjs-dist for better page extraction
 */

import * as pdfjsLib from 'pdfjs-dist';
import { readFile } from 'fs/promises';
import type { ChunkMetadata } from '@/types/domain';

// Set up worker for Node.js environment
// For text extraction, we can use a simple approach without a worker
if (typeof window === 'undefined') {
  // Disable worker for Node.js - text extraction works without it
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';
}

/**
 * Parsed PDF page
 */
export interface ParsedPdfPage {
  pageNumber: number;
  text: string;
  metadata: ChunkMetadata;
}

/**
 * Parsed PDF document
 */
export interface ParsedPdfDocument {
  pages: ParsedPdfPage[];
  totalPages: number;
  fileName: string;
  sourcePath: string;
}

/**
 * Parse a PDF file and extract text per page
 */
export const parsePdf = async (filePath: string, fileName: string): Promise<ParsedPdfDocument> => {
  try {
    const fileBuffer = await readFile(filePath);
    const loadingTask = pdfjsLib.getDocument({
      data: fileBuffer,
      useSystemFonts: true,
    });

    const pdfDocument = await loadingTask.promise;
    const totalPages = pdfDocument.numPages;
    const pages: ParsedPdfPage[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Extract text from text items
      const pageText = textContent.items
        .map((item: { str?: string }) => item.str || '')
        .join(' ')
        .trim();

      if (pageText) {
        pages.push({
          pageNumber: pageNum,
          text: pageText,
          metadata: {
            pageNumber: pageNum,
            fileName,
            sourceLocation: filePath,
          },
        });
      }
    }

    return {
      pages,
      totalPages,
      fileName,
      sourcePath: filePath,
    };
  } catch (error) {
    throw new Error(`Failed to parse PDF ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
