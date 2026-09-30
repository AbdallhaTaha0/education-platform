import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure client logic only. Browser behaviour is covered by the Chromium
    // suite, so no DOM environment is needed here.
    include: ['src/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
});
