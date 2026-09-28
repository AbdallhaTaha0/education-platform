import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ['default'],
    // Integration files share one disposable database. Sequential files keep
    // the bootstrap suite's admin-absence precondition deterministic.
    fileParallelism: false,
  },
});
