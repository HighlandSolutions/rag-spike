/**
 * Excel spreadsheet parsing utilities using xlsx (SheetJS)
 */

import * as XLSX from 'xlsx';
import { readFile } from 'fs/promises';
import type { ChunkMetadata } from '@/types/domain';

/**
 * Parsed Excel row
 */
export interface ParsedExcelRow {
  sheetName: string;
  rowIndex: number;
  text: string;
  metadata: ChunkMetadata;
}

/**
 * Parsed Excel document
 */
export interface ParsedExcelDocument {
  rows: ParsedExcelRow[];
  totalRows: number;
  sheetNames: string[];
  fileName: string;
  sourcePath: string;
}

/**
 * Parse an Excel file (.xlsx, .xls) and extract text per row across all sheets
 */
export const parseExcel = async (filePath: string, fileName: string): Promise<ParsedExcelDocument> => {
  try {
    const fileBuffer = await readFile(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error(`Excel file ${fileName} contains no sheets`);
    }

    const rows: ParsedExcelRow[] = [];
    const sheetNames: string[] = workbook.SheetNames;

    // Process each sheet
    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        continue;
      }

      // Convert sheet to JSON array of objects (first row as headers)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // Use array format to preserve row structure
        defval: '', // Default value for empty cells
        raw: false, // Convert all values to strings
      }) as unknown[][];

      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        continue;
      }

      // First row is typically headers
      const headers = (jsonData[0] || []).map((cell) => String(cell || '').trim()).filter((h) => h);
      
      // Process data rows (skip header row)
      for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex++) {
        const row = jsonData[rowIndex];
        if (!Array.isArray(row)) {
          continue;
        }

        // Convert row to text format: "column1: value1\ncolumn2: value2..."
        const rowText = row
          .map((cell, colIndex) => {
            const header = headers[colIndex] || `Column${colIndex + 1}`;
            const value = String(cell || '').trim();
            return value ? `${header}: ${value}` : null;
          })
          .filter((item) => item !== null)
          .join('\n');

        if (rowText.trim()) {
          rows.push({
            sheetName,
            rowIndex: rowIndex + 1, // 1-indexed
            text: rowText,
            metadata: {
              sheetName,
              rowIndex: rowIndex + 1,
              columnNames: headers,
              fileName,
              sourceLocation: filePath,
            },
          });
        }
      }
    }

    if (rows.length === 0) {
      throw new Error(`Excel file ${fileName} contains no data rows`);
    }

    return {
      rows,
      totalRows: rows.length,
      sheetNames,
      fileName,
      sourcePath: filePath,
    };
  } catch (error) {
    throw new Error(`Failed to parse Excel file ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
