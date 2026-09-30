import { describe, expect, it } from 'vitest';
import { protectedRequestUrl } from './requests';
const manifest = 'https://drm.example/v1/playback/session/manifest.mpd';
const license = 'https://drm.example/v1/licenses';
describe('protected DASH gateway requests', () => {
  it('routes real relative init and numbered segment files through the gateway', () => {
    expect(protectedRequestUrl('video_init.mp4', manifest, license)).toBe('https://drm.example/v1/playback/session/media/video_init.mp4');
    expect(protectedRequestUrl('https://drm.example/v1/playback/session/audio_seg_2.m4s', manifest, license)).toBe('https://drm.example/v1/playback/session/media/audio_seg_2.m4s');
  });
  it('preserves manifest, license, and already-routed requests', () => {
    for (const url of [manifest, license, 'https://drm.example/v1/playback/session/media/video_seg_1.m4s']) {
      expect(protectedRequestUrl(url, manifest, license)).toBe(url);
    }
  });
  it('refuses foreign origins and session paths before a bearer is attached', () => {
    for (const url of ['https://stranger.example/x', '../other/file.m4s', '/v1/playback/other/media/file.m4s', 'media/%2e%2e/file.m4s']) {
      expect(() => protectedRequestUrl(url, manifest, license)).toThrow();
    }
  });
});
