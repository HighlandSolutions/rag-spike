/**
 * Unit tests for PDF parsing
 */

// Mock pdfjs-dist to avoid ESM import issues in Jest
jest.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {
    workerSrc: '',
  },
  getDocument: jest.fn(),
}));

import { parsePdf } from '@/lib/ingestion/pdf-parser';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import * as pdfjsLib from 'pdfjs-dist';

describe('pdf-parser', () => {
  const testDir = join(__dirname, '../../test-fixtures');

  beforeAll(async () => {
    try {
      await mkdir(testDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    // Cleanup test files if needed
  });

  describe('parsePdf', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw error for non-existent file', async () => {
      await expect(parsePdf('/nonexistent/file.pdf', 'test.pdf')).rejects.toThrow();
    });

    it('should throw error for invalid PDF file', async () => {
      const invalidPdfPath = join(testDir, 'invalid.pdf');
      await writeFile(invalidPdfPath, 'This is not a PDF file');

      // Mock getDocument to throw an error for invalid PDF
      (pdfjsLib.getDocument as jest.Mock).mockImplementation(() => ({
        promise: Promise.reject(new Error('Invalid PDF')),
      }));

      await expect(parsePdf(invalidPdfPath, 'invalid.pdf')).rejects.toThrow('Invalid PDF');

      await unlink(invalidPdfPath).catch(() => {
        // Ignore cleanup errors
      });
    });

    it('should return correct structure when parsing succeeds', async () => {
      const mockPdfPath = join(testDir, 'mock.pdf');
      await writeFile(mockPdfPath, 'mock pdf content');

      // Mock successful PDF parsing
      const mockPage = {
        getTextContent: jest.fn().mockResolvedValue({
          items: [{ str: 'Page 1 text' }],
        }),
      };

      const mockPdfDocument = {
        numPages: 1,
        getPage: jest.fn().mockResolvedValue(mockPage),
      };

      (pdfjsLib.getDocument as jest.Mock).mockReturnValue({
        promise: Promise.resolve(mockPdfDocument),
      });

      const result = await parsePdf(mockPdfPath, 'mock.pdf');

      expect(result.fileName).toBe('mock.pdf');
      expect(result.sourcePath).toBe(mockPdfPath);
      expect(result.totalPages).toBe(1);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].text).toContain('Page 1 text');
      expect(result.pages[0].metadata.fileName).toBe('mock.pdf');

      await unlink(mockPdfPath).catch(() => {
        // Ignore cleanup errors
      });
    });

    it('should extract text from PDF pages', async () => {
      const mockPdfPath = join(testDir, 'text.pdf');
      await writeFile(mockPdfPath, 'mock pdf content');

      const mockPage = {
        getTextContent: jest.fn().mockResolvedValue({
          items: [
            { str: 'First' },
            { str: 'sentence.' },
            { str: 'Second' },
            { str: 'sentence.' },
          ],
        }),
      };

      const mockPdfDocument = {
        numPages: 1,
        getPage: jest.fn().mockResolvedValue(mockPage),
      };

      (pdfjsLib.getDocument as jest.Mock).mockReturnValue({
        promise: Promise.resolve(mockPdfDocument),
      });

      const result = await parsePdf(mockPdfPath, 'text.pdf');

      expect(result.pages[0].text).toBe('First sentence. Second sentence.');
      expect(result.pages[0].pageNumber).toBe(1);

      await unlink(mockPdfPath).catch(() => {
        // Ignore cleanup errors
      });
    });

    it('should handle PDFs with no extractable text', async () => {
      const mockPdfPath = join(testDir, 'empty.pdf');
      await writeFile(mockPdfPath, 'mock pdf content');

      const mockPage = {
        getTextContent: jest.fn().mockResolvedValue({
          items: [],
        }),
      };

      const mockPdfDocument = {
        numPages: 1,
        getPage: jest.fn().mockResolvedValue(mockPage),
      };

      (pdfjsLib.getDocument as jest.Mock).mockReturnValue({
        promise: Promise.resolve(mockPdfDocument),
      });

      const result = await parsePdf(mockPdfPath, 'empty.pdf');

      // Pages with no text should not be included
      expect(result.pages).toHaveLength(0);
      expect(result.totalPages).toBe(1);

      await unlink(mockPdfPath).catch(() => {
        // Ignore cleanup errors
      });
    });

    it('should preserve metadata in parsed pages', async () => {
      const mockPdfPath = join(testDir, 'metadata.pdf');
      await writeFile(mockPdfPath, 'mock pdf content');

      const mockPage = {
        getTextContent: jest.fn().mockResolvedValue({
          items: [{ str: 'Test content' }],
        }),
      };

      const mockPdfDocument = {
        numPages: 2,
        getPage: jest.fn().mockResolvedValue(mockPage),
      };

      (pdfjsLib.getDocument as jest.Mock).mockReturnValue({
        promise: Promise.resolve(mockPdfDocument),
      });

      const result = await parsePdf(mockPdfPath, 'metadata.pdf');

      expect(result.pages).toHaveLength(2);
      result.pages.forEach((page, index) => {
        expect(page.metadata.pageNumber).toBe(index + 1);
        expect(page.metadata.fileName).toBe('metadata.pdf');
        expect(page.metadata.sourceLocation).toBe(mockPdfPath);
      });

      await unlink(mockPdfPath).catch(() => {
        // Ignore cleanup errors
      });
    });
  });
});

