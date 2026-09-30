/**
 * EME provider mapping (M5).
 *
 * The DRM service reports which key system a session is protected with. The
 * player configures that key system explicitly and refuses anything it does not
 * recognise, so an unexpected provider surfaces an error state instead of
 * silently falling back to an unencrypted or wrong-key-system playback path.
 *
 * Widevine is listed because the DRM may report it. Listing it here is NOT a
 * claim that it is provisioned in any browser or that it has been observed
 * working; local verification only exercises ClearKey.
 */
import type { PlaybackGrant } from '../types/models';

export const EME_KEY_SYSTEMS = {
  CLEAR_KEY: 'org.w3.clearkey',
  WIDEVINE: 'com.widevine.alpha',
} as const;

export type KnownProvider = keyof typeof EME_KEY_SYSTEMS;

export function isKnownProvider(provider: string): provider is KnownProvider {
  return Object.prototype.hasOwnProperty.call(EME_KEY_SYSTEMS, provider);
}

/**
 * The dash.js protection key for a provider, or null when unsupported.
 * Matching is case-insensitive because the value crosses a service boundary.
 */
export function emeKeyForProvider(provider: string): string | null {
  const normalized = provider.trim().toUpperCase();
  if (!isKnownProvider(normalized)) return null;
  return EME_KEY_SYSTEMS[normalized];
}

/** True when the browser advertises this key system in EME. */
export async function browserSupports(keySystem: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.requestMediaKeySystemAccess !== 'function') {
    return false;
  }
  try {
    await navigator.requestMediaKeySystemAccess(keySystem, [
      {
        initDataTypes: ['cenc'],
        videoCapabilities: [{ contentType: 'video/mp4;codecs="avc1.42E01E"' }],
      },
    ]);
    return true;
  } catch {
    return false;
  }
}

/** True when the DRM reported a key system this build cannot configure. */
export function isUnsupportedProvider(grant: PlaybackGrant): boolean {
  return emeKeyForProvider(grant.drmProvider) === null;
}
