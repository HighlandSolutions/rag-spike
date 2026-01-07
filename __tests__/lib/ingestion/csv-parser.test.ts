/**
 * Unit tests for CSV parsing
 */

import { parseCsv } from '@/lib/ingestion/csv-parser';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';

describe('csv-parser', () => {
  const testDir = join(__dirname, '../../test-fixtures');

  beforeAll(async () => {
    try {
      await mkdir(testDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  describe('parseCsv', () => {
    it('should parse valid CSV file', async () => {
      const csvContent = `name,age,role
John,30,engineer
Jane,25,manager`;
      const csvPath = join(testDir, 'test.csv');
      await writeFile(csvPath, csvContent);

      const result = await parseCsv(csvPath, 'test.csv');

      expect(result.rows.length).toBe(2);
      expect(result.totalRows).toBe(2);
      expect(result.columnNames).toEqual(['name', 'age', 'role']);
      expect(result.fileName).toBe('test.csv');
      expect(result.sourcePath).toBe(csvPath);

      // Check first row
      expect(result.rows[0].rowIndex).toBe(1);
      expect(result.rows[0].text).toContain('name: John');
      expect(result.rows[0].text).toContain('age: 30');
      expect(result.rows[0].text).toContain('role: engineer');
      expect(result.rows[0].metadata.rowIndex).toBe(1);
      expect(result.rows[0].metadata.columnNames).toEqual(['name', 'age', 'role']);

      await unlink(csvPath);
    });

    it('should handle empty CSV file', async () => {
      const csvPath = join(testDir, 'empty.csv');
      await writeFile(csvPath, '');

      await expect(parseCsv(csvPath, 'empty.csv')).rejects.toThrow();

      await unlink(csvPath).catch(() => {
        // Ignore cleanup errors
      });
    });

    it('should handle CSV with only headers', async () => {
      const csvPath = join(testDir, 'headers-only.csv');
      await writeFile(csvPath, 'name,age,role');

      await expect(parseCsv(csvPath, 'headers-only.csv')).rejects.toThrow();

      await unlink(csvPath).catch(() => {
        // Ignore cleanup errors
      });
    });

    it('should skip empty lines', async () => {
      const csvContent = `name,age
John,30

Jane,25`;
      const csvPath = join(testDir, 'with-empty-lines.csv');
      await writeFile(csvPath, csvContent);

      const result = await parseCsv(csvPath, 'with-empty-lines.csv');

      expect(result.rows.length).toBe(2);
      expect(result.totalRows).toBe(2);

      await unlink(csvPath);
    });

    it('should trim whitespace from values', async () => {
      const csvContent = `name,age
  John  , 30
Jane, 25 `;
      const csvPath = join(testDir, 'whitespace.csv');
      await writeFile(csvPath, csvContent);

      const result = await parseCsv(csvPath, 'whitespace.csv');

      expect(result.rows[0].text).toContain('name: John');
      expect(result.rows[0].text).toContain('age: 30');

      await unlink(csvPath);
    });

    it('should handle CSV with special characters', async () => {
      const csvContent = `name,description
John,"Description with, comma"
Jane,"Description with ""quotes"""`;
      const csvPath = join(testDir, 'special-chars.csv');
      await writeFile(csvPath, csvContent);

      const result = await parseCsv(csvPath, 'special-chars.csv');

      expect(result.rows.length).toBe(2);
      expect(result.rows[0].text).toContain('John');

      await unlink(csvPath);
    });

    it('should preserve metadata in rows', async () => {
      const csvContent = `name,age
John,30`;
      const csvPath = join(testDir, 'metadata.csv');
      await writeFile(csvPath, csvContent);

      const result = await parseCsv(csvPath, 'metadata.csv');

      expect(result.rows[0].metadata.rowIndex).toBe(1);
      expect(result.rows[0].metadata.columnNames).toEqual(['name', 'age']);
      expect(result.rows[0].metadata.fileName).toBe('metadata.csv');
      expect(result.rows[0].metadata.sourceLocation).toBe(csvPath);

      await unlink(csvPath);
    });

    it('should throw error for non-existent file', async () => {
      await expect(parseCsv('/nonexistent/file.csv', 'test.csv')).rejects.toThrow();
    });

    it('should handle CSV with many columns', async () => {
      const columns = Array.from({ length: 20 }, (_, i) => `col${i}`).join(',');
      const rows = Array.from({ length: 5 }, (_, i) => 
        Array.from({ length: 20 }, (_, j) => `value${i}_${j}`).join(',')
      ).join('\n');
      const csvContent = `${columns}\n${rows}`;
      const csvPath = join(testDir, 'many-columns.csv');
      await writeFile(csvPath, csvContent);

      const result = await parseCsv(csvPath, 'many-columns.csv');

      expect(result.columnNames.length).toBe(20);
      expect(result.rows.length).toBe(5);

      await unlink(csvPath);
    });
  });
});

