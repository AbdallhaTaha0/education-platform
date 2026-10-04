import { describe, expect, it } from 'vitest';
import { isValidWebVtt, safeDownloadName } from './captions';

const VALID = `WEBVTT

00:00.000 --> 00:02.000
مرحبا بالدرس

00:02.500 --> 00:05.000
Hello lesson
`;

describe('course-learning caption validation', () => {
  it('accepts server-validated positioned and tab-delimited cues', () => {
    expect(isValidWebVtt('WEBVTT\n\n00:00.000 --> 00:02.000 align:start position:10%\nCaption\n')).toBe(true);
    expect(isValidWebVtt('WEBVTT\n\n100:00:00.000\t-->\t100:00:02.000\tposition:25.5%,line-left\nCaption\n')).toBe(true);
  });
  it('accepts validated bilingual WebVTT', () => {
    expect(isValidWebVtt(VALID)).toBe(true);
  });

  it('rejects non-WebVTT and header abuse', () => {
    expect(isValidWebVtt('')).toBe(false);
    expect(isValidWebVtt('<script>alert(1)</script>')).toBe(false);
    expect(isValidWebVtt('WEBVTT evil-header\n00:00.000 --> 00:01.000\nx')).toBe(false);
    expect(isValidWebVtt('WEBVTT\nno cues here')).toBe(false);
  });

  it('sanitizes download names without paths', () => {
    expect(safeDownloadName('../../etc/passwd', 'fallback.pdf')).toBe('passwd');
    expect(safeDownloadName('', 'fallback.pdf')).toBe('fallback.pdf');
    expect(safeDownloadName('notes.pdf', 'fallback.pdf')).toBe('notes.pdf');
  });
});

 it('accepts CRLF Arabic captions', () => { expect(isValidWebVtt('WEBVTT\r\n\r\n00:00:00.000 --> 00:00:02.000\r\nمرحبا\r\n')).toBe(true); });
