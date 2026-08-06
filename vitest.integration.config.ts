import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.integration.test.ts'],
    // Integration test files share one Postgres DB and truncate the same
    // tables in beforeEach — running files in parallel races them against
    // each other. Force serial execution across files.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
