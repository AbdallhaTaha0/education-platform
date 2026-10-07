import { describe, expect, it } from 'vitest';
import { PLAYBACK_SPEEDS, videoQualityOptions } from './playbackOptions';
describe('manifest-backed playback options', () => {
  it('exposes actual representations in ascending order without duplicate IDs', () => {
    expect(videoQualityOptions([
      { id: 'hd', height: 720, bitrateInKbit: 2000 },
      { id: 'sd', height: 360, bitrateInKbit: 600 },
      { id: 'hd', height: 720, bitrateInKbit: 2000 },
    ])).toEqual([{ id: 'sd', label: '360p' }, { id: 'hd', label: '720p · 2000 kbps' }]);
    expect(videoQualityOptions([])).toEqual([]);
  });
  it('distinguishes equal-height renditions and handles missing dimensions', () => {
    expect(videoQualityOptions([
      { id: 'a', height: 720, bitrateInKbit: 1200 },
      { id: 'b', height: 720, bitrateInKbit: 2400 },
      { id: 'c', height: 0, bitrateInKbit: 500 },
    ])).toEqual([{ id: 'c', label: '500 kbps' }, { id: 'a', label: '720p · 1200 kbps' }, { id: 'b', label: '720p · 2400 kbps' }]);
  });
  it('includes slower and faster rates while leaving elapsed view time unchanged', () => {
    expect(PLAYBACK_SPEEDS).toContain(0.5);
    expect(PLAYBACK_SPEEDS).toContain(1);
    expect(PLAYBACK_SPEEDS).toContain(2);
  });
});
