/**
 * Word document parsing utilities using mammoth for .docx files
 * Note: .doc (old format) is not supported by mammoth and would require additional libraries
 */

import mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import type { ChunkMetadata } from '@/types/domain';

/**
 * Parsed Word document section
 */
export interface ParsedWordSection {
  sectionIndex: number;
  text: string;
  metadata: ChunkMetadata;
}

/**
 * Parsed Word document
 */
export interface ParsedWordDocument {
  sections: ParsedWordSection[];
  totalSections: number;
  fileName: string;
  sourcePath: string;
}

/**
 * Parse a Word document (.docx) and extract text
 * Note: .doc (old format) is not supported by mammoth - only .docx
 */
export const parseWord = async (filePath: string, fileName: string): Promise<ParsedWordDocument> => {
  try {
    // Check if file is .doc (old format) - not supported
    if (fileName.toLowerCase().endsWith('.doc') && !fileName.toLowerCase().endsWith('.docx')) {
      throw new Error('Legacy .doc format is not supported. Please convert to .docx format.');
    }

    const fileBuffer = await readFile(filePath);
    
    // Mammoth extracts text from .docx files
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const fullText = result.value.trim();

    if (!fullText) {
      throw new Error(`Word document ${fileName} appears to be empty or contains no extractable text`);
    }

    // Split text into sections by paragraphs (double newlines)
    // This creates logical sections for chunking
    const paragraphs = fullText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    
    const sections: ParsedWordSection[] = paragraphs.map((paragraph, index) => ({
      sectionIndex: index + 1,
      text: paragraph.trim(),
      metadata: {
        sectionIndex: index + 1,
        fileName,
        sourceLocation: filePath,
      },
    }));

    return {
      sections,
      totalSections: sections.length,
      fileName,
      sourcePath: filePath,
    };
  } catch (error) {
    throw new Error(`Failed to parse Word document ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
