import { describe, expect, it } from 'vitest';
import { selectedLessonHash } from './lessonLocation';

describe('selected lesson URL', () => {
  it('replaces the old lesson while preserving manual-continue resume intent', () => {
    expect(selectedLessonHash('#/learn/aim?lesson=first&resume=1', 'second')).toBe('#/learn/aim?lesson=second&resume=1');
  });
  it('records a selected lesson on the bare course route without enabling autoplay', () => {
    expect(selectedLessonHash('#/learn/aim', 'second')).toBe('#/learn/aim?lesson=second');
  });
  it('preserves encoded course identity and unrelated parameters', () => {
    expect(selectedLessonHash('#/learn/course%20name?resume=0&from=dashboard', 'lesson 2')).toBe('#/learn/course%20name?resume=0&from=dashboard&lesson=lesson+2');
  });
  it('does not rewrite another page or an incomplete learning route', () => {
    expect(selectedLessonHash('#/wallet', 'second')).toBeNull();
    expect(selectedLessonHash('#/learn/', 'second')).toBeNull();
    expect(selectedLessonHash('#/learn/aim', '')).toBeNull();
  });
  it('is stable when the same selected lesson is synchronized again', () => {
    const hash = '#/learn/aim?lesson=second&resume=1';
    expect(selectedLessonHash(hash, 'second')).toBe(hash);
  });
});
