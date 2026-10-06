import { describe, it, expect } from 'vitest';
import { sanitizeFilename, makeContentDisposition } from '../../src/modules/learning/materials/validation.js';

describe('filename sanitization', () => {
  it('removes path traversal attempts', () => {
    expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('..\\windows\\system32')).toBe('system32');
  });

  it('replaces dangerous characters', () => {
    expect(sanitizeFilename('file<name>.txt')).toBe('file_name_.txt');
    expect(sanitizeFilename('file:name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file"name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file|name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file?name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file*name.txt')).toBe('file_name.txt');
  });

  it('truncates long filenames preserving extension', () => {
    const longName = 'a'.repeat(250) + '.pdf';
    const sanitized = sanitizeFilename(longName);
    expect(sanitized.length).toBeLessThanOrEqual(255);
    expect(sanitized.endsWith('.pdf')).toBe(true);
  });

  it('handles empty filename', () => {
    expect(sanitizeFilename('')).toBe('file');
    expect(sanitizeFilename('   ')).toBe('   ');
  });
});

describe('Content-Disposition header', () => {
  it('generates safe header for ASCII filename', () => {
    const header = makeContentDisposition('document.pdf');
    expect(header).toContain('attachment; filename="document.pdf"');
    expect(header).toContain('filename*=UTF-8\'\'document.pdf');
  });

  it('generates safe header for Unicode filename', () => {
    const header = makeContentDisposition('ملف_اختبار.pdf');
    expect(header).toMatch(/^attachment; filename="[\x20-\x7e]+";/);
    expect(header).toContain(encodeURIComponent("ملف_اختبار.pdf"));
    expect(header).toContain('filename*=UTF-8\'\'');
  });

  it('includes quotes in filename parameter', () => {
    const header = makeContentDisposition('doc"ument.pdf');
    expect(header).toContain('filename=');
    // The filename parameter includes quotes, the filename* parameter uses RFC 5987 encoding
  });
});
