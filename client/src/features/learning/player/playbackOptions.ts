/** Options come exclusively from the active protected DASH manifest. */
export interface VideoQualityOption { id: string; label: string }
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export function videoQualityOptions(representations: { id: string; height: number; bitrateInKbit: number }[]): VideoQualityOption[] {
  const seen = new Set<string>();
  return [...representations].filter(item => typeof item.id === 'string' && item.id !== '' && !seen.has(item.id) && !!seen.add(item.id))
    .sort((a, b) => (a.height || 0) - (b.height || 0) || (a.bitrateInKbit || 0) - (b.bitrateInKbit || 0))
    .map(item => {
      const height = Number.isFinite(item.height) && item.height > 0 ? `${Math.round(item.height)}p` : '';
      const bitrate = Number.isFinite(item.bitrateInKbit) && item.bitrateInKbit > 0 ? `${Math.round(item.bitrateInKbit)} kbps` : '';
      const duplicateHeight = height && representations.filter(other => other.height === item.height).length > 1;
      return { id: item.id, label: height ? height + (duplicateHeight && bitrate ? ` · ${bitrate}` : '') : bitrate || item.id };
    });
}
