/**
 * CSV parsing utilities
 */

import { parse } from 'csv-parse/sync';
import { readFile } from 'fs/promises';
import type { ChunkMetadata } from '@/types/domain';

/**
 * Parsed CSV row
 */
export interface ParsedCsvRow {
  rowIndex: number;
  text: string;
  metadata: ChunkMetadata;
}

/**
 * Parsed CSV document
 */
export interface ParsedCsvDocument {
  rows: ParsedCsvRow[];
  totalRows: number;
  columnNames: string[];
  fileName: string;
  sourcePath: string;
}

/**
 * Parse a CSV file and extract text per row
 */
export const parseCsv = async (filePath: string, fileName: string): Promise<ParsedCsvDocument> => {
  try {
    const fileContent = await readFile(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true, // Use first row as column names
      skip_empty_lines: true,
      trim: true,
    });

    if (!Array.isArray(records) || records.length === 0) {
      throw new Error(`CSV file ${fileName} is empty or has no valid rows`);
    }

    const columnNames = Object.keys(records[0] || {});
    const rows: ParsedCsvRow[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowText = Object.entries(record)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

      if (rowText.trim()) {
        rows.push({
          rowIndex: i + 1, // 1-indexed
          text: rowText,
          metadata: {
            rowIndex: i + 1,
            columnNames,
            fileName,
            sourceLocation: filePath,
          },
        });
      }
    }

    return {
      rows,
      totalRows: records.length,
      columnNames,
      fileName,
      sourcePath: filePath,
    };
  } catch (error) {
    throw new Error(`Failed to parse CSV ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

