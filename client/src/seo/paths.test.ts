import { describe, expect, it } from 'vitest';
import { alternatePublicHref } from './paths';

describe('public language-switch destination', () => {
  it('preserves the active hash course instead of the initial catalog path', () => {
    expect(alternatePublicHref('/ar/courses', 'ar', '#/courses/aim')).toBe('/en/courses/aim');
    expect(alternatePublicHref('/en/courses', 'en', '#/courses/aim')).toBe('/ar/courses/aim');
  });
  it('preserves public package and home navigation', () => {
    expect(alternatePublicHref('/ar/courses', 'ar', '#/package/pkg')).toBe('/en/package/pkg');
    expect(alternatePublicHref('/ar/courses', 'ar', '#/')).toBe('/en');
  });
  it('uses the real public path for server rendering and anchor-only navigation', () => {
    expect(alternatePublicHref('/ar/courses/aim', 'ar')).toBe('/en/courses/aim');
    expect(alternatePublicHref('/en/courses?page=2', 'en', '#main')).toBe('/ar/courses?page=2');
  });
  it('leaves private route language changes to the existing switch handler', () => {
    expect(alternatePublicHref('/ar/courses', 'ar', '#/wallet')).toBeUndefined();
    expect(alternatePublicHref('/ar/courses', 'ar', '#/assessment/test')).toBeUndefined();
  });
});
