import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateWebVTT, parseWebVTTCues, sanitizeFilename, makeContentDisposition } from '../../src/modules/learning/materials/validation.js';

describe('WebVTT validation', () => {
  it.each([
    'align:start position:10%', 'align:right size:50%',
    'line:-1,end position:25.5%,line-left size:90% vertical:rl',
    'vertical:lr line:20%,center position:80%,line-right align:end',
    'region:lower-third', 'line:0 position:0% size:100%',
  ])('accepts and parses valid cue settings: %s', settings => {
    const vtt = Buffer.from(`WEBVTT\n\n00:00:01.500 --> 00:00:04.250 ${settings}\nCaption\n`);
    expect(validateWebVTT(vtt)).toMatchObject({ valid: true, cueCount: 1 });
    expect(parseWebVTTCues(vtt)).toEqual([{ start: 1500, end: 4250, text: 'Caption' }]);
  });
  it.each([
    'position:101%', 'position:-1%', 'size:100.1%', 'line:-10%',
    'line:1.5', 'line:1,invalid', 'position:10%,start', 'align:invalid',
    'vertical:up', 'region:', 'unknown:value', 'align:start align:end',
    'position:10%,center,extra', 'size:NaN%', 'position:',
  ])('rejects malformed or duplicate cue settings: %s', settings => {
    expect(validateWebVTT(Buffer.from(`WEBVTT\n\n00:00.000 --> 00:02.000 ${settings}\nCaption\n`)).valid).toBe(false);
  });
  it('accepts tab-delimited settings and long-hour timestamps', () => {
    expect(validateWebVTT(Buffer.from('WEBVTT\n\n100:00:00.000\t-->\t100:00:01.000\talign:center\tposition:50%\nCaption\n')).valid).toBe(true);
  });
  it('accepts valid WebVTT with cues', () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello world

2
00:00:05.000 --> 00:00:08.000
Another caption
`;
    const result = validateWebVTT(new TextEncoder().encode(vtt));
    expect(result.valid).toBe(true);
    expect(result.cueCount).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing WEBVTT header', () => {
    const vtt = `1
00:00:01.000 --> 00:00:04.000
Hello
`;
    const result = validateWebVTT(new TextEncoder().encode(vtt));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing WEBVTT header');
  });

  it('rejects invalid timestamp format', () => {
    const vtt = `WEBVTT

1
00:00:01 --> 00:00:04
Hello
`;
    const result = validateWebVTT(new TextEncoder().encode(vtt));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid timestamp'))).toBe(true);
  });

  it('rejects end before start', () => {
    const vtt = `WEBVTT

1
00:00:05.000 --> 00:00:01.000
Hello
`;
    const result = validateWebVTT(new TextEncoder().encode(vtt));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid timestamp'))).toBe(true);
  });

  it('rejects unsafe cue text with script tag', () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
<script>alert(1)</script>
`;
    const result = validateWebVTT(new TextEncoder().encode(vtt));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Unsafe cue text'))).toBe(true);
  });

  it('rejects unsafe cue text with javascript: URL', () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
javascript:alert(1)
`;
    const result = validateWebVTT(new TextEncoder().encode(vtt));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Unsafe cue text'))).toBe(true);
  });

  it('rejects null bytes in cue text', () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello\x00world
`;
    const result = validateWebVTT(new TextEncoder().encode(vtt));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Unsafe cue text'))).toBe(true);
  });

  it('parses cues correctly', () => {
    const vtt = `WEBVTT

1
00:00:01.500 --> 00:00:04.250
First cue

2
00:00:05.000 --> 00:00:08.000
Second cue
`;
    const cues = parseWebVTTCues(new TextEncoder().encode(vtt));
    expect(cues).toHaveLength(2);
    expect(cues[0].start).toBe(1500);
    expect(cues[0].end).toBe(4250);
    expect(cues[0].text).toBe('First cue');
    expect(cues[1].start).toBe(5000);
    expect(cues[1].end).toBe(8000);
    expect(cues[1].text).toBe('Second cue');
  });
});

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
