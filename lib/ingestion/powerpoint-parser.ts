/**
 * PowerPoint presentation parsing utilities using pptx2json
 * Note: Only .pptx (Office Open XML) format is supported, not .ppt (old format)
 */

import PPTX2Json from 'pptx2json';
import { readFile } from 'fs/promises';
import type { ChunkMetadata } from '@/types/domain';

/**
 * Parsed PowerPoint slide
 */
export interface ParsedPowerPointSlide {
  slideNumber: number;
  text: string;
  metadata: ChunkMetadata;
}

/**
 * Parsed PowerPoint document
 */
export interface ParsedPowerPointDocument {
  slides: ParsedPowerPointSlide[];
  totalSlides: number;
  fileName: string;
  sourcePath: string;
}

/**
 * Extract text from a PowerPoint JSON structure
 * The JSON structure from pptx2json contains slide data in XML format
 */
const extractTextFromSlideJson = (slideJson: unknown): string => {
  if (!slideJson || typeof slideJson !== 'object') {
    return '';
  }

  const textParts: string[] = [];

  // Recursively search for text in the JSON structure
  const extractText = (obj: unknown): void => {
    if (typeof obj === 'string') {
      // Clean up XML entities and whitespace
      const cleaned = obj
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();
      if (cleaned) {
        textParts.push(cleaned);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item) => extractText(item));
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach((value) => extractText(value));
    }
  };

  extractText(slideJson);
  return textParts.join(' ').trim();
};

/**
 * Parse a PowerPoint file (.pptx) and extract text per slide
 * Note: .ppt (old format) is not supported - only .pptx
 */
export const parsePowerPoint = async (filePath: string, fileName: string): Promise<ParsedPowerPointDocument> => {
  try {
    // Check if file is .ppt (old format) - not supported
    if (fileName.toLowerCase().endsWith('.ppt') && !fileName.toLowerCase().endsWith('.pptx')) {
      throw new Error('Legacy .ppt format is not supported. Please convert to .pptx format.');
    }

    const fileBuffer = await readFile(filePath);
    const pptx2json = new PPTX2Json();
    
    // Use buffer2json method to parse from buffer
    const json = await pptx2json.buffer2json(fileBuffer);

    if (!json || typeof json !== 'object') {
      throw new Error(`PowerPoint file ${fileName} could not be parsed`);
    }

    // Extract slides from the JSON structure
    // The structure typically has slides in ppt/slides/slide*.xml
    const slides: ParsedPowerPointSlide[] = [];
    let slideNumber = 0;

    // Navigate the JSON structure to find slides
    // The JSON structure from pptx2json has files organized by path
    const slidePaths = Object.keys(json).filter((path) => 
      path.startsWith('ppt/slides/slide') && path.endsWith('.xml')
    );

    // Sort slide paths to maintain order
    slidePaths.sort((a, b) => {
      const aNum = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      const bNum = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      return aNum - bNum;
    });

    for (const slidePath of slidePaths) {
      slideNumber++;
      const slideJson = (json as Record<string, unknown>)[slidePath];
      const slideText = extractTextFromSlideJson(slideJson);

      if (slideText) {
        slides.push({
          slideNumber,
          text: slideText,
          metadata: {
            slideNumber,
            fileName,
            sourceLocation: filePath,
          },
        });
      }
    }

    if (slides.length === 0) {
      throw new Error(`PowerPoint file ${fileName} contains no extractable text`);
    }

    return {
      slides,
      totalSlides: slides.length,
      fileName,
      sourcePath: filePath,
    };
  } catch (error) {
    throw new Error(`Failed to parse PowerPoint file ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
